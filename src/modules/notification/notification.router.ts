import { Router } from "express";
import { NotificationControllers } from "./notification.controller";
import { authOnly } from "../../middleware/auth";

const router = Router();

router.use(authOnly());

router.get("/", NotificationControllers.getMyNotifications);
router.get("/unread-count", NotificationControllers.getUnreadCount);
router.patch("/:id/read", NotificationControllers.markAsRead);
router.patch("/read-all", NotificationControllers.markAllAsRead);
router.delete("/:id", NotificationControllers.deleteNotification);

export const NotificationRouters = router;
