export interface SignUpUserType {
    name: string;
    email: string;
    password: string;
    phone?: string;
}

export interface SignInUserType {
    email: string;
    password: string;
}

export interface ForgetPasswordType {
    email: string;
}

export interface ResetPasswordType {
    email: string;
    password: string;
    token: string;
}