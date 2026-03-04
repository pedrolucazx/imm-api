import { z } from "zod";

// Reusable ui_lang validator — ISO 639-1 / BCP 47 simple codes (e.g. "en", "pt-BR")
const uiLangSchema = z
  .string()
  .max(10, { error: "Language code must be at most 10 characters" })
  .regex(/^[a-z]{2}(-[A-Z]{2})?$/, { error: "Language code must match format: 'xx' or 'xx-XX'" })
  .optional();

// Register schema
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

// Login schema
export const loginSchema = z.object({
  email: z.email({ error: "Invalid email address" }),
  password: z.string().min(1, { error: "Password is required" }),
  ui_lang: uiLangSchema,
});

// Types
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    ui_lang?: string | null;
  };
}
