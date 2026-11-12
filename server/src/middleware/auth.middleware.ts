
import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt.js";


export interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    role:
      | "CITIZEN"
      | "GOVERNMENT_OFFICER"
      | "SYSTEM_ADMINISTRATOR";
  };
}

export function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    res.status(401).json({
      message: "Authentication required. Provide a valid Bearer token."
    });
    return;
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    res.status(401).json({
      message: "Authentication token is missing."
    });
    return;
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({
      message: "Invalid or expired authentication token."
    });
  }
}
