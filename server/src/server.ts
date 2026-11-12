
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import reportRoutes from "./routes/report.routes.js";

import { prisma } from "./config/prisma.js";
import authRoutes from "./routes/auth.routes.js";
import {
  authenticateToken,
  type AuthenticatedRequest
} from "./middleware/auth.middleware.js";

const app = express();
const PORT = Number(process.env.PORT || 5000);

// Security headers
app.use(helmet());

// Allow requests from the frontend
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173"
  })
);

// Parse incoming JSON requests
app.use(express.json({ limit: "2mb" }));

// Rate limit requests to protect the API
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-8",
    legacyHeaders: false
  })
);

// Authentication routes: registration and login
app.use("/api/auth", authRoutes);
app.use("/api/reports", reportRoutes);
// Root route
app.get("/", (_req, res) => {
  res.status(200).json({
    name: "CivicConnect API",
    message: "Backend server is running."
  });
});

// Database health check
app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: "healthy",
      database: "connected",
      service: "CivicConnect API"
    });
  } catch (error) {
    console.error("Health check failed:", error);

    res.status(503).json({
      status: "unhealthy",
      database: "disconnected"
    });
  }
});

// Protected route: retrieve the authenticated user's token details
app.get(
  "/api/auth/me",
  authenticateToken,
  (req: AuthenticatedRequest, res) => {
    res.status(200).json({
      message: "Authentication successful.",
      user: req.user
    });
  }
);

// Start the server
const server = app.listen(PORT, () => {
  console.log(`CivicConnect API running at http://localhost:${PORT}`);
});

// Graceful shutdown
async function shutdown() {
  console.log("Shutting down CivicConnect API...");

  server.close(async () => {
    try {
      await prisma.$disconnect();
      process.exit(0);
    } catch (error) {
      console.error("Error disconnecting from the database:", error);
      process.exit(1);
    }
  });
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
