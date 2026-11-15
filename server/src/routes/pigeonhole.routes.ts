import { Router } from "express";
import { authenticateToken } from "../middleware/auth.middleware.js";
import {
  listPigeonhole,
  respondToPigeonhole,
  submitPigeonhole,
  updatePigeonholeStatus
} from "../controllers/pigeonhole.controller.js";

const router = Router();

router.get("/", authenticateToken, listPigeonhole);
router.post("/", submitPigeonhole);
router.put("/:id/status", authenticateToken, updatePigeonholeStatus);
router.post("/:id/response", authenticateToken, respondToPigeonhole);

export default router;
