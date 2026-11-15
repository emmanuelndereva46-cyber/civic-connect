import type { Request, Response } from "express";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../config/prisma.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { getSessionToken } from "../middleware/auth.middleware.js";

const VALID_TYPES = [
  "SUGGESTION",
  "COMPLAINT",
  "FEEDBACK",
  "CONCERN",
  "COMPLIMENT",
  "OTHER"
] as const;

type SubmissionType = typeof VALID_TYPES[number];

function hashAccessCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

async function getOptionalUser(
  req: Request
): Promise<number | null> {
  const token = getSessionToken(req);

  if (!token) return null;

  const payload = verifyAccessToken(token);

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      role: true,
      accountStatus: true
    }
  });

  if (!user || user.accountStatus !== "ACTIVE" || user.role !== payload.role) {
    throw new Error("INACTIVE_ACCOUNT");
  }

  return user.id;
}

// GET /api/pigeonhole
// Return submissions belonging to the authenticated user.
export async function getMyPigeonholeSubmissions(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = (req as Request & {
      user?: { userId: number }
    }).user?.userId;

    if (!userId) {
      res.status(401).json({ message: "Authentication required." });
      return;
    }

    const submissions = await prisma.pigeonholeSubmission.findMany({
      where: { submitterId: userId },
      select: {
        id: true,
        referenceNumber: true,
        type: true,
        subject: true,
        status: true,
        response: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" }
    });

    res.status(200).json(
      submissions.map((submission) => ({
        ...submission,
        submissionType: submission.type
      }))
    );
  } catch (error) {
    console.error("Pigeonhole retrieval failed:", error);
    res.status(500).json({
      message: "Could not retrieve your submissions."
    });
  }
}

// POST /api/pigeonhole
// Accept anonymous or authenticated submissions.
export async function submitPigeonhole(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = await getOptionalUser(req);

    const {
      submissionType,
      subject,
      message,
      departmentId,
      anonymous,
      consent
    } = req.body ?? {};

    if (
      typeof submissionType !== "string" ||
      !VALID_TYPES.includes(submissionType as SubmissionType)
    ) {
      res.status(400).json({
        message: "Select a valid submission type."
      });
      return;
    }

    if (
      typeof subject !== "string" ||
      subject.trim().length < 3 ||
      subject.trim().length > 200
    ) {
      res.status(400).json({
        message: "Subject must contain between 3 and 200 characters."
      });
      return;
    }

    if (
      typeof message !== "string" ||
      message.trim().length < 10 ||
      message.trim().length > 20000
    ) {
      res.status(400).json({
        message: "Message must contain between 10 and 20,000 characters."
      });
      return;
    }

    if (typeof anonymous !== "boolean") {
      res.status(400).json({
        message: "Specify whether this submission is anonymous."
      });
      return;
    }

    if (consent !== true) {
      res.status(400).json({
        message: "Privacy notice acknowledgement is required."
      });
      return;
    }

    if (!userId && !anonymous) {
      res.status(401).json({
        message: "Sign in before submitting with your identity attached."
      });
      return;
    }

    let selectedDepartmentId: number | null = null;

    if (departmentId !== null && departmentId !== undefined && departmentId !== "") {
      const parsedId = Number(departmentId);

      if (!Number.isSafeInteger(parsedId) || parsedId <= 0) {
        res.status(400).json({
          message: "Select a valid department."
        });
        return;
      }

      const department = await prisma.department.findFirst({
        where: {
          id: parsedId,
          isActive: true
        },
        select: { id: true }
      });

      if (!department) {
        res.status(400).json({
          message: "The selected department is unavailable."
        });
        return;
      }

      selectedDepartmentId = department.id;
    }

    const type = submissionType as SubmissionType;

    const category = await prisma.pigeonholeCategory.findFirst({
      where: {
        name: type,
        isActive: true
      },
      select: { id: true }
    });

    if (!category) {
      res.status(400).json({
        message: "This submission category is currently unavailable."
      });
      return;
    }

    const accessCode = anonymous ? randomBytes(24).toString("base64url") : null;
    const accessCodeHash = accessCode ? hashAccessCode(accessCode) : null;

    let referenceNumber = "";

    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate =
        `PC-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-` +
        randomBytes(4).toString("hex").toUpperCase();

      const existing = await prisma.pigeonholeSubmission.findUnique({
        where: { referenceNumber: candidate },
        select: { id: true }
      });

      if (!existing) {
        referenceNumber = candidate;
        break;
      }
    }

    if (!referenceNumber) {
      res.status(503).json({
        message: "Could not generate a submission reference. Please try again."
      });
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
          submitterId: anonymous ? null : userId,
          categoryId: category.id,
          departmentId: selectedDepartmentId,
          accessCodeHash
        }
      });

      await tx.pigeonholeUpdate.create({
        data: {
          submissionId: submission.id,
          userId: anonymous ? null : userId,
          status: "SUBMITTED",
          message: "Submission received."
        }
      });
    });

    res.status(201).json({
      message: "Your feedback has been submitted successfully.",
      referenceNumber,
      ...(accessCode ? { accessCode } : {})
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_TOKEN") {
      res.status(401).json({
        message: "Your authentication token is invalid or expired."
      });
      return;
    }

    if (error instanceof Error && error.message === "INACTIVE_ACCOUNT") {
      res.status(403).json({
        message: "Your account is not active."
      });
      return;
    }

    console.error("Pigeonhole submission failed:", error);

    res.status(500).json({
      message: "Could not submit your feedback."
    });
  }
}
