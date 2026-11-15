import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

export async function trackReportByReference(req: Request, res: Response): Promise<void> {
  try {
    const referenceNumber = String(req.params.referenceNumber ?? "").trim().toUpperCase();
    if (!/^CC-[A-F0-9]{26}$/.test(referenceNumber)) {
      res.status(400).json({ message: "Enter a valid report reference number." });
      return;
    }
    const report = await prisma.report.findUnique({
      where: { referenceNumber },
      select: {
        referenceNumber: true, title: true, status: true, createdAt: true,
        resolvedAt: true,
        department: { select: { id: true, name: true } },
        updates: {
          where: { isPublic: true },
          select: { id: true, status: true, comment: true, createdAt: true },
          orderBy: { createdAt: "asc" }
        }
      }
    });
    if (!report) { res.status(404).json({ message: "Report not found." }); return; }
    res.status(200).json({ ...report, submittedAt: report.createdAt });
  } catch (error) {
    console.error("Report tracking failed:", error);
    res.status(500).json({ message: "Could not track this report." });
  }
}

export async function trackPigeonhole(req: Request, res: Response): Promise<void> {
  try {
    const referenceNumber = String(req.query.ref ?? "").trim().toUpperCase();
    if (!/^PG-[A-F0-9]{26}$/.test(referenceNumber)) {
      res.status(400).json({ message: "Enter a valid Pigeonhole reference number." });
      return;
    }

    // The 104-bit random reference is itself the tracking credential. The
    // existing TiDB schema has no separate access-code hash column.
    const submission = await prisma.pigeonholeSubmission.findUnique({
      where: { referenceNumber },
      select: { referenceNumber: true, status: true, response: true, isAnonymous: true }
    });
    if (!submission) {
      res.status(404).json({ message: "Submission not found or reference is incorrect." });
      return;
    }
    res.status(200).json({
      referenceNumber: submission.referenceNumber,
      status: submission.status,
      response: submission.response
    });
  } catch (error) {
    console.error("Pigeonhole tracking failed:", error);
    res.status(500).json({ message: "Could not track this submission." });
  }
}
