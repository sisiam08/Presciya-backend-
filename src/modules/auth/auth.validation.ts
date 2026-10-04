import { z } from "zod";
import config from "../../config";
import { optionalBangladeshPhone } from "../../utils/phone";

const SignUpSchema = z.object({
  body: z.object({
    name: z.string().min(3, "Name must be at least 3 characters long"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
    
    accountType: z.enum(["DOCTOR", "INSTITUTION"]),
    OTP: z.string().regex(/^\d{6}$/, "OTP must be exactly 6 digits"),
  }),
});

const logInSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
    
  }),
});

const RefreshTokenSchema = z.object({
  cookies: z.object({
    refreshToken: z.string({
      error: "Refresh token is required",
    }),
  }),
});

const ForgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
  }),
});

const ResetPasswordSchema = z.object({
  body: z.object({
    token: z.string({ error: "Reset token is required" }),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters long"),
    
  }),
});

const SwitchWorkspaceSchema = z.object({
  body: z.object({
    workspaceId: z.string({ error: "Workspace ID is required" }).min(1),
  }),
});

const SendOtpSchema = z.object({
  body: z.object({
    name: z.string().min(3, "Name must be at least 3 characters long"),
    email: z.string().email("Invalid email address"),
  }),
});


const UpdateMeSchema = z.object({
  body: z.object({
    name: z.string().min(3, "Name must be at least 3 characters long").optional(),
    phone: optionalBangladeshPhone(),
  }),
});

export const AuthValidation = {
  SignUpSchema,
  UpdateMeSchema,
  logInSchema,
  RefreshTokenSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  SwitchWorkspaceSchema,
  SendOtpSchema,
};
