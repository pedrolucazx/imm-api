import type { FastifyRequest, FastifyReply } from "fastify";
import type { PronunciationService } from "./pronunciation.service.js";
import { analyzePronunciationSchema, wordCloudQuerySchema } from "./pronunciation.types.js";
import { handleControllerError } from "../../shared/http/handle-error.js";

export function createPronunciationController(service: PronunciationService) {
  return {
    async analyze(request: FastifyRequest, reply: FastifyReply) {
      try {
        const { id: userId } = request.user;
        const input = analyzePronunciationSchema.parse(request.body);
        const result = await service.analyze(userId, input);
        return reply.code(201).send(result);
      } catch (error) {
        return handleControllerError(error, reply);
      }
    },

    async getWordCloud(request: FastifyRequest, reply: FastifyReply) {
      try {
        const { id: userId } = request.user;
        const { habitId } = wordCloudQuerySchema.parse(request.query);
        const wordCloud = await service.getWordCloud(userId, habitId);
        return reply.code(200).send(wordCloud);
      } catch (error) {
        return handleControllerError(error, reply);
      }
    },
  };
}

export type PronunciationController = ReturnType<typeof createPronunciationController>;
