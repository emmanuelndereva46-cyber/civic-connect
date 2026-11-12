import jwt from "jsonwebtoken";
const configuredSecret = process.env.JWT_SECRET;
if (!configuredSecret || configuredSecret.length < 32) {
    throw new Error("JWT_SECRET must be configured with at least 32 characters.");
}
const jwtSecret = configuredSecret;
export function createAccessToken(payload) {
    return jwt.sign(payload, jwtSecret, {
        expiresIn: "1h",
        issuer: "civicconnect-api",
        audience: "civicconnect-client"
    });
}
export function verifyAccessToken(token) {
    const decoded = jwt.verify(token, jwtSecret, {
        issuer: "civicconnect-api",
        audience: "civicconnect-client"
    });
    const validRoles = [
        "CITIZEN",
        "GOVERNMENT_OFFICER",
        "SYSTEM_ADMINISTRATOR"
    ];
    if (typeof decoded.userId !== "number" ||
        !validRoles.includes(String(decoded.role))) {
        throw new Error("Invalid authentication token.");
    }
    return {
        userId: decoded.userId,
        role: decoded.role
    };
}
//# sourceMappingURL=jwt.js.map