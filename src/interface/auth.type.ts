import { UserRole } from "../../generated/prisma/enums";

export interface ISignUpUserType {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  phone?: string;
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
  role: UserRole;
}
