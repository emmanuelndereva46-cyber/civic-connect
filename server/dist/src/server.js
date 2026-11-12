import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { prisma } from "./config/prisma.js";
import authRoutes from "./routes/auth.routes.js";
const app = express();
const PORT = Number(process.env.PORT || 5000);
app.use(helmet());
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173"
}));
app.use(express.json({ limit: "2mb" }));
app.use("/api/auth", authRoutes);
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-8",
    legacyHeaders: false
}));
app.get("/", (_req, res) => {
    res.json({
        name: "CivicConnect API",
        message: "Backend server is running."
    });
});
app.get("/api/health", async (_req, res) => {
    try {
        await prisma.$queryRaw `SELECT 1`;
        res.status(200).json({
            status: "healthy",
            database: "connected",
            service: "CivicConnect API"
        });
    }
    catch (error) {
        console.error("Health check failed:", error);
        res.status(503).json({
            status: "unhealthy",
            database: "disconnected"
        });
    }
});
const server = app.listen(PORT, () => {
    console.log(`CivicConnect API running at http://localhost:${PORT}`);
});
async function shutdown() {
    console.log("Shutting down CivicConnect API...");
    server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
    });
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
//# sourceMappingURL=server.js.map