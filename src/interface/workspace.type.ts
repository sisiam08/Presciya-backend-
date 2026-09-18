import { Request } from "express";
import {
  WorkspaceRole,
  WorkspaceType,
  MembershipStatus,
} from "../../generated/prisma/enums";

// ============ WORKSPACE DTOs ============

export interface ICreateWorkspaceDTO {
  name: string;
  image?: string;
}

export interface IUpdateWorkspaceDTO {
  name?: string;
  image?: string;
}

export interface IWorkspaceResponseDTO {
  id: string;
  name: string;
  type: WorkspaceType;
  slug: string;
  image?: string;
  ownerId: string;
  role: WorkspaceRole;
  members?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWorkspaceDetailDTO extends IWorkspaceResponseDTO {
  owner: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
}

// ============ MEMBERSHIP DTOs ============

export interface IMembershipDTO {
  id: string;
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  status: MembershipStatus;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
}

export interface IUpdateMembershipDTO {
  role?: WorkspaceRole;
  status?: MembershipStatus;
}

// ============ INVITATION DTOs ============

export interface ICreateInvitationDTO {
  email: string;
  role: WorkspaceRole;
}

export interface IInvitationDTO {
  id: string;
  email: string;
  workspaceId: string;
  role: WorkspaceRole;
  expiresAt: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  createdAt: Date;
  invitedBy?: {
    id: string;
    name: string;
    email: string;
  };
  workspace?: {
    id: string;
    name: string;
    slug: string;
    type: WorkspaceType;
  };
}

export interface IAcceptInvitationDTO {
  token: string;
}

export interface IRejectInvitationDTO {
  reason?: string;
}

// ============ LOGIN/AUTH RESPONSE DTOs ============

export interface IWorkspaceContextDTO {
  id: string;
  name: string;
  type: WorkspaceType;
  slug: string;
  image?: string;
  role: WorkspaceRole;
  members?: number;
}

export interface ILoginResponseDTO {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string;
    status: string;
  };
  workspaces: IWorkspaceContextDTO[];
  activeWorkspaceId: string;
  accessToken: string;
  refreshToken?: string;
}

export interface ISwitchWorkspaceDTO {
  workspaceId: string;
}

export interface ISwitchWorkspaceResponseDTO {
  accessToken: string;
  activeWorkspaceId: string;
  workspace: IWorkspaceContextDTO;
}

// ============ INVITE USER DTO ============

export interface IInviteUserDTO {
  email: string;
  role: WorkspaceRole;
}

// ============ MEMBER MANAGEMENT DTO ============

export interface IUpdateMemberRoleDTO {
  role: WorkspaceRole;
}

export interface IRemoveMemberDTO {
  reason?: string;
}

export interface WorkspaceRequest extends Request {
  workspaceId?: string;
  workspaceRole?: WorkspaceRole;
  userId?: string;
}
