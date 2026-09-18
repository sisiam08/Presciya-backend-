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

// Re-export types for backward compatibility with imports from middleware/auth
export type {
  ITokenPayload,
  AuthenticatedRequest,
} from "../interface/auth.type";
import { prisma } from "../lib/prisma";

export type OwnershipResource = "prescription" | "patient" | "chamber";

// Token payload and AuthenticatedRequest types are defined in src/interface/auth.type.ts

/**
 * Authenticate user and verify role + ownership
 *
 * USAGE:
 * router.put('/prescriptions/:id', auth([DOCTOR], { resource: 'prescription' }), handler)
 */
export const auth = (
  allowedRoles: SystemRole[] = [],
  checkOwnership?: {
    resource: OwnershipResource;
    paramKey?: string;
  },
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // STEP 1: AUTHENTICATION - Verify JWT token
      const token = req.cookies.accessToken;

      if (!token) {
        throw createAppError("Unauthorized", Status.UNAUTHORIZED);
      }

      let user: IAuthorizedUser;
      try {
        user = jwt.verify(token, config.jwt.jwtSecret) as IAuthorizedUser;
      } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
          throw createAppError(
            "Token has expired, please log in again",
            Status.UNAUTHORIZED,
          );
        }
        if (error instanceof jwt.JsonWebTokenError) {
          throw createAppError("Invalid token", Status.UNAUTHORIZED);
        }
        throw error;
      }

      // Verify the user still exists and is active
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

      // STEP 2: AUTHORIZATION - Verify system role
      if (
        allowedRoles.length &&
        !allowedRoles.includes(user.systemRole as SystemRole)
      ) {
        throw createAppError(
          "You don't have permission to access this resource",
          Status.FORBIDDEN,
        );
      }

      // STEP 3: OWNERSHIP CHECK (if applicable)
      // Skip for SUPER_ADMIN system role - they have access to everything
      if (checkOwnership && user.systemRole !== SystemRole.SUPER_ADMIN) {
        let resourceId =
          req.params.id || req.params[checkOwnership.paramKey || "id"];

        // Handle case where resourceId might be an array (cast to string)
        if (Array.isArray(resourceId)) {
          resourceId = resourceId[0];
        }

        if (!resourceId || typeof resourceId !== "string") {
          throw createAppError(
            "Resource ID not found in request",
            Status.BAD_REQUEST,
          );
        }

        // Verify ownership based on resource type
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

          // Verify the user is a member of the chamber's workspace
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

/**
 * Authenticate only (no role/ownership check)
 *
 * USAGE: router.get('/profile', authOnly(), handler)
 */
export const authOnly = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.cookies.accessToken;

      if (!token) {
        throw createAppError("Unauthorized", Status.UNAUTHORIZED);
      }

      let user: IAuthorizedUser;
      try {
        user = jwt.verify(token, config.jwt.jwtSecret) as IAuthorizedUser;
      } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
          throw createAppError(
            "Token has expired, please log in again",
            Status.UNAUTHORIZED,
          );
        }
        if (error instanceof jwt.JsonWebTokenError) {
          throw createAppError("Invalid token", Status.UNAUTHORIZED);
        }
        throw error;
      }

      // Verify the user still exists and is active
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

/**
 * Authenticate + verify role only (no ownership check)
 *
 * USAGE: router.get('/admin/stats', authRole([SystemRole.SUPER_ADMIN]), handler)
 */
export const authRole = (allowedRoles: SystemRole[]) => {
  return auth(allowedRoles);
};

/**
 * Workspace-aware authentication with role validation
 * Validates both user authentication and workspace membership
 *
 * USAGE:
 * router.post('/workspace/:workspaceId/prescriptions',
 *   authWorkspace([WorkspaceRole.DOCTOR]), handler)
 */
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
      // Step 1: Verify JWT
      const token = req.cookies.accessToken;

      if (!token) {
        throw createAppError("Unauthorized", Status.UNAUTHORIZED);
      }

      let user: ITokenPayload;
      try {
        user = jwt.verify(token, config.jwt.jwtSecret) as ITokenPayload;
      } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
          throw createAppError(
            "Token has expired, please log in again",
            Status.UNAUTHORIZED,
          );
        }
        if (error instanceof jwt.JsonWebTokenError) {
          throw createAppError("Invalid token", Status.UNAUTHORIZED);
        }
        throw error;
      }

      // Verify the user still exists and is active
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

      // Step 2: Get activeWorkspaceId from params or JWT
      let workspaceId: string | undefined = user.activeWorkspaceId;

      // Check for workspaceId in params with type safety
      if (req.params.workspaceId) {
        const paramWorkspaceId = req.params.workspaceId;
        if (Array.isArray(paramWorkspaceId)) {
          workspaceId = paramWorkspaceId[0];
        } else {
          workspaceId = paramWorkspaceId;
        }
      }

      if (!workspaceId) {
        throw createAppError(
          "Workspace context required. Please specify workspaceId or select active workspace",
          Status.BAD_REQUEST,
        );
      }

      // Step 3: Verify membership
      const membership = await prisma.membership.findUnique({
        where: {
          userId_workspaceId: {
            userId: user.id,
            workspaceId,
          },
        },
      });

      if (!membership) {
        throw createAppError(
          "You do not have access to this workspace",
          Status.FORBIDDEN,
          true,
          "WORKSPACE_ACCESS_DENIED",
        );
      }

      // Membership status is authoritative: only ACTIVE members may act.
      // PENDING/SUSPENDED/INACTIVE memberships are rejected (Section 3.3).
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

      // Step 4: Verify role (if required)
      if (allowedRoles && allowedRoles.length > 0) {
        if (!allowedRoles.includes(membership.role as WorkspaceRole)) {
          throw createAppError(
            `Insufficient permissions. Required roles: ${allowedRoles.join(", ")}`,
            Status.FORBIDDEN,
          );
        }
      }

      // Step 5: Ownership check (if applicable)
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

        // Verify ownership based on resource type
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
