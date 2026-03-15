import type { FastifyInstance } from "fastify";
import { getDb } from "../../core/database/connection.js";
import { authenticate } from "../../core/hooks/authenticate.js";
import { createAiModule } from "./ai.module.js";

const aiFeedbackSchema = {
  type: "object",
  additionalProperties: true,
};

const errorResponse = (description: string) => ({
  description,
  type: "object",
  properties: { error: { type: "string" } },
});

export async function aiRoutes(fastify: FastifyInstance) {
  const { controller } = createAiModule(getDb());

  fastify.post("/ai/analyze", {
    schema: {
      description: "Analyze a journal entry with AI agent",
      tags: ["AI"],
      summary: "Analyze journal entry with AI",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["journal_entry_id", "habit_id"],
        additionalProperties: false,
        properties: {
          journal_entry_id: {
            type: "string",
            format: "uuid",
            examples: ["a1b2c3d4-e5f6-7890-abcd-ef1234567890"],
          },
          habit_id: {
            type: "string",
            format: "uuid",
            examples: ["b2c3d4e5-f6a7-8901-bcde-f12345678901"],
          },
        },
      },
      response: {
        200: {
          description: "AI analysis completed",
          type: "object",
          required: ["aiFeedback", "aiAgentType"],
          properties: {
            aiFeedback: aiFeedbackSchema,
            aiAgentType: { type: "string", enum: ["language-teacher", "behavioral-coach"] },
          },
        },
        401: errorResponse("Unauthorized"),
        403: errorResponse("Rate limit exceeded"),
        404: errorResponse("Journal entry or habit not found"),
      },
    },
    preHandler: authenticate,
    handler: controller.analyze,
  });
}
