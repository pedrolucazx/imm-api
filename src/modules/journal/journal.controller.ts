import type { FastifyRequest, FastifyReply } from "fastify";
import type { JournalService } from "./journal.service.js";
import {
  createJournalEntrySchema,
  transcribeSchema,
  type CreateJournalEntryInput,
  type TranscribeInput,
} from "./journal.types.js";
import { handleControllerError } from "../../shared/http/handle-error.js";

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
      request: FastifyRequest<{
        Querystring: { habit_id?: string; limit?: string; date?: string };
      }>,
      reply: FastifyReply
    ) {
      try {
        const { id: userId } = request.user;
        const { habit_id: habitId, date } = request.query;

        if (!habitId && !date) {
          return reply.code(400).send({ error: "habit_id or date is required" });
        }

        if (date && !habitId) {
          const entries = await service.listEntriesByDate(userId, date);
          return reply.code(200).send(entries);
        }

        const limit = request.query.limit ? parseInt(request.query.limit, 10) : 30;
        const entries = await service.listEntries(userId, habitId!, limit);
        return reply.code(200).send(entries);
      } catch (error) {
        return handleControllerError(error, reply);
      }
    },

    async transcribe(request: FastifyRequest<{ Body: TranscribeInput }>, reply: FastifyReply) {
      try {
        const { id: userId } = request.user;
        const data = transcribeSchema.parse(request.body);
        const result = await service.transcribe(userId, data);
        return reply.code(200).send(result);
      } catch (error) {
        return handleControllerError(error, reply);
      }
    },

    async listHistory(
      request: FastifyRequest<{ Querystring: { limit?: string } }>,
      reply: FastifyReply
    ) {
      try {
        const { id: userId } = request.user;
        const limit = request.query.limit ? parseInt(request.query.limit, 10) : 100;
        const entries = await service.listHistory(userId, limit);
        return reply.code(200).send(entries);
      } catch (error) {
        return handleControllerError(error, reply);
      }
    },
  };
}

export type JournalController = ReturnType<typeof createJournalController>;
