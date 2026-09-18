import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import { AnalyticsServices } from "./analytics.service";
import sendResponse from "../../utils/sendResponse";
import { Status } from "../../errors/httpStatus";
import { WorkspaceRole } from "../../../generated/prisma/enums";
import { AuthenticatedRequest } from "../../middleware/auth";

const getDashboardAnalytics = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id as string;
    const workspaceId = req.workspaceId as string;
    const workspaceRole = req.workspaceRole as WorkspaceRole;

    let result;
    // For institutional workspaces, OWNER can see institution analytics
    if (workspaceRole === WorkspaceRole.OWNER) {
      result = await AnalyticsServices.getInstitutionAnalytics(workspaceId);
    } else if (
      workspaceRole === WorkspaceRole.DOCTOR ||
      workspaceRole === WorkspaceRole.MANAGER
    ) {
      // Regular doctors see only their analytics
      result = await AnalyticsServices.getDoctorAnalytics(userId);
    } else {
      return sendResponse(res, {
        statusCode: Status.BAD_REQUEST,
        success: false,
        message: "Analytics reports are not supported for your workspace role.",
        data: null,
      });
    }

    sendResponse(res, {
      statusCode: Status.OK,
      success: true,
      message: "Dashboard analytics report compiled successfully",
      data: result,
    });
  },
);

export const AnalyticsControllers = {
  getDashboardAnalytics,
};
