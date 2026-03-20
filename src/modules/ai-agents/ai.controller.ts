import type { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import type { AiService } from "./ai.service.js";
import { handleControllerError } from "../../shared/http/handle-error.js";

const analyzeSchema = z.object({
  journal_entry_id: z.uuid(),
  habit_id: z.uuid(),
});

export type AnalyzeInput = z.infer<typeof analyzeSchema>;

export function createAiController(service: AiService) {
  return {
    async analyze(request: FastifyRequest<{ Body: AnalyzeInput }>, reply: FastifyReply) {
      try {
        const { id: userId } = request.user;
        const data = analyzeSchema.parse(request.body);
        const result = await service.analyze(
          {
            journalEntryId: data.journal_entry_id,
            habitId: data.habit_id,
          },
          userId
        );
        return reply.code(200).send(result);
      } catch (error) {
        return handleControllerError(error, reply);
      }
    },
  };
}

export type AiController = ReturnType<typeof createAiController>;
