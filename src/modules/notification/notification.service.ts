import { prisma } from "../../lib/prisma";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import { NotificationType } from "../../../generated/prisma/enums";
import { getPaginationParams, buildPaginatedResult } from "../../utils/pagination";

type CreateNotificationParams = {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
};

const createNotification = async ({
  userId,
  title,
  message,
  type = NotificationType.SYSTEM,
}: CreateNotificationParams) => {
  return prisma.notification.create({
    data: {
      userId,
      title,
      message,
      type,
      sentStatus: "sent",
    },
  });
};

const getMyNotifications = async (
  userId: string,
  query: { page?: unknown; limit?: unknown; unreadOnly?: unknown },
) => {
  const { page, limit, skip } = getPaginationParams(query.page, query.limit);
  const unreadOnly = String(query.unreadOnly ?? "false") === "true";

  const where = { userId, ...(unreadOnly ? { isRead: false } : {}) };

  const [total, notifications] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      select: {
        id: true,
        title: true,
        message: true,
        type: true,
        isRead: true,
        readAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  return buildPaginatedResult(notifications, total, page, limit);
};

const getUnreadCount = async (userId: string) => {
  return prisma.notification.count({
    where: { userId, isRead: false },
  });
};

const markAsRead = async (userId: string, notificationId: string) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { id: true, userId: true },
  });

  if (!notification) {
    throw createAppError("Notification not found", Status.NOT_FOUND);
  }

  if (notification.userId !== userId) {
    throw createAppError(
      "You do not have permission to access this notification",
      Status.FORBIDDEN,
    );
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true, readAt: new Date() },
    select: { id: true, isRead: true, readAt: true },
  });
};

const markAllAsRead = async (userId: string) => {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
};

const deleteNotification = async (userId: string, notificationId: string) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { id: true, userId: true },
  });

  if (!notification) {
    throw createAppError("Notification not found", Status.NOT_FOUND);
  }

  if (notification.userId !== userId) {
    throw createAppError(
      "You do not have permission to delete this notification",
      Status.FORBIDDEN,
    );
  }

  return prisma.notification.delete({
    where: { id: notificationId },
    select: { id: true },
  });
};

export const NotificationServices = {
  createNotification,
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
