import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "../config/prisma.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";

function currentAdmin(req: Request) {
  return (req as AuthenticatedRequest).user?.userId ?? null;
}

export async function getAdminStats(_req: Request, res: Response): Promise<void> {
  try {
    const [
      totalUsers, totalCitizens, totalOfficers, totalReports, totalPigeonhole,
      pigeonholeAnonymous, reportStatuses, reportCategories, pigeonholeStatuses, pigeonholeTypes
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "CITIZEN" } }),
      prisma.user.count({ where: { role: "GOVERNMENT_OFFICER" } }),
      prisma.report.count(),
      prisma.pigeonholeSubmission.count(),
      prisma.pigeonholeSubmission.count({ where: { isAnonymous: true } }),
      prisma.report.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.report.groupBy({ by: ["categoryId"], _count: { _all: true } }),
      prisma.pigeonholeSubmission.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.pigeonholeSubmission.groupBy({ by: ["type"], _count: { _all: true } })
    ]);
    const categoryIds = reportCategories.map((item) => item.categoryId);
    const categories = categoryIds.length
      ? await prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } })
      : [];
    const categoryNames = new Map(categories.map((item) => [item.id, item.name]));
    res.status(200).json({
      totalUsers, totalCitizens, totalOfficers, totalReports, totalPigeonhole, pigeonholeAnonymous,
      reportsByStatus: reportStatuses.map((item) => ({ key: item.status, count: item._count._all })),
      reportsByCategory: reportCategories.map((item) => ({ key: categoryNames.get(item.categoryId) ?? "Uncategorized", count: item._count._all })),
      pigeonholeByStatus: pigeonholeStatuses.map((item) => ({ key: item.status, count: item._count._all })),
      pigeonholeByType: pigeonholeTypes.map((item) => ({ key: item.type, count: item._count._all }))
    });
  } catch (error) {
    console.error("Admin statistics failed:", error);
    res.status(500).json({ message: "Could not retrieve dashboard statistics." });
  }
}

export async function listUsers(req: Request, res: Response): Promise<void> {
  try {
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
    const requestedRole = typeof req.query.role === "string" ? req.query.role : "";
    const roleMap: Record<string, "CITIZEN" | "GOVERNMENT_OFFICER" | "SYSTEM_ADMINISTRATOR"> = {
      CITIZEN: "CITIZEN", OFFICER: "GOVERNMENT_OFFICER", ADMIN: "SYSTEM_ADMINISTRATOR"
    };
    if (requestedRole && !roleMap[requestedRole]) {
      res.status(400).json({ message: "Invalid role filter." }); return;
    }
    const users = await prisma.user.findMany({
      where: {
        ...(search ? { OR: [{ fullName: { contains: search } }, { email: { contains: search } }] } : {}),
        ...(requestedRole ? { role: roleMap[requestedRole] } : {})
      },
      select: {
        id: true, fullName: true, email: true, phone: true, role: true,
        accountStatus: true, department: { select: { id: true, name: true } },
        createdAt: true
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });
    res.status(200).json(users.map((user) => ({
      id: user.id, fullName: user.fullName, email: user.email, phone: user.phone,
      role: user.role === "GOVERNMENT_OFFICER" ? "OFFICER" : user.role === "SYSTEM_ADMINISTRATOR" ? "ADMIN" : "CITIZEN",
      status: user.accountStatus, department: user.department
    })));
  } catch (error) {
    console.error("Admin user listing failed:", error);
    res.status(500).json({ message: "Could not retrieve users." });
  }
}

export async function createStaffUser(req: Request, res: Response): Promise<void> {
  try {
    const adminId = currentAdmin(req);
    const { fullName, email, role, departmentId } = req.body ?? {};
    if (!adminId) { res.status(401).json({ message: "Authentication required." }); return; }
    if (typeof fullName !== "string" || fullName.trim().length < 2 || fullName.trim().length > 150 ||
        typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        !["OFFICER", "ADMIN"].includes(role)) {
      res.status(400).json({ message: "Provide a valid name, email and staff role." }); return;
    }
    let departmentIdToAssign: number | null = null;
    if (role === "OFFICER") {
      const id = Number(departmentId);
      if (!Number.isSafeInteger(id) || id < 1) { res.status(400).json({ message: "Select a department for this officer." }); return; }
      const department = await prisma.department.findFirst({ where: { id, isActive: true }, select: { id: true } });
      if (!department) { res.status(400).json({ message: "Selected department is unavailable." }); return; }
      departmentIdToAssign = department.id;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (await prisma.user.findUnique({ where: { email: cleanEmail }, select: { id: true } })) {
      res.status(409).json({ message: "An account with this email already exists." }); return;
    }
    const temporaryPassword = randomBytes(15).toString("base64url");
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const user = await prisma.user.create({
      data: {
        fullName: fullName.trim(), email: cleanEmail, passwordHash,
        role: role === "OFFICER" ? "GOVERNMENT_OFFICER" : "SYSTEM_ADMINISTRATOR",
        accountStatus: "ACTIVE", departmentId: departmentIdToAssign
      },
      select: { id: true, fullName: true, email: true, role: true }
    });
    await prisma.auditLog.create({
      data: { userId: adminId, action: "STAFF_USER_CREATED", entityType: "USER", entityId: String(user.id), details: user.role, ipAddress: req.ip ?? null }
    });
    res.status(201).json({
      id: user.id, email: user.email,
      temporaryPassword,
      message: "Account created. Share the temporary password securely and ask the user to change it after first sign-in."
    });
  } catch (error) {
    console.error("Staff account creation failed:", error);
    res.status(500).json({ message: "Could not create the staff account." });
  }
}

export async function updateUserStatus(req: Request, res: Response): Promise<void> {
  try {
    const adminId = currentAdmin(req);
    const userId = Number(req.params.id);
    const status = req.body?.status;
    if (!adminId) { res.status(401).json({ message: "Authentication required." }); return; }
    if (!Number.isSafeInteger(userId) || userId < 1 || !["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status)) {
      res.status(400).json({ message: "Provide a valid user ID and account status." }); return;
    }
    if (userId === adminId && status !== "ACTIVE") {
      res.status(409).json({ message: "You cannot deactivate your own administrator account." }); return;
    }
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, accountStatus: true } });
    if (!target) { res.status(404).json({ message: "User not found." }); return; }
    if (target.role === "SYSTEM_ADMINISTRATOR" && target.accountStatus === "ACTIVE" && status !== "ACTIVE") {
      const activeAdmins = await prisma.user.count({ where: { role: "SYSTEM_ADMINISTRATOR", accountStatus: "ACTIVE" } });
      if (activeAdmins <= 1) { res.status(409).json({ message: "The last active administrator cannot be deactivated." }); return; }
    }
    await prisma.user.update({ where: { id: userId }, data: { accountStatus: status } });
    await prisma.auditLog.create({
      data: { userId: adminId, action: "USER_STATUS_CHANGED", entityType: "USER", entityId: String(userId), details: status, ipAddress: req.ip ?? null }
    });
    res.status(200).json({ message: "Account status updated." });
  } catch (error) {
    console.error("User status update failed:", error);
    res.status(500).json({ message: "Could not update account status." });
  }
}

export async function listAuditLogs(_req: Request, res: Response): Promise<void> {
  try {
    const logs = await prisma.auditLog.findMany({
      select: {
        id: true, userId: true, action: true, entityType: true, entityId: true,
        details: true, ipAddress: true, createdAt: true
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });
    res.status(200).json(logs.map((log) => ({ ...log, description: log.details })));
  } catch (error) {
    console.error("Audit log retrieval failed:", error);
    res.status(500).json({ message: "Could not retrieve audit logs." });
  }
}

// One-time setup endpoint. Set ADMIN_BOOTSTRAP_TOKEN in Vercel, then call this
// only if no administrator exists. It never returns or generates a password.
export async function bootstrapFirstAdmin(req: Request, res: Response): Promise<void> {
  try {
    const configuredToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
    const suppliedToken = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7).trim()
      : "";
    if (!configuredToken || configuredToken.length < 32) {
      res.status(503).json({ message: "Administrator bootstrap is not configured." }); return;
    }
    const expected = Buffer.from(configuredToken);
    const supplied = Buffer.from(suppliedToken);
    if (!suppliedToken || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      res.status(401).json({ message: "Valid bootstrap authorization is required." }); return;
    }
    const existingAdmins = await prisma.user.count({ where: { role: "SYSTEM_ADMINISTRATOR" } });
    if (existingAdmins > 0) { res.status(409).json({ message: "An administrator already exists; bootstrap is permanently closed." }); return; }
    const { fullName, email, password } = req.body ?? {};
    if (typeof fullName !== "string" || fullName.trim().length < 2 || fullName.trim().length > 150 ||
        typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        typeof password !== "string" || password.length < 12 || password.length > 72) {
      res.status(400).json({ message: "Provide a valid name, email and a password of at least 12 characters." }); return;
    }
    const cleanEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail }, select: { id: true } });
    if (existing) { res.status(409).json({ message: "An account with that email already exists." }); return; }
    const user = await prisma.user.create({
      data: { fullName: fullName.trim(), email: cleanEmail, passwordHash: await bcrypt.hash(password, 12), role: "SYSTEM_ADMINISTRATOR", accountStatus: "ACTIVE" },
      select: { id: true, fullName: true, email: true }
    });
    await prisma.auditLog.create({
      data: { userId: user.id, action: "INITIAL_ADMIN_BOOTSTRAPPED", entityType: "USER", entityId: String(user.id), ipAddress: req.ip ?? null }
    });
    res.status(201).json({ message: "Initial administrator created. Remove ADMIN_BOOTSTRAP_TOKEN from Vercel immediately.", user });
  } catch (error) {
    console.error("Initial administrator bootstrap failed:", error);
    res.status(500).json({ message: "Could not create the initial administrator." });
  }
}
