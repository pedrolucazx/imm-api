import type { FastifyRequest, FastifyReply } from "fastify";
import type { HabitsService } from "./habits.service.js";
import {
  createHabitSchema,
  updateHabitSchema,
  checkInSchema,
  createWithPlanSchema,
  regeneratePlanSchema,
  type CreateHabitInput,
  type UpdateHabitInput,
  type CheckInInput,
  type CreateWithPlanInput,
  type RegeneratePlanInput,
} from "./habits.types.js";
import { handleControllerError } from "../../shared/utils/http.js";

export function createHabitsController(service: HabitsService) {
  return {
    async list(request: FastifyRequest, reply: FastifyReply) {
      try {
        const { id } = request.user;
        const habits = await service.list(id);
        return reply.code(200).send(habits);
      } catch (error) {
        return handleControllerError(error, reply);
      }
    },

    async getById(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
      try {
        const { id: userId } = request.user;
        const habit = await service.getById(userId, request.params.id);
        return reply.code(200).send(habit);
      } catch (error) {
        return handleControllerError(error, reply);
      }
    },

    async create(request: FastifyRequest<{ Body: CreateHabitInput }>, reply: FastifyReply) {
      try {
        const { id: userId } = request.user;
        const data = createHabitSchema.parse(request.body);
        const habit = await service.create(userId, data);
        return reply.code(201).send(habit);
      } catch (error) {
        return handleControllerError(error, reply);
      }
    },

    async update(
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateHabitInput }>,
      reply: FastifyReply
    ) {
      try {
        const { id: userId } = request.user;
        const data = updateHabitSchema.parse(request.body);
        const habit = await service.update(userId, request.params.id, data);
        return reply.code(200).send(habit);
      } catch (error) {
        return handleControllerError(error, reply);
      }
    },

    async remove(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
      try {
        const { id: userId } = request.user;
        await service.remove(userId, request.params.id);
        return reply.code(204).send();
      } catch (error) {
        return handleControllerError(error, reply);
      }
    },

    async checkIn(
      request: FastifyRequest<{ Params: { id: string }; Body: CheckInInput }>,
      reply: FastifyReply
    ) {
      try {
        const { id: userId } = request.user;
        const data = checkInSchema.parse(request.body);
        const log = await service.checkIn(userId, request.params.id, data);
        return reply.code(200).send(log);
      } catch (error) {
        return handleControllerError(error, reply);
      }
    },

    async createWithPlan(
      request: FastifyRequest<{ Body: CreateWithPlanInput }>,
      reply: FastifyReply
    ) {
      try {
        const { id: userId } = request.user;
        const data = createWithPlanSchema.parse(request.body);
        const habit = await service.createWithPlan(userId, data);
        return reply.code(201).send(habit);
      } catch (error) {
        return handleControllerError(error, reply);
      }
    },

    async regeneratePlan(
      request: FastifyRequest<{ Params: { id: string }; Body: RegeneratePlanInput }>,
      reply: FastifyReply
    ) {
      try {
        const { id: userId } = request.user;
        const data = regeneratePlanSchema.parse(request.body);
        const habit = await service.regeneratePlan(userId, request.params.id, data);
        return reply.code(200).send(habit);
      } catch (error) {
        return handleControllerError(error, reply);
      }
    },
  };
}

export type HabitsController = ReturnType<typeof createHabitsController>;
