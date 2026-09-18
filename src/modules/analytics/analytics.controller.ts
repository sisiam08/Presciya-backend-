import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import { AnalyticsServices } from "./analytics.service";
import sendResponse from "../../utils/sendResponse";
import { Status } from "../../errors/httpStatus";
import {
  WorkspaceRole,
  WorkspaceType,
} from "../../../generated/prisma/enums";
import { AuthenticatedRequest } from "../../middleware/auth";

const getDashboardAnalytics = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id as string;
    const workspaceId = req.workspaceId as string;
    const workspaceRole = req.workspaceRole as WorkspaceRole;
    const workspaceType = req.user?.workspaceType as WorkspaceType | undefined;

    // Decide by workspace TYPE, not role alone: a personal-workspace OWNER is a
    // doctor, not an institution. Only institution workspaces (excluding
    // doctors) get institution analytics.
    const result =
      workspaceType === WorkspaceType.INSTITUTION &&
      workspaceRole !== WorkspaceRole.DOCTOR
        ? await AnalyticsServices.getInstitutionAnalytics(workspaceId)
        : await AnalyticsServices.getDoctorAnalytics(userId);

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
