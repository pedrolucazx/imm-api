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

  fastify.post("/pronunciation/analyze", {
    schema: {
      description:
        "Transcribe pronunciation audio and return comparison score. Multipart form-data: " +
        "'habitId'/'originalText'/'entryDate' fields must come before the 'audio' file part.",
      tags: ["Pronunciation"],
      summary: "Analyze pronunciation",
      security: [{ bearerAuth: [] }],
      consumes: ["multipart/form-data"],
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
