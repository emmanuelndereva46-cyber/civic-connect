import { Router } from "express";
import { authenticateToken, requireRoles } from "../middleware/auth.middleware.js";
import {
  listPigeonhole,
  respondToPigeonhole,
  submitPigeonhole,
  updatePigeonholeStatus
} from "../controllers/pigeonhole.controller.js";

const router = Router();

router.get("/", authenticateToken, requireRoles("SYSTEM_ADMINISTRATOR"), listPigeonhole);
router.post("/", submitPigeonhole);
router.put("/:id/status", authenticateToken, requireRoles("SYSTEM_ADMINISTRATOR"), updatePigeonholeStatus);
router.post("/:id/response", authenticateToken, requireRoles("SYSTEM_ADMINISTRATOR"), respondToPigeonhole);

export default router;
