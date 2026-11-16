import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  changePassword,
  login,
  logout,
  register,
  requestPasswordReset,
  updateMe
} from "../controllers/auth.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

const router = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false
});
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/logout", authenticateToken, logout);
router.post("/forgot-password", resetLimiter, requestPasswordReset);
router.put("/me", authenticateToken, updateMe);
router.put("/password", authenticateToken, changePassword);

export default router;
