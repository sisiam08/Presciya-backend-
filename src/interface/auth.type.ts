import {
  WorkspaceRole,
  SystemRole,
  WorkspaceType,
} from "../../generated/prisma/enums";
import { Request } from "express";

export interface ISignUpUserType {
  name: string;
  email: string;
  password: string;
  accountType: "DOCTOR" | "INSTITUTION";
  OTP: string;
}

export interface ILogInUserType {
  email: string;
  password: string;
}

export interface IForgetPasswordType {
  email: string;
}

export interface IResetPasswordType {
  email: string;
  password: string;
  token: string;
}

export interface IAuthorizedUser {
  id: string;
  name: string;
  email: string;
  workspaceType: WorkspaceType;
  systemRole: SystemRole;
}
export interface ITokenPayload extends IAuthorizedUser {
  activeWorkspaceId?: string;
  workspaceRole?: WorkspaceRole;
}

export interface AuthenticatedRequest extends Request {
  user?: ITokenPayload;
  userId?: string;
  workspaceId?: string;
  workspaceRole?: WorkspaceRole;
}
