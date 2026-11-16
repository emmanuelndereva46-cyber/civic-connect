import { Router } from "express";
import { createDepartment, getActiveDepartments } from "../controllers/department.controller.js";
import { authenticateToken, requireRoles } from "../middleware/auth.middleware.js";

const router = Router();
router.get("/", getActiveDepartments);
router.post("/", authenticateToken, requireRoles("SYSTEM_ADMINISTRATOR"), createDepartment);
export default router;
