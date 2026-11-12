
import jwt, { type JwtPayload } from "jsonwebtoken";

const configuredSecret = process.env.JWT_SECRET;

if (!configuredSecret || configuredSecret.length < 32) {
  throw new Error(
    "JWT_SECRET must be configured with at least 32 characters."
  );
}

const jwtSecret: string = configuredSecret;

export interface AuthTokenPayload {
  userId: number;
  role: "CITIZEN" | "GOVERNMENT_OFFICER" | "SYSTEM_ADMINISTRATOR";
}

export function createAccessToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, jwtSecret, {
    expiresIn: "1h",
    issuer: "civicconnect-api",
    audience: "civicconnect-client"
  });
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, jwtSecret, {
    issuer: "civicconnect-api",
    audience: "civicconnect-client"
  }) as JwtPayload;

  const validRoles = [
    "CITIZEN",
    "GOVERNMENT_OFFICER",
    "SYSTEM_ADMINISTRATOR"
  ];

  if (
    typeof decoded.userId !== "number" ||
    !validRoles.includes(String(decoded.role))
  ) {
    throw new Error("Invalid authentication token.");
  }

  return {
    userId: decoded.userId,
    role: decoded.role as AuthTokenPayload["role"]
  };
}

