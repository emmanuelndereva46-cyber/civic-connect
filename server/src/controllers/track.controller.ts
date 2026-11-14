import type { Request, Response } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "../config/prisma.js";

export async function trackPigeonhole(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const referenceNumber = String(req.query.ref ?? "").trim();
    const accessCode = String(req.query.code ?? "").trim();

    if (
      !referenceNumber ||
      referenceNumber.length > 30 ||
      !accessCode ||
      accessCode.length > 200
    ) {
      res.status(400).json({
        message: "Enter a valid reference number and access code."
      });
      return;
    }

    const submission = await prisma.pigeonholeSubmission.findUnique({
      where: { referenceNumber },
      select: {
        referenceNumber: true,
        status: true,
        response: true,
        accessCodeHash: true
      }
    });

    if (!submission?.accessCodeHash) {
      res.status(404).json({
        message: "Submission not found or access details are incorrect."
      });
      return;
    }

    const suppliedHash = createHash("sha256")
      .update(accessCode)
      .digest();

    const storedHash = Buffer.from(submission.accessCodeHash, "hex");

    if (
      storedHash.length !== suppliedHash.length ||
      !timingSafeEqual(storedHash, suppliedHash)
    ) {
      res.status(404).json({
        message: "Submission not found or access details are incorrect."
      });
      return;
    }

    res.status(200).json({
      referenceNumber: submission.referenceNumber,
      status: submission.status,
      response: submission.response
    });
  } catch (error) {
    console.error("Pigeonhole tracking failed:", error);
    res.status(500).json({
      message: "Could not track this submission."
    });
  }
}
