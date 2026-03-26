import type { FastifyInstance } from "fastify";
import { getDb } from "../../core/database/connection.js";
import { authenticate } from "../../core/hooks/authenticate.js";
import { createAnalyticsModule } from "./analytics.module.js";

const habitStatSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    name: { type: "string" },
    icon: { type: "string" },
    color: { type: "string" },
    currentDay: { type: "number" },
    streak: { type: "number" },
    bestStreak: { type: "number" },
    consistencyRate: { type: "number" },
    totalCompletedDays: { type: "number" },
    targetSkill: { type: "string", nullable: true },
    planStatus: { type: "string" },
    habitPlan: {
      nullable: true,
      type: "object",
      additionalProperties: true,
    },
    logs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          logDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          completed: { type: "boolean" },
        },
      },
    },
    scoreTimeline: {
      nullable: true,
      type: "array",
      items: {
        type: "object",
        properties: {
          date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          grammarScore: { type: "number" },
          vocabularyScore: { type: "number" },
          fluencyScore: { type: "number" },
        },
      },
    },
  },
};

const errorResponse = (description: string) => ({
  description,
  type: "object",
  properties: { error: { type: "string" } },
});

const validationErrorResponse = {
  description: "Validation error",
  type: "object",
  properties: {
    statusCode: { type: "number" },
    error: { type: "string" },
    message: { type: "string" },
  },
};

const serverErrorResponse = {
  description: "Internal server error",
  type: "object",
  properties: {
    statusCode: { type: "number" },
    error: { type: "string" },
    message: { type: "string" },
  },
};

export async function analyticsRoutes(fastify: FastifyInstance) {
  const { controller } = createAnalyticsModule(getDb());

  fastify.get("/analytics/summary", {
    schema: {
      description: "Get aggregated analytics summary for the authenticated user",
      tags: ["Analytics"],
      summary: "Analytics summary",
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          habitId: { type: "string", format: "uuid", description: "Filter by specific habit" },
          timezone: { type: "string", description: "IANA timezone name (e.g. America/Sao_Paulo)" },
        },
      },
      response: {
        200: {
          description: "Analytics summary retrieved successfully",
          type: "object",
          properties: {
            habits: {
              type: "array",
              items: habitStatSchema,
            },
            global: {
              type: "object",
              properties: {
                completionRateToday: { type: "number" },
                avgConsistencyRate: { type: "number" },
                totalJournalEntries: { type: "number" },
                totalWords: { type: "number" },
                avgWordsPerEntry: { type: "number" },
                avgMood: { type: "number", nullable: true },
                avgEnergy: { type: "number", nullable: true },
                aiRequestsToday: { type: "number" },
                moodConsistencyCorrelation: {
                  nullable: true,
                  type: "object",
                  properties: {
                    highMoodRate: { type: "number" },
                    lowMoodRate: { type: "number" },
                  },
                },
                bestPerformanceHour: {
                  type: "string",
                  nullable: true,
                  pattern: "^([01]\\d|2[0-3]):00$",
                },
              },
            },
            moodTimeline: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
                  mood: { type: "number", nullable: true },
                  energy: { type: "number", nullable: true },
                },
              },
            },
          },
        },
        400: validationErrorResponse,
        401: errorResponse("Unauthorized"),
        500: serverErrorResponse,
      },
    },
    preHandler: authenticate,
    handler: controller.getSummary,
  });
}
