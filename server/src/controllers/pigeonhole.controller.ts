import type { Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { prisma } from "../config/prisma.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { getSessionToken, type AuthenticatedRequest } from "../middleware/auth.middleware.js";

const VALID_TYPES = ["SUGGESTION", "COMPLAINT", "FEEDBACK", "CONCERN", "COMPLIMENT", "OTHER"] as const;
const VALID_STATUSES = ["SUBMITTED", "RECEIVED", "UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS", "RESPONSE_PROVIDED", "CLOSED"] as const;
type SubmissionType = typeof VALID_TYPES[number];
type SubmissionStatus = typeof VALID_STATUSES[number];

async function getOptionalUser(req: Request) {
  const token = getSessionToken(req);
  if (!token) return null;
  const payload = verifyAccessToken(token);
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, role: true, accountStatus: true }
  });
  if (!user || user.accountStatus !== "ACTIVE" || user.role !== payload.role) {
    throw new Error("INACTIVE_ACCOUNT");
  }
  return user;
}

function publicSubmission(row: any, includeIdentity = false) {
  return {
    id: row.id,
    referenceNumber: row.referenceNumber,
    submissionType: row.type,
    subject: row.subject,
    message: row.message,
    anonymousSubmission: row.isAnonymous,
    status: row.status,
    response: row.response,
    submittedAt: row.createdAt,
    updatedAt: row.updatedAt,
    category: row.category?.name ?? row.type,
    ...(includeIdentity && !row.isAnonymous && row.submitter
      ? { submittedBy: row.submitter.fullName }
      : {})
  };
}

// GET /api/pigeonhole — citizen sees own items; officers/admins see the review queue.
export async function listPigeonhole(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.userId;
    const role = (req as AuthenticatedRequest).user?.role;
    if (!userId || !role) {
      res.status(401).json({ message: "Authentication required." });
      return;
    }
    const user = await prisma.user.findFirst({
      where: { id: userId, accountStatus: "ACTIVE" },
      select: { id: true, role: true }
    });
    if (!user || user.role !== role) {
      res.status(403).json({ message: "An active account is required." });
      return;
    }
    const rows = await prisma.pigeonholeSubmission.findMany({
      where: role === "CITIZEN" ? { submitterId: userId } : {},
      include: {
        category: { select: { name: true } },
        ...(role === "SYSTEM_ADMINISTRATOR"
          ? { submitter: { select: { fullName: true } } }
          : {})
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    res.status(200).json(rows.map((row) => publicSubmission(row, role === "SYSTEM_ADMINISTRATOR")));
  } catch (error) {
    console.error("Pigeonhole retrieval failed:", error);
    res.status(500).json({ message: "Could not retrieve submissions." });
  }
}

// POST /api/pigeonhole — anonymous or authenticated submission.
export async function submitPigeonhole(req: Request, res: Response): Promise<void> {
  try {
    const user = await getOptionalUser(req);
    const { submissionType, subject, message, anonymous, consent } = req.body ?? {};

    if (typeof submissionType !== "string" || !VALID_TYPES.includes(submissionType as SubmissionType)) {
      res.status(400).json({ message: "Select a valid submission type." });
      return;
    }
    if (typeof subject !== "string" || subject.trim().length < 3 || subject.trim().length > 200) {
      res.status(400).json({ message: "Subject must contain between 3 and 200 characters." });
      return;
    }
    if (typeof message !== "string" || message.trim().length < 10 || message.trim().length > 20000) {
      res.status(400).json({ message: "Message must contain between 10 and 20,000 characters." });
      return;
    }
    if (typeof anonymous !== "boolean" || consent !== true) {
      res.status(400).json({ message: "Choose an identity option and acknowledge the privacy notice." });
      return;
    }
    if (!user && !anonymous) {
      res.status(401).json({ message: "Sign in before submitting with your identity attached." });
      return;
    }

    const type = submissionType as SubmissionType;
    // Pigeonhole categories are stored in their own enum-backed lookup table.
    // Create the category on first use; this avoids requiring a manual seed step.
    const category = await prisma.pigeonholeCategory.upsert({
      where: { name: type },
      create: { name: type, description: `Default ${type.toLowerCase()} category.` },
      update: {},
      select: { id: true }
    });

    // The existing TiDB schema has no access-code or department columns.
    // Use a 104-bit random reference as the unguessable tracking credential.
    let referenceNumber = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = `PG-${randomBytes(13).toString("hex").toUpperCase()}`;
      const exists = await prisma.pigeonholeSubmission.findUnique({
        where: { referenceNumber: candidate },
        select: { id: true }
      });
      if (!exists) { referenceNumber = candidate; break; }
    }
    if (!referenceNumber) {
      res.status(503).json({ message: "Could not generate a submission reference. Please try again." });
      return;
    }

    await prisma.$transaction(async (tx) => {
      const submission = await tx.pigeonholeSubmission.create({
        data: {
          referenceNumber,
          type,
          subject: subject.trim(),
          message: message.trim(),
          isAnonymous: anonymous,
          submitterId: anonymous ? null : user!.id,
          categoryId: category.id
        },
        select: { id: true, referenceNumber: true, submitterId: true }
      });
      await tx.pigeonholeUpdate.create({
        data: {
          submissionId: submission.id,
          userId: anonymous ? null : user!.id,
          status: "SUBMITTED",
          message: "Submission received."
        }
      });
      await tx.auditLog.create({
        data: {
          userId: anonymous ? null : user!.id,
          action: "PIGEONHOLE_SUBMITTED",
          entityType: "PIGEONHOLE",
          entityId: String(submission.id),
          details: JSON.stringify({ referenceNumber, anonymous }),
          ipAddress: req.ip ?? null
        }
      });
      if (submission.submitterId) {
        await tx.notification.create({
          data: {
            userId: submission.submitterId,
            title: "Feedback received",
            message: `Your submission ${referenceNumber} was received.`
          }
        });
      }
    });

    res.status(201).json({
      message: "Your feedback has been submitted successfully.",
      referenceNumber,
      trackingMethod: "Keep this reference number private; it is the key used to check the submission."
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INACTIVE_ACCOUNT") {
      res.status(403).json({ message: "Your account is not active." });
      return;
    }
    console.error("Pigeonhole submission failed:", error);
    res.status(500).json({ message: "Could not submit your feedback." });
  }
}

// PUT /api/pigeonhole/:id/status — officers and administrators.
export async function updatePigeonholeStatus(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.userId;
    const role = (req as AuthenticatedRequest).user?.role;
    const id = Number(req.params.id);
    const status = req.body?.status;
    if (!userId || !role || !["GOVERNMENT_OFFICER", "SYSTEM_ADMINISTRATOR"].includes(role)) {
      res.status(403).json({ message: "Officer or administrator access is required." });
      return;
    }
    if (!Number.isSafeInteger(id) || id < 1 || typeof status !== "string" || !VALID_STATUSES.includes(status as SubmissionStatus)) {
      res.status(400).json({ message: "A valid submission ID and status are required." });
      return;
    }
    const user = await prisma.user.findFirst({ where: { id: userId, role, accountStatus: "ACTIVE" }, select: { id: true } });
    if (!user) { res.status(403).json({ message: "An active staff account is required." }); return; }
    const existing = await prisma.pigeonholeSubmission.findUnique({ where: { id }, select: { id: true, submitterId: true, referenceNumber: true } });
    if (!existing) { res.status(404).json({ message: "Submission not found." }); return; }

    await prisma.$transaction(async (tx) => {
      await tx.pigeonholeSubmission.update({
        where: { id },
        data: { status: status as SubmissionStatus, ...(status === "CLOSED" ? { closedAt: new Date() } : {}) }
      });
      await tx.pigeonholeUpdate.create({
        data: {
          submissionId: id,
          userId,
          status: status as SubmissionStatus,
          message: typeof req.body?.comment === "string" && req.body.comment.trim()
            ? req.body.comment.trim().slice(0, 5000)
            : `Status changed to ${status.replace(/_/g, " ").toLowerCase()}.`
        }
      });
      await tx.auditLog.create({
        data: { userId, action: "PIGEONHOLE_STATUS_CHANGED", entityType: "PIGEONHOLE", entityId: String(id), details: status, ipAddress: req.ip ?? null }
      });
      if (existing.submitterId) {
        await tx.notification.create({
          data: { userId: existing.submitterId, title: "Submission status changed", message: `${existing.referenceNumber} is now ${status.replace(/_/g, " ").toLowerCase()}.` }
        });
      }
    });
    res.status(200).json({ message: "Submission status updated." });
  } catch (error) {
    console.error("Pigeonhole status update failed:", error);
    res.status(500).json({ message: "Could not update the submission status." });
  }
}

// POST /api/pigeonhole/:id/response — officers and administrators.
export async function respondToPigeonhole(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.userId;
    const role = (req as AuthenticatedRequest).user?.role;
    const id = Number(req.params.id);
    const response = req.body?.response;
    if (!userId || !role || !["GOVERNMENT_OFFICER", "SYSTEM_ADMINISTRATOR"].includes(role)) {
      res.status(403).json({ message: "Officer or administrator access is required." });
      return;
    }
    if (!Number.isSafeInteger(id) || id < 1 || typeof response !== "string" || response.trim().length < 2 || response.trim().length > 5000) {
      res.status(400).json({ message: "Enter a response between 2 and 5,000 characters." });
      return;
    }
    const user = await prisma.user.findFirst({ where: { id: userId, role, accountStatus: "ACTIVE" }, select: { id: true } });
    if (!user) { res.status(403).json({ message: "An active staff account is required." }); return; }
    const existing = await prisma.pigeonholeSubmission.findUnique({ where: { id }, select: { id: true, submitterId: true, referenceNumber: true } });
    if (!existing) { res.status(404).json({ message: "Submission not found." }); return; }

    await prisma.$transaction(async (tx) => {
      await tx.pigeonholeSubmission.update({
        where: { id },
        data: { response: response.trim(), status: "RESPONSE_PROVIDED" }
      });
      await tx.pigeonholeUpdate.create({
        data: { submissionId: id, userId, status: "RESPONSE_PROVIDED", message: response.trim() }
      });
      await tx.auditLog.create({
        data: { userId, action: "PIGEONHOLE_RESPONSE_CREATED", entityType: "PIGEONHOLE", entityId: String(id), details: existing.referenceNumber, ipAddress: req.ip ?? null }
      });
      if (existing.submitterId) {
        await tx.notification.create({
          data: { userId: existing.submitterId, title: "Response provided", message: `A response is available for ${existing.referenceNumber}.` }
        });
      }
    });
    res.status(200).json({ message: "Response sent successfully." });
  } catch (error) {
    console.error("Pigeonhole response failed:", error);
    res.status(500).json({ message: "Could not send the response." });
  }
}
