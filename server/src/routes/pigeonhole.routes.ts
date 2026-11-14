import { Router } from "express";
import { authenticateToken } from "../middleware/auth.middleware.js";
import {
  getMyPigeonholeSubmissions,
  submitPigeonhole
} from "../controllers/pigeonhole.controller.js";

const router = Router();

router.get("/", authenticateToken, getMyPigeonholeSubmissions);
router.post("/", submitPigeonhole);

export default router;
