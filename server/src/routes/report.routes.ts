
import { Router } from "express";

import { authenticateToken } from "../middleware/auth.middleware.js";
import {
  getActiveCategories,
  getMyReports,
    getReportDetails,
      trackReportByReference,
  submitReport
} from "../controllers/report.controller.js";

const router = Router();

// All report endpoints require authentication.
router.use(authenticateToken);
router.get("/", getMyReports);
router.get("/categories", getActiveCategories);
router.post("/", submitReport);
router.get("/track/:referenceNumber", trackReportByReference);
router.get("/:id", getReportDetails);
export default router;
