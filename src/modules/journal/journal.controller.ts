import type { FastifyRequest, FastifyReply } from "fastify";
import type { JournalService } from "./journal.service.js";
import {
  createJournalEntrySchema,
  updateJournalEntrySchema,
  type CreateJournalEntryInput,
  type UpdateJournalEntryInput,
} from "./journal.types.js";
import { handleControllerError } from "../../shared/utils/http.js";

export function createJournalController(service: JournalService) {
  return {
    async createEntry(
      request: FastifyRequest<{ Body: CreateJournalEntryInput }>,
      reply: FastifyReply
    ) {
      try {
        const { id: userId } = request.user;
        const data = createJournalEntrySchema.parse(request.body);
        const entry = await service.createEntry(userId, data);
        return reply.code(201).send(entry);
      } catch (error) {
        return handleControllerError(error, reply);
      }
    },

    async listEntries(
      request: FastifyRequest<{ Querystring: { habit_id: string; limit?: string } }>,
      reply: FastifyReply
    ) {
      try {
        const { id: userId } = request.user;
        const habitId = request.query.habit_id;
        const limit = request.query.limit ? parseInt(request.query.limit, 10) : 30;
        const entries = await service.listEntries(userId, habitId, limit);
        return reply.code(200).send(entries);
      } catch (error) {
        return handleControllerError(error, reply);
      }
    },

    async getEntryByDate(
      request: FastifyRequest<{ Params: { date: string }; Querystring: { habit_id: string } }>,
      reply: FastifyReply
    ) {
      try {
        const { id: userId } = request.user;
        const { date } = request.params;
        const habitId = request.query.habit_id;
        const entry = await service.getEntryByDate(userId, habitId, date);
        if (!entry) {
          return reply.code(404).send({ error: "Journal entry not found" });
        }
        return reply.code(200).send(entry);
      } catch (error) {
        return handleControllerError(error, reply);
      }
    },

    async updateEntry(
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateJournalEntryInput }>,
      reply: FastifyReply
    ) {
      try {
        const { id: userId } = request.user;
        const data = updateJournalEntrySchema.parse(request.body);
        const entry = await service.updateEntry(userId, request.params.id, data);
        return reply.code(200).send(entry);
      } catch (error) {
        return handleControllerError(error, reply);
      }
    },
  };
}

export type JournalController = ReturnType<typeof createJournalController>;
