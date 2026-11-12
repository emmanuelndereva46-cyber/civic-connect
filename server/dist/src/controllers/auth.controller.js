import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";
import { createAccessToken } from "../utils/jwt.js";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export async function register(req, res) {
    try {
        const { fullName, email, phone, password } = req.body ?? {};
        if (typeof fullName !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string") {
            return res.status(400).json({
                message: "Full name, email, and password are required."
            });
        }
        const cleanName = fullName.trim();
        const cleanEmail = email.trim().toLowerCase();
        const cleanPhone = typeof phone === "string" && phone.trim()
            ? phone.trim()
            : null;
        if (cleanName.length < 2 || cleanName.length > 150) {
            return res.status(400).json({
                message: "Full name must be between 2 and 150 characters."
            });
        }
        if (!emailPattern.test(cleanEmail) || cleanEmail.length > 191) {
            return res.status(400).json({
                message: "Enter a valid email address."
            });
        }
        if (password.length < 8 || password.length > 72) {
            return res.status(400).json({
                message: "Password must be between 8 and 72 characters."
            });
        }
        if (phone !== undefined &&
            phone !== null &&
            typeof phone !== "string") {
            return res.status(400).json({
                message: "Phone number must be a string."
            });
        }
        if (cleanPhone && cleanPhone.length > 30) {
            return res.status(400).json({
                message: "Phone number must not exceed 30 characters."
            });
        }
        const existingEmail = await prisma.user.findUnique({
            where: { email: cleanEmail },
            select: { id: true }
        });
        if (existingEmail) {
            return res.status(409).json({
                message: "An account with this email already exists."
            });
        }
        if (cleanPhone) {
            const existingPhone = await prisma.user.findUnique({
                where: { phone: cleanPhone },
                select: { id: true }
            });
            if (existingPhone) {
                return res.status(409).json({
                    message: "An account with this phone number already exists."
                });
            }
        }
        const passwordHash = await bcrypt.hash(password, 12);
        const user = await prisma.user.create({
            data: {
                fullName: cleanName,
                email: cleanEmail,
                phone: cleanPhone,
                passwordHash,
                role: "CITIZEN"
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                role: true,
                accountStatus: true,
                createdAt: true
            }
        });
        const token = createAccessToken({
            userId: user.id,
            role: user.role
        });
        return res.status(201).json({
            message: "Account registered successfully.",
            token,
            user
        });
    }
    catch (error) {
        console.error("Registration error:", error);
        return res.status(500).json({
            message: "Unable to complete registration at this time."
        });
    }
}
export async function login(req, res) {
    try {
        const { email, password } = req.body ?? {};
        if (typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password) {
            return res.status(400).json({
                message: "Email and password are required."
            });
        }
        const cleanEmail = email.trim().toLowerCase();
        const user = await prisma.user.findUnique({
            where: { email: cleanEmail }
        });
        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }
        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }
        if (user.accountStatus !== "ACTIVE") {
            return res.status(403).json({
                message: "This account is not active. Contact support."
            });
        }
        const token = createAccessToken({
            userId: user.id,
            role: user.role
        });
        return res.status(200).json({
            message: "Login successful.",
            token,
            user: {
                id: user.id,
                fullName: user.fullName,
                email: user.email,
                phone: user.phone,
                role: user.role,
                accountStatus: user.accountStatus,
                createdAt: user.createdAt
            }
        });
    }
    catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({
            message: "Unable to complete login at this time."
        });
    }
}
//# sourceMappingURL=auth.controller.js.map