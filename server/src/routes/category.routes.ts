import { Router } from "express";
import { assignCategoryDepartment, createCategory, getActiveCategories } from "../controllers/department.controller.js";
import { authenticateToken, requireRoles } from "../middleware/auth.middleware.js";

const router = Router();
router.get("/", getActiveCategories);
router.post("/", authenticateToken, requireRoles("SYSTEM_ADMINISTRATOR"), createCategory);
router.put("/:id/department", authenticateToken, requireRoles("SYSTEM_ADMINISTRATOR"), assignCategoryDepartment);
export default router;
