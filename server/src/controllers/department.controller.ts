import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

export async function getActiveDepartments(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true
      },
      orderBy: { name: "asc" }
    });

    res.status(200).json(departments);
  } catch (error) {
    console.error("Department retrieval failed:", error);
    res.status(500).json({
      message: "Could not retrieve departments."
    });
  }
}
