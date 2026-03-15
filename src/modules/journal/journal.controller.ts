import type { FastifyRequest, FastifyReply } from "fastify";
import type { JournalService } from "./journal.service.js";
import {
  createJournalEntrySchema,
  updateJournalEntrySchema,
  type CreateJournalEntryInput,
  type UpdateJournalEntryInput,
} from "./journal.types.js";
import { handleControllerError } from "../../shared/utils/http.js";

/**
 * Factory function to create a JournalController instance.
 * @param service - The journal service instance
 * @returns Controller with HTTP handlers for journal endpoints
 */
export function createJournalController(service: JournalService) {
  return {
    /**
     * HTTP handler for creating a journal entry.
     * @param request - The Fastify request object
     * @param reply - The Fastify reply object
     * @returns HTTP response with created entry or error
     */
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

    /**
     * HTTP handler for listing journal entries.
     * @param request - The Fastify request object
     * @param reply - The Fastify reply object
     * @returns HTTP response with entries array or error
     */
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

    /**
     * HTTP handler for getting a journal entry by date.
     * @param request - The Fastify request object
     * @param reply - The Fastify reply object
     * @returns HTTP response with entry or error
     */
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

    /**
     * HTTP handler for updating a journal entry.
     * @param request - The Fastify request object
     * @param reply - The Fastify reply object
     * @returns HTTP response with updated entry or error
     */
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

/**
 * Type representing the JournalController instance.
 */
export type JournalController = ReturnType<typeof createJournalController>;
