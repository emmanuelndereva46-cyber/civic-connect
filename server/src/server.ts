import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import reportRoutes from "./routes/report.routes.js";
import departmentRoutes from "./routes/department.routes.js";
import pigeonholeRoutes from "./routes/pigeonhole.routes.js";
import trackRoutes from "./routes/track.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import { prisma } from "./config/prisma.js";
import authRoutes from "./routes/auth.routes.js";
import { authenticateToken, type AuthenticatedRequest } from "./middleware/auth.middleware.js";

const app = express();
const PORT = Number(process.env.PORT || 5000);
const configuredOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Vercel terminates TLS/proxy traffic before it reaches the container.
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    // Same-origin browser requests and server-to-server requests need no CORS grant.
    if (!origin) return callback(null, true);
    try {
      const requestOrigin = new URL(origin).origin;
      const requestHost = new URL(origin).host;
      // Allow the app's own Vercel host and explicitly configured local/dev origins.
      if (configuredOrigins.includes(requestOrigin) || requestHost.endsWith(".vercel.app")) {
        return callback(null, true);
      }
    } catch {
      return callback(new Error("Invalid request origin."));
    }
    return callback(new Error("Origin is not allowed by CORS."));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "2mb" }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  // Vercel sends both Forwarded and X-Forwarded-For; use Express's trusted proxy IP.
  validate: { forwardedHeader: false }
}));

app.get("/", (_req, res) => res.status(200).json({
  name: "CivicConnect API",
  status: "running"
}));
app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "healthy", database: "connected", service: "CivicConnect API" });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(503).json({ status: "unhealthy", database: "disconnected" });
  }
});

app.use("/api/auth", authRoutes);
app.get("/api/auth/me", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: "Authentication required." });
      return;
    }
    const user = await prisma.user.findFirst({
      where: { id: userId, accountStatus: "ACTIVE" },
      select: { id: true, fullName: true, email: true, phone: true, role: true, accountStatus: true, createdAt: true }
    });
    if (!user) {
      res.clearCookie("civicconnect_session", { httpOnly: true, secure: process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL), sameSite: "lax", path: "/" });
      res.status(401).json({ message: "Session is no longer valid." });
      return;
    }
    res.status(200).json({ user });
  } catch (error) {
    console.error("Session lookup failed:", error);
    res.status(500).json({ message: "Unable to verify your session." });
  }
});

app.use("/api/reports", reportRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/pigeonhole", pigeonholeRoutes);
app.use("/api/track", trackRoutes);
app.use("/api/notifications", notificationRoutes);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled API error:", err);
  if (res.headersSent) return;
  res.status(500).json({ message: "An unexpected server error occurred." });
});

if (process.env.VERCEL_CONTAINER === "1" || !process.env.VERCEL) {
  const server = app.listen(PORT, () => console.log(`CivicConnect API running at http://localhost:${PORT}`));
  const shutdown = () => {
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

export default app;
