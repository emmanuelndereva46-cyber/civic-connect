import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";
import { createAccessToken } from "../utils/jwt.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COOKIE_NAME = "civicconnect_session";
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL),
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 1000
};

function setSession(res: Response, user: { id: number; role: "CITIZEN" | "GOVERNMENT_OFFICER" | "SYSTEM_ADMINISTRATOR" }) {
  res.cookie(COOKIE_NAME, createAccessToken({ userId: user.id, role: user.role }), cookieOptions);
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { fullName, email, phone, password } = req.body ?? {};
    if (typeof fullName !== "string" || typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({ message: "Full name, email, and password are required." }); return;
    }
    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = typeof phone === "string" && phone.trim() ? phone.trim() : null;
    if (cleanName.length < 2 || cleanName.length > 150) {
      res.status(400).json({ message: "Full name must be between 2 and 150 characters." }); return;
    }
    if (!emailPattern.test(cleanEmail) || cleanEmail.length > 191) {
      res.status(400).json({ message: "Enter a valid email address." }); return;
    }
    if (password.length < 8 || password.length > 72) {
      res.status(400).json({ message: "Password must be between 8 and 72 characters." }); return;
    }
    if (phone !== undefined && phone !== null && typeof phone !== "string") {
      res.status(400).json({ message: "Phone number must be a string." }); return;
    }
    if (cleanPhone && cleanPhone.length > 30) {
      res.status(400).json({ message: "Phone number must not exceed 30 characters." }); return;
    }
    const existingEmail = await prisma.user.findUnique({ where: { email: cleanEmail }, select: { id: true } });
    if (existingEmail) { res.status(409).json({ message: "An account with this email already exists." }); return; }
    if (cleanPhone) {
      const existingPhone = await prisma.user.findUnique({ where: { phone: cleanPhone }, select: { id: true } });
      if (existingPhone) { res.status(409).json({ message: "An account with this phone number already exists." }); return; }
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { fullName: cleanName, email: cleanEmail, phone: cleanPhone, passwordHash, role: "CITIZEN" },
      select: { id: true, fullName: true, email: true, phone: true, role: true, accountStatus: true, createdAt: true }
    });
    setSession(res, user);
    res.status(201).json({ message: "Account registered successfully.", user });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Unable to complete registration at this time." });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      res.status(400).json({ message: "Email and password are required." }); return;
    }
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ message: "Invalid email or password." }); return;
    }
    if (user.accountStatus !== "ACTIVE") {
      res.status(403).json({ message: "This account is not active. Contact support." }); return;
    }
    setSession(res, user);
    res.status(200).json({
      message: "Login successful.",
      user: { id: user.id, fullName: user.fullName, email: user.email, phone: user.phone, role: user.role, accountStatus: user.accountStatus, createdAt: user.createdAt }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Unable to complete login at this time." });
  }
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL),
    sameSite: "lax",
    path: "/"
  });
  res.status(200).json({ message: "Logged out successfully." });
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.userId;
    if (!userId) { res.status(401).json({ message: "Authentication required." }); return; }
    const { fullName, phone } = req.body ?? {};
    if (typeof fullName !== "string" || fullName.trim().length < 2 || fullName.trim().length > 150) {
      res.status(400).json({ message: "Full name must contain between 2 and 150 characters." }); return;
    }
    if (phone !== undefined && phone !== null && typeof phone !== "string") {
      res.status(400).json({ message: "Phone number must be a string." }); return;
    }
    const cleanPhone = typeof phone === "string" && phone.trim() ? phone.trim() : null;
    if (cleanPhone && cleanPhone.length > 30) {
      res.status(400).json({ message: "Phone number must not exceed 30 characters." }); return;
    }
    if (cleanPhone) {
      const duplicate = await prisma.user.findFirst({
        where: { phone: cleanPhone, id: { not: userId } },
        select: { id: true }
      });
      if (duplicate) { res.status(409).json({ message: "That phone number is already in use." }); return; }
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data: { fullName: fullName.trim(), phone: cleanPhone },
      select: { id: true, fullName: true, email: true, phone: true, role: true, accountStatus: true, createdAt: true }
    });
    await prisma.auditLog.create({
      data: { userId, action: "PROFILE_UPDATED", entityType: "USER", entityId: String(userId), ipAddress: req.ip ?? null }
    });
    res.status(200).json({ message: "Profile updated.", user });
  } catch (error) {
    console.error("Profile update failed:", error);
    res.status(500).json({ message: "Could not update your profile." });
  }
}

export function requestPasswordReset(_req: Request, res: Response): void {
  // Do not pretend to send a reset email. No email delivery provider is
  // configured for this deployment yet.
  res.status(503).json({
    message: "Password reset is temporarily unavailable because email delivery has not been configured. Contact the system administrator."
  });
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.userId;
    const { currentPassword, newPassword } = req.body ?? {};
    if (!userId) { res.status(401).json({ message: "Authentication required." }); return; }
    if (typeof currentPassword !== "string" || typeof newPassword !== "string" ||
        newPassword.length < 12 || newPassword.length > 72 ||
        !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      res.status(400).json({ message: "New password must be 12-72 characters and include an uppercase letter and a number." }); return;
    }
    const user = await prisma.user.findFirst({
      where: { id: userId, accountStatus: "ACTIVE" },
      select: { id: true, role: true, passwordHash: true }
    });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      res.status(400).json({ message: "Current password is incorrect." }); return;
    }
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      res.status(400).json({ message: "Choose a new password different from your current password." }); return;
    }
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(newPassword, 12) }
    });
    await prisma.auditLog.create({
      data: { userId, action: "PASSWORD_CHANGED", entityType: "USER", entityId: String(userId), ipAddress: req.ip ?? null }
    });
    res.status(200).json({ message: "Password changed successfully." });
  } catch (error) {
    console.error("Password change failed:", error);
    res.status(500).json({ message: "Could not change your password." });
  }
}
