import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    role: "CITIZEN" | "GOVERNMENT_OFFICER" | "SYSTEM_ADMINISTRATOR";
  };
}

const SESSION_COOKIE = "civicconnect_session";

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      try { return decodeURIComponent(part.slice(separator + 1).trim()); }
      catch { return null; }
    }
  }
  return null;
}

export function getSessionToken(req: Request): string | null {
  const cookieToken = readCookie(req, SESSION_COOKIE);
  if (cookieToken) return cookieToken;
  const authorization = req.headers.authorization;
  return authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() || null : null;
}

export function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = getSessionToken(req);
  if (!token) {
    res.status(401).json({ message: "Authentication required." });
    return;
  }
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired authentication session." });
  }
}

export function requireRoles(
  ...allowedRoles: NonNullable<AuthenticatedRequest["user"]>["role"][]
) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "Authentication required." });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ message: "You do not have permission to perform this action." });
      return;
    }
    next();
  };
}
