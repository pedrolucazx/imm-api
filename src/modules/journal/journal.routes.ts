import type { FastifyInstance } from "fastify";
import { getDb } from "../../core/database/connection.js";
import { authenticate } from "../../core/hooks/authenticate.js";
import { createJournalModule } from "./journal.module.js";

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
    aiFeedback: { anyOf: [{ type: "object", additionalProperties: true }, { type: "null" }] },
    aiAgentType: { anyOf: [{ type: "string" }, { type: "null" }] },
    moodScore: { anyOf: [{ type: "integer" }, { type: "null" }] },
    energyScore: { anyOf: [{ type: "integer" }, { type: "null" }] },
    audioUrl: { anyOf: [{ type: "string" }, { type: "null" }] },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
};

const errorResponse = (description: string) => ({
  description,
  type: "object",
  properties: { error: { type: "string" } },
});

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
          entryDate: {
            type: "string",
            pattern: "^\\d{4}-\\d{2}-\\d{2}$",
            examples: ["2026-03-16"],
          },
          moodScore: { type: "integer", minimum: 1, maximum: 5, examples: [4] },
          energyScore: { type: "integer", minimum: 1, maximum: 5, examples: [3] },
          audioUrl: {
            type: "string",
            format: "uri",
            examples: [
              "https://project.supabase.co/storage/v1/object/public/audio-entries/user-id/file.webm",
            ],
          },
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
        properties: {
          habit_id: { type: "string", format: "uuid" },
          date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
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

  fastify.get("/journal/history", {
    schema: {
      description: "List all journal entries for the authenticated user",
      tags: ["Journal"],
      summary: "List journal history",
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 365 },
        },
      },
      response: {
        200: {
          description: "Journal history retrieved",
          type: "array",
          items: journalEntrySchema,
        },
        401: errorResponse("Unauthorized"),
      },
    },
    preHandler: authenticate,
    handler: controller.listHistory,
  });

  fastify.post("/journal/transcribe", {
    schema: {
      description: "Transcribe audio via Gemini and return the transcription text",
      tags: ["Journal"],
      summary: "Transcribe audio for journal entry",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["audioUrl", "habitId"],
        additionalProperties: false,
        properties: {
          audioUrl: {
            type: "string",
            format: "uri",
            examples: [
              "https://project.supabase.co/storage/v1/object/public/audio-entries/user-id/file.webm",
            ],
          },
          habitId: {
            type: "string",
            format: "uuid",
            examples: ["a1b2c3d4-e5f6-7890-abcd-ef1234567890"],
          },
        },
      },
      response: {
        200: {
          description: "Audio transcribed successfully",
          type: "object",
          additionalProperties: false,
          required: ["transcription"],
          properties: {
            transcription: { type: "string" },
          },
        },
        400: errorResponse("Habit is not a language habit"),
        401: errorResponse("Unauthorized"),
        404: errorResponse("Habit not found"),
      },
    },
    preHandler: authenticate,
    handler: controller.transcribe,
  });
}
