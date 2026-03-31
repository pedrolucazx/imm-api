import type { FastifyInstance } from "fastify";
import { getDb } from "../../core/database/connection.js";
import { authenticate } from "../../core/hooks/authenticate.js";
import { createUsersModule } from "./users.module.js";
import { ALLOWED_UI_LANGUAGES } from "./users.types.js";
import { MAX_ONBOARDING_STEP } from "./onboarding.types.js";

const userMeResponse = {
  type: "object",
  additionalProperties: false,
  required: ["id", "email", "name", "avatarUrl", "profile"],
  properties: {
    id: { type: "string", format: "uuid", examples: ["550e8400-e29b-41d4-a716-446655440000"] },
    email: { type: "string", format: "email", examples: ["user@example.com"] },
    name: { type: "string", examples: ["John Doe"] },
    avatarUrl: { anyOf: [{ type: "string", format: "uri" }, { type: "null" }], examples: [null] },
    profile: {
      type: "object",
      additionalProperties: false,
      required: ["uiLanguage", "bio", "timezone", "aiRequestsToday"],
      properties: {
        uiLanguage: { type: "string", enum: [...ALLOWED_UI_LANGUAGES], examples: ["pt-BR"] },
        bio: { anyOf: [{ type: "string" }, { type: "null" }], examples: [null] },
        timezone: { type: "string", examples: ["America/Sao_Paulo"] },
        aiRequestsToday: { type: "integer", examples: [0] },
      },
    },
  },
};

const errorResponse = (description: string) => ({
  description,
  type: "object",
  properties: {
    error: { type: "string", examples: [description] },
  },
});

const onboardingStatusResponse = {
  type: "object",
  additionalProperties: false,
  required: ["currentStep", "skipped", "completed", "completedAt"],
  properties: {
    currentStep: { type: "integer", minimum: 0, maximum: MAX_ONBOARDING_STEP, examples: [0] },
    skipped: { type: "boolean", examples: [false] },
    completed: { type: "boolean", examples: [false] },
    completedAt: {
      anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
      examples: [null],
    },
  },
};

export async function usersRoutes(fastify: FastifyInstance) {
  const { controller, onboardingController } = createUsersModule(getDb());

  fastify.get("/users/me", {
    schema: {
      description: "Get the authenticated user's profile",
      tags: ["Users"],
      summary: "Get profile",
      security: [{ bearerAuth: [] }],
      response: {
        200: { description: "Profile retrieved successfully", ...userMeResponse },
        401: errorResponse("Unauthorized - invalid or missing token"),
        404: errorResponse("Profile not found"),
      },
    },
    preHandler: authenticate,
    handler: controller.get,
  });

  fastify.post("/users/me/avatar-upload-url", {
    schema: {
      description: "Generate a signed URL to upload an avatar directly to Supabase Storage",
      tags: ["Users"],
      summary: "Get avatar upload URL",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["contentType"],
        additionalProperties: false,
        properties: {
          contentType: {
            type: "string",
            enum: ["image/jpeg", "image/png", "image/webp"],
            examples: ["image/jpeg"],
          },
        },
      },
      response: {
        200: {
          description: "Signed upload URL generated",
          type: "object",
          additionalProperties: false,
          required: ["signedUrl", "publicUrl", "path"],
          properties: {
            signedUrl: { type: "string" },
            publicUrl: { type: "string" },
            path: { type: "string" },
          },
        },
        401: errorResponse("Unauthorized - invalid or missing token"),
        422: errorResponse("Invalid content type"),
        500: errorResponse("Internal server error - Supabase Storage failure"),
      },
    },
    preHandler: authenticate,
    handler: controller.getAvatarUploadUrl,
  });

  fastify.put("/users/me", {
    schema: {
      description: "Update the authenticated user's profile",
      tags: ["Users"],
      summary: "Update profile",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string", minLength: 2, maxLength: 255, examples: ["John Doe"] },
          avatarUrl: {
            anyOf: [{ type: "null" }, { type: "string", format: "uri", maxLength: 500 }],
            examples: ["https://example.com/avatar.png", null],
          },
          uiLanguage: {
            type: "string",
            enum: [...ALLOWED_UI_LANGUAGES],
            examples: ["pt-BR"],
          },
          bio: {
            anyOf: [{ type: "null" }, { type: "string", maxLength: 500 }],
            examples: ["Developer and coffee lover", null],
          },
          timezone: {
            type: "string",
            maxLength: 50,
            examples: ["America/Sao_Paulo"],
          },
        },
      },
      response: {
        200: { description: "Profile updated successfully", ...userMeResponse },
        401: errorResponse("Unauthorized - invalid or missing token"),
        422: errorResponse("Validation failed"),
        404: errorResponse("Profile not found"),
      },
    },
    preHandler: authenticate,
    handler: controller.update,
  });

  fastify.delete("/users/me", {
    schema: {
      description: "Delete the authenticated user's account permanently (LGPD Article 18)",
      tags: ["Users"],
      summary: "Delete account",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["password"],
        additionalProperties: false,
        properties: {
          password: { type: "string", examples: ["currentPassword123"] },
          reason: { type: "string", examples: ["I'm not using the app anymore"] },
        },
      },
      response: {
        204: { description: "Account deleted successfully" },
        400: errorResponse("Password is required"),
        401: errorResponse("Unauthorized - invalid or missing token or wrong password"),
        404: errorResponse("User not found"),
      },
    },
    preHandler: authenticate,
    handler: controller.delete,
  });

  fastify.get("/users/me/onboarding", {
    schema: {
      description: "Get the authenticated user's onboarding status",
      tags: ["Users"],
      summary: "Get onboarding status",
      security: [{ bearerAuth: [] }],
      response: {
        200: { description: "Onboarding status retrieved", ...onboardingStatusResponse },
        401: errorResponse("Unauthorized - invalid or missing token"),
      },
    },
    preHandler: authenticate,
    handler: onboardingController.getStatus,
  });

  fastify.put("/users/me/onboarding", {
    schema: {
      description: "Update the authenticated user's onboarding progress",
      tags: ["Users"],
      summary: "Update onboarding progress",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          currentStep: { type: "integer", minimum: 0, maximum: MAX_ONBOARDING_STEP, examples: [1] },
          skipped: { type: "boolean", examples: [true] },
          completed: { type: "boolean", examples: [true] },
        },
      },
      response: {
        200: { description: "Onboarding progress updated", ...onboardingStatusResponse },
        400: errorResponse("Invalid request body"),
        401: errorResponse("Unauthorized - invalid or missing token"),
      },
    },
    preHandler: authenticate,
    handler: onboardingController.update,
  });
}
