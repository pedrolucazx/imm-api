import type { FastifyInstance } from "fastify";
import { getDb } from "../../core/database/connection.js";
import { createAuthModule } from "./auth.module.js";

const userResponse = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid", examples: ["550e8400-e29b-41d4-a716-446655440000"] },
    email: { type: "string", format: "email", examples: ["user@example.com"] },
    name: { type: "string", examples: ["John Doe"] },
    ui_lang: { type: "string", examples: ["pt-BR"] },
  },
};

const authResponse = {
  type: "object",
  properties: {
    token: { type: "string", examples: ["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."] },
    user: userResponse,
  },
};

const errorResponse = (description: string) => ({
  description,
  type: "object",
  properties: {
    error: { type: "string", examples: [description] },
  },
});

export async function authRoutes(fastify: FastifyInstance) {
  const { controller } = createAuthModule(getDb());

  fastify.post("/auth/register", {
    schema: {
      description: "Register a new user account",
      tags: ["Authentication"],
      summary: "Register new user",
      body: {
        type: "object",
        required: ["email", "password", "name"],
        properties: {
          email: { type: "string", format: "email", examples: ["user@example.com"] },
          password: {
            type: "string",
            minLength: 8,
            maxLength: 100,
            examples: ["securePassword123"],
          },
          name: { type: "string", minLength: 2, maxLength: 255, examples: ["John Doe"] },
          ui_lang: { type: "string", examples: ["pt-BR", "en-US"] },
        },
      },
      response: {
        201: {
          description: "User successfully registered",
          type: "object",
          properties: {
            message: { type: "string", examples: ["Verification email sent"] },
          },
        },
        400: errorResponse("Bad request - invalid input"),
        409: errorResponse("Conflict - email already exists"),
      },
    },
    handler: controller.register,
  });

  fastify.post("/auth/login", {
    schema: {
      description: "Authenticate user and receive access tokens",
      tags: ["Authentication"],
      summary: "User login",
      body: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", examples: ["user@example.com"] },
          password: { type: "string", examples: ["securePassword123"] },
          ui_lang: { type: "string", examples: ["pt-BR", "en-US"] },
        },
      },
      response: {
        200: { description: "Successfully authenticated", ...authResponse },
        401: errorResponse("Unauthorized - invalid credentials"),
      },
    },
    handler: controller.login,
  });

  fastify.post("/auth/refresh", {
    schema: {
      description: "Refresh access token using refresh token from cookie",
      tags: ["Authentication"],
      summary: "Refresh access token",
      cookies: {
        type: "object",
        properties: {
          refreshToken: { type: "string", description: "Refresh token stored in HTTP-only cookie" },
        },
        required: ["refreshToken"],
      },
      response: {
        200: { description: "Token refreshed successfully", ...authResponse },
        401: errorResponse("Unauthorized - invalid or expired refresh token"),
      },
    },
    handler: controller.refresh,
  });

  fastify.post("/auth/logout", {
    schema: {
      description: "Logout user and revoke refresh token",
      tags: ["Authentication"],
      summary: "User logout",
      cookies: {
        type: "object",
        properties: {
          refreshToken: { type: "string", description: "Refresh token to revoke" },
        },
      },
      response: {
        204: { description: "Successfully logged out" },
        401: errorResponse("Unauthorized"),
      },
    },
    handler: controller.logout,
  });

  fastify.post("/auth/verify-email", {
    schema: {
      description: "Verify email address using token from email",
      tags: ["Authentication"],
      summary: "Verify email",
      body: {
        type: "object",
        required: ["token"],
        properties: {
          token: { type: "string", description: "Verification token from email" },
        },
      },
      response: {
        200: { description: "Email verified successfully", ...authResponse },
        400: errorResponse("Bad request - invalid token"),
      },
    },
    handler: controller.verifyEmail,
  });

  fastify.post("/auth/resend-verification", {
    schema: {
      description: "Resend email verification link",
      tags: ["Authentication"],
      summary: "Resend verification email",
      body: {
        type: "object",
        required: ["email"],
        properties: {
          email: { type: "string", format: "email", examples: ["user@example.com"] },
        },
      },
      response: {
        200: {
          description: "Email sent if account exists",
          type: "object",
          properties: { message: { type: "string" } },
        },
      },
    },
    handler: controller.resendVerification,
  });
}
