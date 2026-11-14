import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

async function getActiveUserId(req: Request): Promise<number | null> {
  const userId = (req as Request & {
    user?: { userId: number }
  }).user?.userId;

  if (!userId) return null;

  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      accountStatus: "ACTIVE"
    },
    select: { id: true }
  });

  return user?.id ?? null;
}

// GET /api/notifications
export async function getMyNotifications(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = await getActiveUserId(req);

    if (!userId) {
      res.status(403).json({ message: "An active account is required." });
      return;
    }

    const notifications = await prisma.notification.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        message: true,
        isRead: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" }
    });

    res.status(200).json(notifications);
  } catch (error) {
    console.error("Notification retrieval failed:", error);
    res.status(500).json({
      message: "Could not retrieve notifications."
    });
  }
}

// PUT /api/notifications/:id/read
export async function markNotificationRead(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = await getActiveUserId(req);
    const notificationId = Number(req.params.id);

    if (!userId) {
      res.status(403).json({ message: "An active account is required." });
      return;
    }

    if (!Number.isSafeInteger(notificationId) || notificationId <= 0) {
      res.status(400).json({ message: "Invalid notification ID." });
      return;
    }

    const result = await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    if (result.count === 0) {
      res.status(404).json({
        message: "Notification not found."
      });
      return;
    }

    res.status(200).json({
      message: "Notification marked as read."
    });
  } catch (error) {
    console.error("Mark notification read failed:", error);
    res.status(500).json({
      message: "Could not update notification."
    });
  }
}

// PUT /api/notifications/read-all
export async function markAllNotificationsRead(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = await getActiveUserId(req);

    if (!userId) {
      res.status(403).json({ message: "An active account is required." });
      return;
    }

    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    res.status(200).json({
      message: "Notifications marked as read.",
      count: result.count
    });
  } catch (error) {
    console.error("Mark all notifications read failed:", error);
    res.status(500).json({
      message: "Could not update notifications."
    });
  }
}
