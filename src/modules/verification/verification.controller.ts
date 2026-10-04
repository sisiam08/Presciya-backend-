import { Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { VerificationServices } from "./verification.service";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import { VerificationType, SystemRole } from "../../../generated/prisma/enums";
import { AuthenticatedRequest } from "../../middleware/auth";


export const submitVerificationRequest = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { type, submittedData, workspaceId: bodyWorkspaceId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      throw createAppError("User not authenticated", Status.UNAUTHORIZED);
    }

    
    const normalizedType =
      type === "DOCTOR" ? VerificationType.PERSONAL : type;

    if (
      !normalizedType ||
      !Object.values(VerificationType).includes(normalizedType)
    ) {
      throw createAppError(
        "Invalid verification type. Expected PERSONAL or INSTITUTION.",
        Status.BAD_REQUEST,
      );
    }

    
    const workspaceId = bodyWorkspaceId || req.user?.activeWorkspaceId;

    if (!workspaceId) {
      throw createAppError("workspaceId is required", Status.BAD_REQUEST);
    }

    const data =
      submittedData && typeof submittedData === "object" ? submittedData : {};

    const result = await VerificationServices.submitVerificationRequest(
      userId,
      normalizedType,
      workspaceId,
      data,
    );

    sendResponse(res, {
      statusCode: Status.CREATED,
      success: true,
      message:
        "Verification request submitted successfully. Our team will review it shortly.",
      data: result,
    });
  },
);


export const uploadDocuments = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const files = (req.files as Express.Multer.File[]) || [];
    const result = await VerificationServices.uploadVerificationDocuments(files);

    sendResponse(res, {
      statusCode: Status.CREATED,
      success: true,
      message:
        "Documents uploaded securely. Include the returned references in submittedData.documents.",
      data: result,
    });
  },
);


export const getPendingRequests = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    const systemRole = req.user?.systemRole;

    if (!userId) {
      throw createAppError("User not authenticated", Status.UNAUTHORIZED);
    }

    if (systemRole !== SystemRole.SUPER_ADMIN) {
      throw createAppError(
        "Only super admins can view pending verification requests",
        Status.FORBIDDEN,
      );
    }

    const { type } = req.query;

    const requests = await VerificationServices.getPendingRequests(
      type as VerificationType | undefined,
    );

    sendResponse(res, {
      statusCode: Status.OK,
      success: true,
      message: `Found ${requests.length} pending verification request(s)`,
      data: requests,
    });
  },
);


export const getRequestDetails = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params as { id: string };

    if (!userId) {
      throw createAppError("User not authenticated", Status.UNAUTHORIZED);
    }

    if (!id) {
      throw createAppError("Request ID is required", Status.BAD_REQUEST);
    }

    const request = await VerificationServices.getRequestDetails(id);

    
    if (
      request.userId !== userId &&
      req.user?.systemRole !== SystemRole.SUPER_ADMIN
    ) {
      throw createAppError(
        "You can only view your own verification request",
        Status.FORBIDDEN,
      );
    }

    sendResponse(res, {
      statusCode: Status.OK,
      success: true,
      message: "Verification request details retrieved",
      data: request,
    });
  },
);


export const markUnderReview = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    const systemRole = req.user?.systemRole;
    const { id } = req.params as { id: string };

    if (!userId) {
      throw createAppError("User not authenticated", Status.UNAUTHORIZED);
    }

    if (!id) {
      throw createAppError("Request ID is required", Status.BAD_REQUEST);
    }

    if (systemRole !== SystemRole.SUPER_ADMIN) {
      throw createAppError(
        "Only super admins can review verification requests",
        Status.FORBIDDEN,
      );
    }

    const result = await VerificationServices.markUnderReview(id, userId);

    sendResponse(res, {
      statusCode: Status.OK,
      success: true,
      message: "Verification request moved to under review",
      data: result,
    });
  },
);


export const approveRequest = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    const systemRole = req.user?.systemRole;
    const { id } = req.params as { id: string };

    if (!userId) {
      throw createAppError("User not authenticated", Status.UNAUTHORIZED);
    }

    if (!id) {
      throw createAppError("Request ID is required", Status.BAD_REQUEST);
    }

    if (systemRole !== SystemRole.SUPER_ADMIN) {
      throw createAppError(
        "Only super admins can approve verification requests",
        Status.FORBIDDEN,
      );
    }

    const result = await VerificationServices.approveRequest(id, userId);

    sendResponse(res, {
      statusCode: Status.OK,
      success: true,
      message: "Verification request approved successfully",
      data: result,
    });
  },
);


export const rejectRequest = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    const systemRole = req.user?.systemRole;
    const { id } = req.params as { id: string };
    const { rejectionReason } = req.body;

    if (!userId) {
      throw createAppError("User not authenticated", Status.UNAUTHORIZED);
    }

    if (!id) {
      throw createAppError("Request ID is required", Status.BAD_REQUEST);
    }

    if (systemRole !== SystemRole.SUPER_ADMIN) {
      throw createAppError(
        "Only super admins can reject verification requests",
        Status.FORBIDDEN,
      );
    }

    if (!rejectionReason || typeof rejectionReason !== "string") {
      throw createAppError(
        "rejectionReason is required and must be a string",
        Status.BAD_REQUEST,
      );
    }

    const result = await VerificationServices.rejectRequest(
      id,
      userId,
      rejectionReason,
    );

    sendResponse(res, {
      statusCode: Status.OK,
      success: true,
      message: "Verification request rejected",
      data: result,
    });
  },
);

export const VerificationController = {
  uploadDocuments,
  submitVerificationRequest,
  getPendingRequests,
  getRequestDetails,
  markUnderReview,
  approveRequest,
  rejectRequest,
};
