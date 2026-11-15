import { Router } from "express";
import rateLimit from "express-rate-limit";
import { trackPigeonhole } from "../controllers/track.controller.js";

const router = Router();

const trackingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

router.get("/pigeonhole", trackingLimiter, trackPigeonhole);

export default router;
