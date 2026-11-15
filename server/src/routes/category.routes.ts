import { Router } from "express";
import { createCategory, getActiveCategories } from "../controllers/department.controller.js";
import { authenticateToken, requireRoles } from "../middleware/auth.middleware.js";

const router = Router();
router.get("/", getActiveCategories);
router.post("/", authenticateToken, requireRoles("SYSTEM_ADMINISTRATOR"), createCategory);
export default router;
