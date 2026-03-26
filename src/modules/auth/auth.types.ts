import { z } from "zod";

const uiLangSchema = z
  .string()
  .max(10, { error: "Language code must be at most 10 characters" })
  .regex(/^[a-z]{2}(-[A-Z]{2})?$/, { error: "Language code must match format: 'xx' or 'xx-XX'" })
  .optional();

export const registerSchema = z.object({
  email: z.email({ error: "Invalid email address" }),
  password: z
    .string()
    .min(8, { error: "Password must be at least 8 characters" })
    .max(100, { error: "Password must be less than 100 characters" }),
  name: z
    .string()
    .min(2, { error: "Name must be at least 2 characters" })
    .max(255, { error: "Name must be less than 255 characters" }),
  ui_lang: uiLangSchema,
});

export const loginSchema = z.object({
  email: z.email({ error: "Invalid email address" }),
  password: z.string().min(1, { error: "Password is required" }),
  ui_lang: uiLangSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(1, { error: "Token is required" }),
});

export const resendVerificationSchema = z.object({
  email: z.email({ error: "Invalid email address" }),
});

export const forgotPasswordSchema = z.object({
  email: z.email({ error: "Invalid email address" }),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, { error: "Token is required" }),
  newPassword: z
    .string()
    .min(8, { error: "Password must be at least 8 characters" })
    .max(100, { error: "Password must be less than 100 characters" }),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export interface RegisterResponse {
  message: string;
}

export type JwtSignFn = (payload: object, options?: { expiresIn?: string | number }) => string;

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    ui_lang: string;
  };
}
