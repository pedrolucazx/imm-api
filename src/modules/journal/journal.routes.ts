import type { FastifyInstance } from "fastify";
import { getDb } from "../../core/database/connection.js";
import { authenticate } from "../../core/hooks/authenticate.js";
import { createJournalModule } from "./journal.module.js";

/**
 * Schema for journal entry response.
 */
const journalEntrySchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "userId", "habitId", "entryDate", "content", "createdAt", "updatedAt"],
  properties: {
    id: { type: "string", format: "uuid" },
    userId: { type: "string", format: "uuid" },
    habitId: { type: "string", format: "uuid" },
    entryDate: { type: "string" },
    content: { type: "string" },
    wordCount: { anyOf: [{ type: "integer" }, { type: "null" }] },
    uiLanguageSnap: { anyOf: [{ type: "string" }, { type: "null" }] },
    targetSkillSnap: { anyOf: [{ type: "string" }, { type: "null" }] },
    aiFeedback: { anyOf: [{ type: "object" }, { type: "null" }] },
    aiAgentType: { anyOf: [{ type: "string" }, { type: "null" }] },
    moodScore: { anyOf: [{ type: "integer" }, { type: "null" }] },
    energyScore: { anyOf: [{ type: "integer" }, { type: "null" }] },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
};

/**
 * Creates an error response schema for OpenAPI documentation.
 * @param description - The error description
 * @returns OpenAPI schema for error response
 */
const errorResponse = (description: string) => ({
  description,
  type: "object",
  properties: { error: { type: "string" } },
});

/**
 * Registers journal-related routes in the Fastify application.
 * @param fastify - The Fastify instance
 */
export async function journalRoutes(fastify: FastifyInstance) {
  const { controller } = createJournalModule(getDb());

  fastify.post("/journal/entry", {
    schema: {
      description: "Create or update a journal entry for today (idempotent)",
      tags: ["Journal"],
      summary: "Create journal entry",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["habitId", "content"],
        additionalProperties: false,
        properties: {
          habitId: {
            type: "string",
            format: "uuid",
            examples: ["a1b2c3d4-e5f6-7890-abcd-ef1234567890"],
          },
          content: {
            type: "string",
            minLength: 1,
            examples: ["Today I practiced meditation for 20 minutes..."],
          },
          moodScore: { type: "integer", minimum: 1, maximum: 5, examples: [4] },
          energyScore: { type: "integer", minimum: 1, maximum: 5, examples: [3] },
        },
      },
      response: {
        201: { description: "Journal entry created", ...journalEntrySchema },
        401: errorResponse("Unauthorized"),
        404: errorResponse("Habit not found"),
      },
    },
    preHandler: authenticate,
    handler: controller.createEntry,
  });

  fastify.get("/journal/entries", {
    schema: {
      description: "List journal entries for a habit",
      tags: ["Journal"],
      summary: "List journal entries",
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        required: ["habit_id"],
        properties: {
          habit_id: { type: "string", format: "uuid" },
          limit: { type: "integer", minimum: 1, maximum: 100, default: 30 },
        },
      },
      response: {
        200: {
          description: "Journal entries retrieved",
          type: "array",
          items: journalEntrySchema,
        },
        401: errorResponse("Unauthorized"),
        404: errorResponse("Habit not found"),
      },
    },
    preHandler: authenticate,
    handler: controller.listEntries,
  });

  fastify.get("/journal/entry/:date", {
    schema: {
      description: "Get a journal entry by date",
      tags: ["Journal"],
      summary: "Get journal entry by date",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        properties: { date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" } },
        required: ["date"],
      },
      querystring: {
        type: "object",
        required: ["habit_id"],
        properties: { habit_id: { type: "string", format: "uuid" } },
      },
      response: {
        200: { description: "Journal entry retrieved", ...journalEntrySchema },
        401: errorResponse("Unauthorized"),
        404: errorResponse("Journal entry not found"),
      },
    },
    preHandler: authenticate,
    handler: controller.getEntryByDate,
  });

  fastify.patch("/journal/entry/:id", {
    schema: {
      description: "Update a journal entry",
      tags: ["Journal"],
      summary: "Update journal entry",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        properties: { id: { type: "string", format: "uuid" } },
        required: ["id"],
      },
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          content: { type: "string", minLength: 1 },
          moodScore: { type: "integer", minimum: 1, maximum: 5 },
          energyScore: { type: "integer", minimum: 1, maximum: 5 },
        },
      },
      response: {
        200: { description: "Journal entry updated", ...journalEntrySchema },
        401: errorResponse("Unauthorized"),
        404: errorResponse("Journal entry not found"),
      },
    },
    preHandler: authenticate,
    handler: controller.updateEntry,
  });
}
