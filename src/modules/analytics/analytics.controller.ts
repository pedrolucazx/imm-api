import type { FastifyRequest, FastifyReply } from "fastify";
import type { AnalyticsService } from "./analytics.service.js";
import { habitIdQuerySchema } from "./analytics.types.js";
import { handleControllerError } from "../../shared/http/handle-error.js";

export function createAnalyticsController(service: AnalyticsService) {
  return {
    async getSummary(
      request: FastifyRequest<{ Querystring: { habitId?: string } }>,
      reply: FastifyReply
    ) {
      try {
        const { id: userId } = request.user;
        const { habitId } = habitIdQuerySchema.parse(request.query);
        const summary = await service.getSummary(userId, habitId);
        return reply.code(200).send(summary);
      } catch (error) {
        return handleControllerError(error, reply);
      }
    },
  };
}

export type AnalyticsController = ReturnType<typeof createAnalyticsController>;
