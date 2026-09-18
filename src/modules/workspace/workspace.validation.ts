import { z } from "zod";
import { WorkspaceRole, WorkspaceType } from "../../../generated/prisma/enums";

export const createWorkspaceSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(3, "Workspace name must be at least 3 characters")
      .max(100, "Workspace name cannot exceed 100 characters"),
    type: z.nativeEnum(WorkspaceType).optional(),
    image: z.string().url("Invalid image URL").optional(),
  }),
});

export const updateWorkspaceSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(3, "Workspace name must be at least 3 characters")
      .max(100, "Workspace name cannot exceed 100 characters")
      .optional(),
    image: z.string().url("Invalid image URL").optional(),
  }),
});

export const inviteUserSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
    role: z.enum([
      WorkspaceRole.DOCTOR,
      WorkspaceRole.MANAGER,
      WorkspaceRole.ASSISTANT,
    ] as const),
  }),
});

export const switchWorkspaceSchema = z.object({
  body: z.object({
    workspaceId: z.string().uuid("Invalid workspace ID"),
  }),
});

export const updateMemberRoleSchema = z.object({
  body: z.object({
    role: z.enum([
      WorkspaceRole.OWNER,
      WorkspaceRole.DOCTOR,
      WorkspaceRole.MANAGER,
      WorkspaceRole.ASSISTANT,
    ] as const),
  }),
});

export const acceptInvitationSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Token is required"),
  }),
});

export const rejectInvitationSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Token is required"),
    reason: z.string().optional(),
  }),
});
