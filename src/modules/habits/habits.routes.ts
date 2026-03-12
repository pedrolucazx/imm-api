import type { FastifyInstance } from "fastify";
import { getDb } from "../../core/database/connection.js";
import { authenticate } from "../../core/hooks/authenticate.js";
import { createHabitsModule } from "./habits.module.js";
import { ALLOWED_FREQUENCIES } from "./habits.types.js";

const habitSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "userId",
    "name",
    "icon",
    "color",
    "frequency",
    "targetDays",
    "isActive",
    "sortOrder",
    "habitPlan",
    "planStatus",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    userId: { type: "string", format: "uuid" },
    name: { type: "string" },
    targetSkill: { anyOf: [{ type: "string" }, { type: "null" }] },
    icon: { type: "string" },
    color: { type: "string" },
    frequency: { type: "string", enum: [...ALLOWED_FREQUENCIES] },
    targetDays: { type: "integer" },
    isActive: { type: "boolean" },
    sortOrder: { type: "integer" },
    startDate: { anyOf: [{ type: "string" }, { type: "null" }] },
    habitPlan: { type: "object" },
    planStatus: { type: "string" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
};

const errorResponse = (description: string) => ({
  description,
  type: "object",
  properties: { error: { type: "string" } },
});

export async function habitsRoutes(fastify: FastifyInstance) {
  const { controller } = createHabitsModule(getDb());

  fastify.get("/habits", {
    schema: {
      description: "List all habits for the authenticated user",
      tags: ["Habits"],
      summary: "List habits",
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          description: "Habits retrieved successfully",
          type: "array",
          items: habitSchema,
        },
        401: errorResponse("Unauthorized"),
      },
    },
    preHandler: authenticate,
    handler: controller.list,
  });

  fastify.get("/habits/:id", {
    schema: {
      description: "Get a specific habit by ID",
      tags: ["Habits"],
      summary: "Get habit",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        properties: { id: { type: "string", format: "uuid" } },
        required: ["id"],
      },
      response: {
        200: { description: "Habit retrieved successfully", ...habitSchema },
        401: errorResponse("Unauthorized"),
        403: errorResponse("Access denied"),
        404: errorResponse("Habit not found"),
      },
    },
    preHandler: authenticate,
    handler: controller.getById,
  });
}
