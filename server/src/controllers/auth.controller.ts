import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";
import { createAccessToken } from "../utils/jwt.js";

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
