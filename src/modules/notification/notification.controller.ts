import { Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { NotificationServices } from "./notification.service";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import { AuthenticatedRequest } from "../../middleware/auth";

export const getMyNotifications = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      throw createAppError("User not authenticated", Status.UNAUTHORIZED);
    }

    const result = await NotificationServices.getMyNotifications(
      userId,
      req.query,
    );

    sendResponse(res, {
      statusCode: Status.OK,
      success: true,
      message: "Notifications retrieved successfully",
      data: result.data,
      meta: result.pagination,
    });
  },
);

export const getUnreadCount = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      throw createAppError("User not authenticated", Status.UNAUTHORIZED);
    }

    const count = await NotificationServices.getUnreadCount(userId);

    sendResponse(res, {
      statusCode: Status.OK,
      success: true,
      message: "Unread notification count retrieved",
      data: { count },
    });
  },
);

export const markAsRead = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params as { id: string };

    if (!userId) {
      throw createAppError("User not authenticated", Status.UNAUTHORIZED);
    }

    if (!id) {
      throw createAppError("Notification ID is required", Status.BAD_REQUEST);
    }

    const result = await NotificationServices.markAsRead(userId, id);

    sendResponse(res, {
      statusCode: Status.OK,
      success: true,
      message: "Notification marked as read",
      data: result,
    });
  },
);

export const markAllAsRead = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      throw createAppError("User not authenticated", Status.UNAUTHORIZED);
    }

    const result = await NotificationServices.markAllAsRead(userId);

    sendResponse(res, {
      statusCode: Status.OK,
      success: true,
      message: "All notifications marked as read",
      data: { count: result.count },
    });
  },
);

export const deleteNotification = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params as { id: string };

    if (!userId) {
      throw createAppError("User not authenticated", Status.UNAUTHORIZED);
    }

    if (!id) {
      throw createAppError("Notification ID is required", Status.BAD_REQUEST);
    }

    await NotificationServices.deleteNotification(userId, id);

    sendResponse(res, {
      statusCode: Status.OK,
      success: true,
      message: "Notification deleted successfully",
      data: null,
    });
  },
);

export const NotificationControllers = {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
