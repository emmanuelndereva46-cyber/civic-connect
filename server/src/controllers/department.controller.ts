import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";

export async function getActiveDepartments(_req: Request, res: Response): Promise<void> {
  try {
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      select: { id: true, name: true, description: true },
      orderBy: { name: "asc" }
    });
    res.status(200).json(departments);
  } catch (error) {
    console.error("Department retrieval failed:", error);
    res.status(500).json({ message: "Could not retrieve departments." });
  }
}

export async function createDepartment(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.userId;
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
    if (!userId) { res.status(401).json({ message: "Authentication required." }); return; }
    if (name.length < 2 || name.length > 120 || description.length > 2000) {
      res.status(400).json({ message: "Department name must be 2-120 characters; description cannot exceed 2,000 characters." }); return;
    }
    const existing = await prisma.department.findUnique({ where: { name }, select: { id: true } });
    if (existing) { res.status(409).json({ message: "A department with that name already exists." }); return; }
    const department = await prisma.department.create({
      data: { name, description: description || null },
      select: { id: true, name: true, description: true, isActive: true }
    });
    await prisma.auditLog.create({
      data: { userId, action: "DEPARTMENT_CREATED", entityType: "DEPARTMENT", entityId: String(department.id), details: department.name, ipAddress: req.ip ?? null }
    });
    res.status(201).json(department);
  } catch (error) {
    console.error("Department creation failed:", error);
    res.status(500).json({ message: "Could not create department." });
  }
}

export async function getActiveCategories(_req: Request, res: Response): Promise<void> {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, description: true,
        department: { select: { id: true, name: true, isActive: true } }
      },
      orderBy: { name: "asc" }
    });
    const available = categories.filter((category) => !category.department || category.department.isActive);
    res.status(200).json(available.map((category) => ({
      ...category,
      departmentName: category.department?.name ?? null
    })));
  } catch (error) {
    console.error("Category retrieval failed:", error);
    res.status(500).json({ message: "Could not retrieve categories." });
  }
}

export async function createCategory(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.userId;
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
    const departmentId = Number(req.body?.departmentId);
    if (!userId) { res.status(401).json({ message: "Authentication required." }); return; }
    if (name.length < 2 || name.length > 100 || description.length > 2000 ||
        !Number.isSafeInteger(departmentId) || departmentId < 1) {
      res.status(400).json({ message: "Provide a valid category name and department." }); return;
    }
    const department = await prisma.department.findFirst({
      where: { id: departmentId, isActive: true }, select: { id: true }
    });
    if (!department) { res.status(400).json({ message: "Selected department is unavailable." }); return; }
    if (await prisma.category.findUnique({ where: { name }, select: { id: true } })) {
      res.status(409).json({ message: "A category with that name already exists." }); return;
    }
    const category = await prisma.category.create({
      data: { name, description: description || null, departmentId },
      select: { id: true, name: true, description: true, department: { select: { id: true, name: true } } }
    });
    await prisma.auditLog.create({
      data: { userId, action: "CATEGORY_CREATED", entityType: "CATEGORY", entityId: String(category.id), details: category.name, ipAddress: req.ip ?? null }
    });
    res.status(201).json({ ...category, departmentName: category.department?.name ?? null });
  } catch (error) {
    console.error("Category creation failed:", error);
    res.status(500).json({ message: "Could not create category." });
  }
}
