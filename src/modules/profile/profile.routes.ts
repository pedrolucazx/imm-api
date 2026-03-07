import type { FastifyInstance } from "fastify";
import { getDb } from "../../core/database/connection.js";
import { authenticate } from "../../core/hooks/authenticate.js";
import { createProfileModule } from "./profile.module.js";
import { ALLOWED_UI_LANGUAGES } from "./profile.types.js";

const profileResponse = {
  type: "object",
  additionalProperties: false,
  required: ["id", "email", "name", "avatarUrl", "profile"],
  properties: {
    id: { type: "string", format: "uuid", examples: ["550e8400-e29b-41d4-a716-446655440000"] },
    email: { type: "string", format: "email", examples: ["user@example.com"] },
    name: { type: "string", examples: ["John Doe"] },
    avatarUrl: { type: "string", nullable: true, examples: [null] },
    profile: {
      type: "object",
      additionalProperties: false,
      required: ["uiLanguage", "bio", "timezone", "aiRequestsToday"],
      properties: {
        uiLanguage: { type: "string", examples: ["pt-BR"] },
        bio: { type: "string", nullable: true, examples: [null] },
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

export async function profileRoutes(fastify: FastifyInstance) {
  const { controller } = createProfileModule(getDb());

  fastify.get("/profile", {
    schema: {
      description: "Get the authenticated user's profile",
      tags: ["Profile"],
      summary: "Get profile",
      security: [{ bearerAuth: [] }],
      response: {
        200: { description: "Profile retrieved successfully", ...profileResponse },
        401: errorResponse("Unauthorized - invalid or missing token"),
        404: errorResponse("Profile not found"),
      },
    },
    preHandler: authenticate,
    handler: controller.get,
  });

  fastify.put("/profile", {
    schema: {
      description: "Update the authenticated user's profile",
      tags: ["Profile"],
      summary: "Update profile",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string", minLength: 2, maxLength: 255, examples: ["John Doe"] },
          avatarUrl: {
            type: "string",
            format: "uri",
            maxLength: 500,
            examples: ["https://example.com/avatar.png"],
          },
          uiLanguage: {
            type: "string",
            enum: [...ALLOWED_UI_LANGUAGES],
            examples: ["pt-BR"],
          },
          bio: { type: "string", maxLength: 500, examples: ["Developer and coffee lover"] },
          timezone: {
            type: "string",
            maxLength: 50,
            examples: ["America/Sao_Paulo"],
          },
        },
      },
      response: {
        200: { description: "Profile updated successfully", ...profileResponse },
        401: errorResponse("Unauthorized - invalid or missing token"),
        422: errorResponse("Validation failed"),
        404: errorResponse("Profile not found"),
      },
    },
    preHandler: authenticate,
    handler: controller.update,
  });
}
