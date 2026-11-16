import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticateToken, requireRoles } from "../middleware/auth.middleware.js";
import {
  bootstrapFirstAdmin,
  createStaffUser,
  getAdminStats,
  listAuditLogs,
  listUsers,
  updateUserStatus
} from "../controllers/admin.controller.js";

const router = Router();
const bootstrapLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

router.post("/bootstrap", bootstrapLimiter, bootstrapFirstAdmin);
router.use(authenticateToken, requireRoles("SYSTEM_ADMINISTRATOR"));
router.get("/stats", getAdminStats);
router.get("/users", listUsers);
router.post("/users", createStaffUser);
router.put("/users/:id/status", updateUserStatus);
router.get("/audit-logs", listAuditLogs);

export default router;
