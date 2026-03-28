import type { FastifyInstance } from "fastify";
import { getDb } from "../../core/database/connection.js";
import { authenticate } from "../../core/hooks/authenticate.js";
import { createPronunciationModule } from "./pronunciation.module.js";

const errorResponse = (description: string) => ({
  description,
  type: "object",
  properties: { error: { type: "string" } },
});

const pronunciationResultSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    userId: { type: "string", format: "uuid" },
    habitId: { type: "string", format: "uuid" },
    entryDate: { type: "string" },
    originalText: { type: "string" },
    transcription: { anyOf: [{ type: "string" }, { type: "null" }] },
    score: { anyOf: [{ type: "number" }, { type: "null" }] },
    missedWords: { type: "array", items: { type: "string" } },
    correctWords: { type: "array", items: { type: "string" } },
    extraWords: { type: "array", items: { type: "string" } },
    audioUrl: { anyOf: [{ type: "string" }, { type: "null" }] },
    createdAt: { type: "string" },
  },
};

const wordCloudItemSchema = {
  type: "object",
  properties: {
    word: { type: "string" },
    frequency: { type: "integer" },
  },
};

export async function pronunciationRoutes(fastify: FastifyInstance) {
  const { controller } = createPronunciationModule(getDb());

  fastify.post("/pronunciation/upload-url", {
    schema: {
      description:
        "Generate a signed URL to upload pronunciation audio directly to Supabase Storage",
      tags: ["Pronunciation"],
      summary: "Get audio upload URL",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["contentType"],
        additionalProperties: false,
        properties: {
          contentType: {
            type: "string",
            enum: ["audio/webm", "audio/mp4", "audio/ogg"],
            examples: ["audio/webm"],
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
        401: errorResponse("Unauthorized"),
        422: errorResponse("Invalid content type"),
      },
    },
    preHandler: authenticate,
    handler: controller.getAudioUploadUrl,
  });

  fastify.post("/pronunciation/analyze", {
    schema: {
      description: "Transcribe pronunciation audio via Gemini and return comparison score",
      tags: ["Pronunciation"],
      summary: "Analyze pronunciation",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["habitId", "audioUrl", "originalText"],
        additionalProperties: false,
        properties: {
          habitId: {
            type: "string",
            format: "uuid",
            examples: ["a1b2c3d4-e5f6-7890-abcd-ef1234567890"],
          },
          audioUrl: {
            type: "string",
            format: "uri",
            examples: [
              "https://project.supabase.co/storage/v1/object/public/audio-entries/user-id/file.webm",
            ],
          },
          originalText: {
            type: "string",
            minLength: 1,
            examples: ["The quick brown fox jumps over the lazy dog"],
          },
          entryDate: {
            type: "string",
            pattern: "^\\d{4}-\\d{2}-\\d{2}$",
            examples: ["2026-03-27"],
          },
        },
      },
      response: {
        201: { description: "Pronunciation analyzed", ...pronunciationResultSchema },
        400: errorResponse("Bad request — habit is not a language habit"),
        401: errorResponse("Unauthorized"),
        404: errorResponse("Habit not found"),
      },
    },
    preHandler: authenticate,
    handler: controller.analyze,
  });

  fastify.get("/pronunciation/word-cloud", {
    schema: {
      description: "Get the most frequently missed words for a language habit",
      tags: ["Pronunciation"],
      summary: "Get pronunciation word cloud",
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        required: ["habitId"],
        properties: {
          habitId: {
            type: "string",
            format: "uuid",
            examples: ["a1b2c3d4-e5f6-7890-abcd-ef1234567890"],
          },
        },
      },
      response: {
        200: {
          description: "Word cloud retrieved",
          type: "array",
          items: wordCloudItemSchema,
        },
        401: errorResponse("Unauthorized"),
        404: errorResponse("Habit not found"),
      },
    },
    preHandler: authenticate,
    handler: controller.getWordCloud,
  });
}
