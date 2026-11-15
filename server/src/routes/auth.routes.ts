import { Router } from "express";
import { login, logout, register, updateMe, requestPasswordReset } from "../controllers/auth.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

const router = Router();
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.post("/forgot-password", requestPasswordReset);
router.put("/me", authenticateToken, updateMe);
export default router;
