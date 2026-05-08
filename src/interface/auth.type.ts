import { ContactType } from "./contact.type";

export interface ISignUpUserType {
  name: string;
  email: string;
  password: string;
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
