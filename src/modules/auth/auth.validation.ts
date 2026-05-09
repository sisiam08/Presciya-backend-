import { z } from "zod";
import config from "../../config";

const SignUpSchema = z.object({
  body: z.object({
    name: z.string().min(3, "Name must be at least 3 characters long"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
    // password: z.string().regex(config.regex.passwordRegex, "Invalid password"),
    phone: z
      .string()
      .regex(config.regex.bdPhoneRegex, "Invalid phone number")
      .optional(),
  }),
});

const logInSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
    // password: z.string().regex(config.regex.passwordRegex, "Invalid password"),
  }),
});

export const AuthValidation = {
  SignUpSchema,
  logInSchema,
};
