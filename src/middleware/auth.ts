import { NextFunction, Request, Response } from "express";
import { Status } from "../errors/httpStatus";
import jwt from "jsonwebtoken";
import {
  WorkspaceRole,
  SystemRole,
  WorkspaceType,
  MembershipStatus,
} from "../../generated/prisma/enums";
import { createAppError } from "../errors/appError";
import config from "../config";
import {
  IAuthorizedUser,
  ITokenPayload,
  AuthenticatedRequest,
} from "../interface/auth.type";


export type {
  ITokenPayload,
  AuthenticatedRequest,
} from "../interface/auth.type";
import { prisma } from "../lib/prisma";
import { FeatureServices } from "../modules/feature/feature.service";

export type OwnershipResource = "prescription" | "patient" | "chamber";




export const auth = (
  allowedRoles: SystemRole[] = [],
  checkOwnership?: {
    resource: OwnershipResource;
    paramKey?: string;
  },
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      
      const token = req.cookies.accessToken;

      if (!token) {
        throw createAppError("Unauthorized", Status.UNAUTHORIZED);
      }

      let user: IAuthorizedUser;
      try {
        user = jwt.verify(token, config.accessToken.secret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    }) as IAuthorizedUser;
      } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      
      
      throw createAppError(
        "Token has expired, please log in again",
        Status.UNAUTHORIZED,
        true,
        "TOKEN_EXPIRED",
      );
    }
        if (error instanceof jwt.JsonWebTokenError) {
          throw createAppError("Invalid token", Status.UNAUTHORIZED);
        }
        throw error;
      }

      
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, isActive: true },
      });
      if (!dbUser || !dbUser.isActive) {
        throw createAppError(
          "Your account is inactive or no longer exists",
          Status.FORBIDDEN,
        );
      }

      req.user = user;

      
      if (
        allowedRoles.length &&
        !allowedRoles.includes(user.systemRole as SystemRole)
      ) {
        throw createAppError(
          "You don't have permission to access this resource",
          Status.FORBIDDEN,
        );
      }

      
      
      if (checkOwnership && user.systemRole !== SystemRole.SUPER_ADMIN) {
        let resourceId =
          req.params.id || req.params[checkOwnership.paramKey || "id"];

        
        if (Array.isArray(resourceId)) {
          resourceId = resourceId[0];
        }

        if (!resourceId || typeof resourceId !== "string") {
          throw createAppError(
            "Resource ID not found in request",
            Status.BAD_REQUEST,
          );
        }

        
        if (checkOwnership.resource === "prescription") {
          const prescription = await prisma.prescription.findUnique({
            where: { id: resourceId },
            select: { userId: true, doctorUserId: true },
          });

          if (!prescription) {
            throw createAppError("Prescription not found", Status.NOT_FOUND);
          }

          const isOwner =
            prescription.userId === user.id ||
            prescription.doctorUserId === user.id;

          if (!isOwner) {
            throw createAppError(
              "Access denied: You do not own this prescription",
              Status.FORBIDDEN,
            );
          }
        }

        if (checkOwnership.resource === "patient") {
          const patient = await prisma.patient.findUnique({
            where: { id: resourceId },
            select: { doctorId: true },
          });

          if (!patient?.doctorId) {
            throw createAppError("Patient not found", Status.NOT_FOUND);
          }

          const doctor = await prisma.doctor.findUnique({
            where: { id: patient.doctorId },
            select: { id: true, userId: true },
          });

          if (!doctor) {
            throw createAppError("Patient not found", Status.NOT_FOUND);
          }

          const isOwner = doctor.userId === user.id;
          const isInstAdmin =
            user.workspaceType === WorkspaceType.INSTITUTION &&
            (await prisma.institutionDoctor.findFirst({
              where: {
                doctorId: doctor.id,
                institution: { userId: user.id },
              },
              select: { id: true },
            }));

          if (!isOwner && !isInstAdmin) {
            throw createAppError(
              "Access denied: You do not have permissions for this patient",
              Status.FORBIDDEN,
            );
          }
        }

        if (checkOwnership.resource === "chamber") {
          const chamber = await prisma.chamber.findUnique({
            where: { id: resourceId },
            select: { workspaceId: true },
          });

          if (!chamber) {
            throw createAppError("Chamber not found", Status.NOT_FOUND);
          }

          
          const membership = await prisma.membership.findUnique({
            where: {
              userId_workspaceId: {
                userId: user.id,
                workspaceId: chamber.workspaceId,
              },
            },
          });

          if (!membership) {
            throw createAppError(
              "Access denied: You do not belong to the chamber's workspace",
              Status.FORBIDDEN,
            );
          }
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};


export const authOnly = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.cookies.accessToken;

      if (!token) {
        throw createAppError("Unauthorized", Status.UNAUTHORIZED);
      }

      let user: IAuthorizedUser;
      try {
        user = jwt.verify(token, config.accessToken.secret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    }) as IAuthorizedUser;
      } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      
      
      throw createAppError(
        "Token has expired, please log in again",
        Status.UNAUTHORIZED,
        true,
        "TOKEN_EXPIRED",
      );
    }
        if (error instanceof jwt.JsonWebTokenError) {
          throw createAppError("Invalid token", Status.UNAUTHORIZED);
        }
        throw error;
      }

      
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, isActive: true },
      });
      if (!dbUser || !dbUser.isActive) {
        throw createAppError(
          "Your account is inactive or no longer exists",
          Status.FORBIDDEN,
        );
      }

      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
};


export const authRole = (allowedRoles: SystemRole[]) => {
  return auth(allowedRoles);
};


export const authWorkspace = (
  allowedRoles?: WorkspaceRole[],
  checkOwnership?: {
    resource: OwnershipResource;
    paramKey?: string;
  },
) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      
      const token = req.cookies.accessToken;

      if (!token) {
        throw createAppError("Unauthorized", Status.UNAUTHORIZED);
      }

      let user: ITokenPayload;
      try {
        user = jwt.verify(token, config.accessToken.secret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    }) as ITokenPayload;
      } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      
      
      throw createAppError(
        "Token has expired, please log in again",
        Status.UNAUTHORIZED,
        true,
        "TOKEN_EXPIRED",
      );
    }
        if (error instanceof jwt.JsonWebTokenError) {
          throw createAppError("Invalid token", Status.UNAUTHORIZED);
        }
        throw error;
      }

      
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, isActive: true },
      });
      if (!dbUser || !dbUser.isActive) {
        throw createAppError(
          "Your account is inactive or no longer exists",
          Status.FORBIDDEN,
        );
      }

      req.user = user;
      req.userId = user.id;

      
      let workspaceId: string | undefined = user.activeWorkspaceId;

      
      if (req.params.workspaceId) {
        const paramWorkspaceId = req.params.workspaceId;
        if (Array.isArray(paramWorkspaceId)) {
          workspaceId = paramWorkspaceId[0];
        } else {
          workspaceId = paramWorkspaceId;
        }
      }

      
      
      
      if (!workspaceId) {
        const headerWorkspaceId = req.headers["x-workspace-id"];
        if (typeof headerWorkspaceId === "string" && headerWorkspaceId) {
          workspaceId = headerWorkspaceId;
        }
      }

      if (!workspaceId) {
        throw createAppError(
          "Workspace context required. Please specify workspaceId or select active workspace",
          Status.BAD_REQUEST,
        );
      }

      
      const membership = await prisma.membership.findUnique({
        where: {
          userId_workspaceId: {
            userId: user.id,
            workspaceId,
          },
        },
        include: { workspace: { select: { type: true } } },
      });

      
      
      
      
      if (membership?.workspace?.type === WorkspaceType.INSTITUTION) {
        await FeatureServices.assertInstitutionEnabled();
      }

      if (!membership) {
        throw createAppError(
          "You do not have access to this workspace",
          Status.FORBIDDEN,
          true,
          "WORKSPACE_ACCESS_DENIED",
        );
      }

      
      
      if (membership.status !== MembershipStatus.ACTIVE) {
        throw createAppError(
          `Your membership for this workspace is ${membership.status}. Access denied.`,
          Status.FORBIDDEN,
          true,
          "MEMBERSHIP_INACTIVE",
        );
      }

      req.workspaceId = workspaceId;
      req.workspaceRole = membership.role as WorkspaceRole;

      
      if (allowedRoles && allowedRoles.length > 0) {
        if (!allowedRoles.includes(membership.role as WorkspaceRole)) {
          throw createAppError(
            `Insufficient permissions. Required roles: ${allowedRoles.join(", ")}`,
            Status.FORBIDDEN,
          );
        }
      }

      
      if (checkOwnership && membership.role !== WorkspaceRole.OWNER) {
        let resourceId =
          req.params.id || req.params[checkOwnership.paramKey || "id"];

        if (Array.isArray(resourceId)) {
          resourceId = resourceId[0];
        }

        if (!resourceId || typeof resourceId !== "string") {
          throw createAppError(
            "Resource ID not found in request",
            Status.BAD_REQUEST,
          );
        }

        
        if (checkOwnership.resource === "prescription") {
          const prescription = await prisma.prescription.findUnique({
            where: { id: resourceId },
            select: { userId: true, workspaceId: true },
          });

          if (!prescription) {
            throw createAppError("Prescription not found", Status.NOT_FOUND);
          }

          if (prescription.workspaceId !== workspaceId) {
            throw createAppError(
              "Prescription does not belong to this workspace",
              Status.FORBIDDEN,
            );
          }

          if (prescription.userId !== user.id) {
            throw createAppError(
              "Access denied: You do not own this prescription",
              Status.FORBIDDEN,
            );
          }
        }

        if (checkOwnership.resource === "patient") {
          const patient = await prisma.patient.findUnique({
            where: { id: resourceId },
            select: { workspaceId: true },
          });

          if (!patient) {
            throw createAppError("Patient not found", Status.NOT_FOUND);
          }

          if (patient.workspaceId !== workspaceId) {
            throw createAppError(
              "Patient does not belong to this workspace",
              Status.FORBIDDEN,
            );
          }
        }

        if (checkOwnership.resource === "chamber") {
          const chamber = await prisma.chamber.findUnique({
            where: { id: resourceId },
            select: { workspaceId: true },
          });

          if (!chamber) {
            throw createAppError("Chamber not found", Status.NOT_FOUND);
          }

          if (chamber.workspaceId !== workspaceId) {
            throw createAppError(
              "Chamber does not belong to this workspace",
              Status.FORBIDDEN,
            );
          }
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
