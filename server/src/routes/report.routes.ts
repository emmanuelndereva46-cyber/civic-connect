import { Router } from "express";
import { authenticateToken } from "../middleware/auth.middleware.js";
import {
  getActiveCategories,
  getMyReports,
  getReportDetails,
  submitReport,
  updateReportStatus
} from "../controllers/report.controller.js";

const router = Router();

router.use(authenticateToken);
router.get("/", getMyReports);
router.get("/categories", getActiveCategories);
router.post("/", submitReport);
router.put("/:id/status", updateReportStatus);
router.get("/:id", getReportDetails);

export default router;
