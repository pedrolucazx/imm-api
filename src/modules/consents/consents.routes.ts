import type { FastifyInstance } from "fastify";
import { getDb } from "../../core/database/connection.js";
import { authenticate } from "../../core/hooks/authenticate.js";
import { createConsentsModule } from "./consents.module.js";

const consentResponseSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    type: { type: "string", enum: ["cookie_consent", "privacy_policy", "terms_of_use"] },
    version: { type: "string" },
    acceptedAt: { type: "string" },
  },
};

export async function consentsRoutes(fastify: FastifyInstance) {
  const { controller } = createConsentsModule(getDb());

  fastify.post("/consents", {
    schema: {
      description: "Save user consent for privacy policy, cookies, or terms of use",
      tags: ["Consents"],
      summary: "Save consent",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["type"],
        properties: {
          type: {
            type: "string",
            enum: ["cookie_consent", "privacy_policy", "terms_of_use"],
            description: "Type of consent",
          },
        },
      },
      response: {
        201: consentResponseSchema,
        400: {
          description: "Validation error",
          type: "object",
          properties: { error: { type: "string" } },
        },
        401: {
          description: "Unauthorized",
          type: "object",
          properties: { error: { type: "string" } },
        },
        500: {
          description: "Internal server error",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    preHandler: authenticate,
    handler: controller.save,
  });

  fastify.get("/consents", {
    schema: {
      description: "Get all consents for the authenticated user",
      tags: ["Consents"],
      summary: "List consents",
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: "array",
          items: consentResponseSchema,
        },
        401: {
          description: "Unauthorized",
          type: "object",
          properties: { error: { type: "string" } },
        },
        500: {
          description: "Internal server error",
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    preHandler: authenticate,
    handler: controller.list,
  });
}
