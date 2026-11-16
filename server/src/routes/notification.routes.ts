import { Router } from "express";
import { authenticateToken } from "../middleware/auth.middleware.js";
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead
} from "../controllers/notification.controller.js";

const router = Router();

router.use(authenticateToken);

router.get("/", getMyNotifications);
router.put("/read-all", markAllNotificationsRead);
router.put("/:id/read", markNotificationRead);

export default router;
