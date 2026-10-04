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
import {
  uploadPrivateFileToCloudinary,
  getSignedPrivateUrl,
} from "../../config/cloudinary.config";


const uploadVerificationDocuments = async (files: Express.Multer.File[]) => {
  if (!files || files.length === 0) {
    throw createAppError(
      "At least one document is required",
      Status.BAD_REQUEST,
    );
  }

  const uploaded: {
    publicId: string;
    format?: string;
    resourceType: string;
    originalName: string;
    bytes: number;
  }[] = [];

  for (const file of files) {
    const result = await uploadPrivateFileToCloudinary(
      file.buffer,
      file.originalname,
    );
    uploaded.push({
      publicId: result.public_id,
      format: result.format,
      resourceType: result.resource_type,
      originalName: file.originalname,
      bytes: result.bytes,
    });
  }

  return uploaded;
};


const buildSignedDocuments = (submittedData: unknown) => {
  const docs = (submittedData as { documents?: unknown })?.documents;
  if (!Array.isArray(docs)) return undefined;

  return docs.map((doc: any) => ({
    originalName: doc?.originalName ?? null,
    url:
      doc?.publicId && doc?.format
        ? getSignedPrivateUrl(
            doc.publicId,
            doc.format,
            doc.resourceType ?? "image",
          )
        : null,
  }));
};


const submitVerificationRequest = async (
  userId: string,
  type: VerificationType,
  workspaceId: string,
  submittedData: Record<string, any>,
) => {
  
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

  
  const existingRequest = await prisma.verificationRequest.findFirst({
    where: { userId, type },
  });

  
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

  
  await prisma.user.update({
    where: { id: userId },
    data: { onboardingState: OnboardingState.VERIFICATION_SUBMITTED },
  });

  
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


const getPendingRequests = async (type?: VerificationType) => {
  const requests = await prisma.verificationRequest.findMany({
    where: {
      status: {
        in: [VerificationStatus.PENDING, VerificationStatus.UNDER_REVIEW],
      },
      ...(type && { type }),
    },
    orderBy: { submittedAt: "asc" },
  });

  
  
  const userIds = [...new Set(requests.map((r) => r.userId))];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  return requests.map((r) => ({ ...r, user: userMap.get(r.userId) ?? null }));
};


const getRequestDetails = async (requestId: string) => {
  const request = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw createAppError("Verification request not found", Status.NOT_FOUND);
  }

  
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

    return {
      ...request,
      profile: doctor,
      profileType: "doctor",
      documents: buildSignedDocuments(request.submittedData),
    };
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

    return {
      ...request,
      profile: institution,
      profileType: "institution",
      documents: buildSignedDocuments(request.submittedData),
    };
  }
};


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

  
  await AuditService.logAudit({
    userId: reviewedByUserId,
    workspaceId: request.workspaceId,
    actionType: AuditActionType.STATUS_CHANGE,
    entityType: AuditEntityType.VERIFICATION,
    entityId: requestId,
    oldValues: { status: request.status },
    newValues: { status: VerificationStatus.UNDER_REVIEW },
  });

  
  await NotificationServices.createNotification({
    userId: request.userId,
    title: "Verification under review",
    message:
      "Your verification request is now under review by our team. We will notify you once it is processed.",
    type: NotificationType.VERIFICATION,
  });

  return updated;
};


const approveRequest = async (requestId: string, reviewedByUserId: string) => {
  const request = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    select: { userId: true, type: true, workspaceId: true, status: true },
  });

  if (!request) {
    throw createAppError("Verification request not found", Status.NOT_FOUND);
  }

  
  
  if (request.status !== VerificationStatus.UNDER_REVIEW) {
    throw createAppError(
      "Only requests that are under review can be approved. Move the request to under review first.",
      Status.BAD_REQUEST,
      true,
      "INVALID_STATE",
    );
  }

  
  const updatedRequest = await prisma.$transaction(async (tx) => {
    const updated = await tx.verificationRequest.update({
      where: { id: requestId },
      data: {
        status: VerificationStatus.APPROVED,
        reviewedAt: new Date(),
        reviewedById: reviewedByUserId,
      },
    });

    
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

  
  await prisma.user.update({
    where: { id: request.userId },
    data: { onboardingState: OnboardingState.VERIFICATION_APPROVED },
  });

  
  await NotificationServices.createNotification({
    userId: request.userId,
    title: "Verification approved",
    message:
      "Your verification request has been approved. You can now use official prescription functionality.",
    type: NotificationType.VERIFICATION,
  });

  return updatedRequest;
};


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

  
  if (request.status !== VerificationStatus.UNDER_REVIEW) {
    throw createAppError(
      "Only requests that are under review can be rejected. Move the request to under review first.",
      Status.BAD_REQUEST,
      true,
      "INVALID_STATE",
    );
  }

  
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

  
  await NotificationServices.createNotification({
    userId: request.userId,
    title: "Verification rejected",
    message: `Your verification request was rejected. Reason: ${rejectionReason}.`,
    type: NotificationType.VERIFICATION,
  });

  return updatedRequest;
};

export const VerificationServices = {
  uploadVerificationDocuments,
  submitVerificationRequest,
  getPendingRequests,
  getRequestDetails,
  markUnderReview,
  approveRequest,
  rejectRequest,
};
