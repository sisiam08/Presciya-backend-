import { prisma } from "../../lib/prisma";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import {
  VerificationStatus,
  VerificationType,
  AuditActionType,
  AuditEntityType,
  NotificationType,
  OnboardingState,
} from "../../../generated/prisma/enums";
import { AuditService } from "../audit/audit.service";
import { NotificationServices } from "../notification/notification.service";

/**
 * Submit a verification request for doctor or institution
 */
const submitVerificationRequest = async (
  userId: string,
  type: VerificationType,
  workspaceId: string,
  submittedData: Record<string, any>,
) => {
  // The request must reference a workspace the user actually belongs to.
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: { status: true },
  });

  if (!membership) {
    throw createAppError(
      "You do not have access to this workspace",
      Status.FORBIDDEN,
      true,
      "WORKSPACE_ACCESS_DENIED",
    );
  }

  // Check if user is a doctor or institution
  if (type === VerificationType.PERSONAL) {
    const doctor = await prisma.doctor.findUnique({
      where: { userId },
      select: { id: true, verificationStatus: true },
    });

    if (!doctor) {
      throw createAppError("Doctor profile not found", Status.NOT_FOUND);
    }
  } else if (type === VerificationType.INSTITUTION) {
    const institution = await prisma.institution.findUnique({
      where: { userId },
      select: { id: true, verificationStatus: true },
    });

    if (!institution) {
      throw createAppError("Institution profile not found", Status.NOT_FOUND);
    }
  }

  // Check if there's already an existing request
  const existingRequest = await prisma.verificationRequest.findFirst({
    where: { userId, type },
  });

  // Check if there's a pending request under review
  if (
    existingRequest &&
    existingRequest.status === VerificationStatus.UNDER_REVIEW
  ) {
    throw createAppError(
      "Your verification request is already under review. Please wait for admin response.",
      Status.BAD_REQUEST,
    );
  }

  let verificationRequest;

  if (existingRequest) {
    // Update existing request (re-submission / correction)
    verificationRequest = await prisma.verificationRequest.update({
      where: { id: existingRequest.id },
      data: {
        status: VerificationStatus.PENDING,
        submittedData,
        submittedAt: new Date(),
        reviewedById: null,
        reviewedAt: null,
        rejectionReason: null,
      },
    });
  } else {
    // Create new request
    verificationRequest = await prisma.verificationRequest.create({
      data: {
        userId,
        workspaceId,
        type,
        status: VerificationStatus.PENDING,
        submittedData,
      },
    });
  }

  // Reset the profile verification status so the request can be re-reviewed
  if (type === VerificationType.PERSONAL) {
    await prisma.doctor.update({
      where: { userId },
      data: { verificationStatus: VerificationStatus.PENDING },
    });
  } else if (type === VerificationType.INSTITUTION) {
    await prisma.institution.update({
      where: { userId },
      data: { verificationStatus: VerificationStatus.PENDING },
    });
  }

  // Update onboarding state
  await prisma.user.update({
    where: { id: userId },
    data: { onboardingState: OnboardingState.VERIFICATION_SUBMITTED },
  });

  // Audit: Log verification request submission
  await AuditService.logAudit({
    userId,
    workspaceId,
    actionType: AuditActionType.REQUEST,
    entityType: AuditEntityType.VERIFICATION,
    entityId: verificationRequest.id,
    newValues: {
      status: verificationRequest.status,
      type,
    },
    metadata: {
      submittedDataKeys: Object.keys(submittedData || {}),
    },
  });

  return verificationRequest;
};

/**
 * Get pending verification requests (admin only)
 */
const getPendingRequests = async (type?: VerificationType) => {
  return await prisma.verificationRequest.findMany({
    where: {
      status: {
        in: [VerificationStatus.PENDING, VerificationStatus.UNDER_REVIEW],
      },
      ...(type && { type }),
    },
    orderBy: { submittedAt: "asc" },
  });
};

/**
 * Get request details
 */
const getRequestDetails = async (requestId: string) => {
  const request = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw createAppError("Verification request not found", Status.NOT_FOUND);
  }

  // Get additional info based on type
  if (request.type === VerificationType.PERSONAL) {
    const doctor = await prisma.doctor.findUnique({
      where: { userId: request.userId },
      select: {
        id: true,
        name: true,
        verificationStatus: true,
        bmdcNumber: true,
        specialization: true,
      },
    });

    return { ...request, profile: doctor, profileType: "doctor" };
  } else {
    const institution = await prisma.institution.findUnique({
      where: { userId: request.userId },
      select: {
        id: true,
        name: true,
        verificationStatus: true,
        tradeLicenseNo: true,
      },
    });

    return { ...request, profile: institution, profileType: "institution" };
  }
};

/**
 * Move a verification request to UNDER_REVIEW (admin only)
 */
const markUnderReview = async (requestId: string, reviewedByUserId: string) => {
  const request = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    select: { userId: true, type: true, workspaceId: true, status: true },
  });

  if (!request) {
    throw createAppError("Verification request not found", Status.NOT_FOUND);
  }

  if (request.status !== VerificationStatus.PENDING) {
    throw createAppError(
      "Only pending requests can be moved to under review",
      Status.BAD_REQUEST,
      true,
      "INVALID_STATE",
    );
  }

  const updated = await prisma.verificationRequest.update({
    where: { id: requestId },
    data: {
      status: VerificationStatus.UNDER_REVIEW,
      reviewedAt: new Date(),
      reviewedById: reviewedByUserId,
    },
  });

  // Audit: Log status change
  await AuditService.logAudit({
    userId: reviewedByUserId,
    workspaceId: request.workspaceId,
    actionType: AuditActionType.STATUS_CHANGE,
    entityType: AuditEntityType.VERIFICATION,
    entityId: requestId,
    oldValues: { status: request.status },
    newValues: { status: VerificationStatus.UNDER_REVIEW },
  });

  // Notify the requester
  await NotificationServices.createNotification({
    userId: request.userId,
    title: "Verification under review",
    message:
      "Your verification request is now under review by our team. We will notify you once it is processed.",
    type: NotificationType.VERIFICATION,
  });

  return updated;
};

/**
 * Approve verification request
 */
const approveRequest = async (requestId: string, reviewedByUserId: string) => {
  const request = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    select: { userId: true, type: true, workspaceId: true, status: true },
  });

  if (!request) {
    throw createAppError("Verification request not found", Status.NOT_FOUND);
  }

  // State machine (Section 7.5): PENDING → UNDER_REVIEW → APPROVED.
  // Approval is only valid from UNDER_REVIEW.
  if (request.status !== VerificationStatus.UNDER_REVIEW) {
    throw createAppError(
      "Only requests that are under review can be approved. Move the request to under review first.",
      Status.BAD_REQUEST,
      true,
      "INVALID_STATE",
    );
  }

  // Update verification request
  const updatedRequest = await prisma.$transaction(async (tx) => {
    const updated = await tx.verificationRequest.update({
      where: { id: requestId },
      data: {
        status: VerificationStatus.APPROVED,
        reviewedAt: new Date(),
        reviewedById: reviewedByUserId,
      },
    });

    // Update doctor or institution verification status
    if (request.type === VerificationType.PERSONAL) {
      await tx.doctor.update({
        where: { userId: request.userId },
        data: {
          verificationStatus: VerificationStatus.APPROVED,
          verifiedAt: new Date(),
          verifiedById: reviewedByUserId,
        },
      });
    } else if (request.type === VerificationType.INSTITUTION) {
      await tx.institution.update({
        where: { userId: request.userId },
        data: {
          verificationStatus: VerificationStatus.APPROVED,
          verifiedAt: new Date(),
          verifiedById: reviewedByUserId,
        },
      });
    }

    return updated;
  });

  // Audit: Log approval
  await AuditService.logAudit({
    userId: reviewedByUserId,
    workspaceId: request.workspaceId,
    actionType: AuditActionType.VERIFY,
    entityType: AuditEntityType.VERIFICATION,
    entityId: requestId,
    newValues: {
      status: VerificationStatus.APPROVED,
      reviewedAt: new Date(),
    },
  });

  // Update onboarding state
  await prisma.user.update({
    where: { id: request.userId },
    data: { onboardingState: OnboardingState.VERIFICATION_APPROVED },
  });

  // Notify the requester
  await NotificationServices.createNotification({
    userId: request.userId,
    title: "Verification approved",
    message:
      "Your verification request has been approved. You can now use official prescription functionality.",
    type: NotificationType.VERIFICATION,
  });

  return updatedRequest;
};

/**
 * Reject verification request
 */
const rejectRequest = async (
  requestId: string,
  reviewedByUserId: string,
  rejectionReason: string,
) => {
  const request = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    select: { userId: true, type: true, workspaceId: true, status: true },
  });

  if (!request) {
    throw createAppError("Verification request not found", Status.NOT_FOUND);
  }

  // State machine (Section 7.5): only an UNDER_REVIEW request can be rejected.
  if (request.status !== VerificationStatus.UNDER_REVIEW) {
    throw createAppError(
      "Only requests that are under review can be rejected. Move the request to under review first.",
      Status.BAD_REQUEST,
      true,
      "INVALID_STATE",
    );
  }

  // Update verification request
  const updatedRequest = await prisma.$transaction(async (tx) => {
    const updated = await tx.verificationRequest.update({
      where: { id: requestId },
      data: {
        status: VerificationStatus.REJECTED,
        reviewedAt: new Date(),
        reviewedById: reviewedByUserId,
        rejectionReason,
      },
    });

    // Update doctor or institution verification status
    if (request.type === VerificationType.PERSONAL) {
      await tx.doctor.update({
        where: { userId: request.userId },
        data: {
          verificationStatus: VerificationStatus.REJECTED,
          verifiedAt: new Date(),
          verifiedById: reviewedByUserId,
        },
      });
    } else if (request.type === VerificationType.INSTITUTION) {
      await tx.institution.update({
        where: { userId: request.userId },
        data: {
          verificationStatus: VerificationStatus.REJECTED,
          verifiedAt: new Date(),
          verifiedById: reviewedByUserId,
        },
      });
    }

    return updated;
  });

  // Audit: Log rejection
  await AuditService.logAudit({
    userId: reviewedByUserId,
    workspaceId: request.workspaceId,
    actionType: AuditActionType.REJECT,
    entityType: AuditEntityType.VERIFICATION,
    entityId: requestId,
    newValues: {
      status: VerificationStatus.REJECTED,
      rejectionReason,
      reviewedAt: new Date(),
    },
  });

  // Notify the requester
  await NotificationServices.createNotification({
    userId: request.userId,
    title: "Verification rejected",
    message: `Your verification request was rejected. Reason: ${rejectionReason}.`,
    type: NotificationType.VERIFICATION,
  });

  return updatedRequest;
};

export const VerificationServices = {
  submitVerificationRequest,
  getPendingRequests,
  getRequestDetails,
  markUnderReview,
  approveRequest,
  rejectRequest,
};
