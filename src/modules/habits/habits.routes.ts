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
        404: errorResponse("Habit not found"),
      },
    },
    preHandler: authenticate,
    handler: controller.getById,
  });

  fastify.post("/habits", {
    schema: {
      description: "Create a new habit",
      tags: ["Habits"],
      summary: "Create habit",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["name", "icon", "color"],
        additionalProperties: false,
        properties: {
          name: { type: "string", minLength: 1, maxLength: 255, examples: ["Meditar"] },
          targetSkill: { type: "string", maxLength: 100, examples: ["mindfulness"] },
          icon: { type: "string", minLength: 1, maxLength: 50, examples: ["🧘"] },
          color: { type: "string", minLength: 1, maxLength: 20, examples: ["#6366f1"] },
          frequency: { type: "string", enum: [...ALLOWED_FREQUENCIES], examples: ["daily"] },
          targetDays: { type: "integer", minimum: 1, maximum: 7, examples: [7] },
          isActive: { type: "boolean", examples: [true] },
          sortOrder: { type: "integer", examples: [0] },
          startDate: { type: "string", examples: ["2026-03-12"] },
        },
      },
      response: {
        201: { description: "Habit created", ...habitSchema },
        401: errorResponse("Unauthorized"),
        422: errorResponse("Validation failed or active habits limit reached"),
      },
    },
    preHandler: authenticate,
    handler: controller.create,
  });

  fastify.patch("/habits/:id", {
    schema: {
      description: "Update a habit",
      tags: ["Habits"],
      summary: "Update habit",
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
          name: { type: "string", minLength: 1, maxLength: 255 },
          targetSkill: { type: "string", maxLength: 100 },
          icon: { type: "string", minLength: 1, maxLength: 50 },
          color: { type: "string", minLength: 1, maxLength: 20 },
          frequency: { type: "string", enum: [...ALLOWED_FREQUENCIES] },
          targetDays: { type: "integer", minimum: 1, maximum: 7 },
          isActive: { type: "boolean" },
          sortOrder: { type: "integer" },
        },
      },
      response: {
        200: { description: "Habit updated", ...habitSchema },
        401: errorResponse("Unauthorized"),
        404: errorResponse("Habit not found"),
        422: errorResponse("Validation failed"),
      },
    },
    preHandler: authenticate,
    handler: controller.update,
  });

  fastify.delete("/habits/:id", {
    schema: {
      description: "Soft-delete a habit (sets isActive = false)",
      tags: ["Habits"],
      summary: "Delete habit",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        properties: { id: { type: "string", format: "uuid" } },
        required: ["id"],
      },
      response: {
        204: { description: "Habit deleted", type: "null" },
        401: errorResponse("Unauthorized"),
        404: errorResponse("Habit not found"),
      },
    },
    preHandler: authenticate,
    handler: controller.remove,
  });
}
