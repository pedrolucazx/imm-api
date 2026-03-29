import type { FastifyRequest, FastifyReply } from "fastify";
import type { PronunciationService } from "./pronunciation.service.js";
import { analyzePronunciationSchema, wordCloudQuerySchema } from "./pronunciation.types.js";
import { handleControllerError } from "../../shared/http/handle-error.js";
import {
  createAudioSignedUploadUrl,
  deleteAudioFile,
  isAllowedAudioContentType,
} from "../../core/storage/supabase-storage.js";
import { z } from "zod";

const deleteAudioSchema = z.object({ path: z.string().min(1) });

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

    async getAudioUploadUrl(request: FastifyRequest, reply: FastifyReply) {
      try {
        const { id: userId } = request.user;
        const { contentType } = request.body as { contentType: string };
        if (!isAllowedAudioContentType(contentType)) {
          return reply.code(422).send({ error: "Invalid content type" });
        }
        const result = await createAudioSignedUploadUrl(userId, contentType);
        return reply.code(200).send(result);
      } catch (error) {
        return handleControllerError(error, reply);
      }
    },

    async deleteOrphanAudio(request: FastifyRequest, reply: FastifyReply) {
      try {
        const { id: userId } = request.user;
        const { path } = deleteAudioSchema.parse(request.body);
        if (!path.startsWith(`${userId}/`)) {
          return reply.code(403).send({ error: "Forbidden" });
        }
        await deleteAudioFile(path);
        return reply.code(204).send();
      } catch (error) {
        return handleControllerError(error, reply);
      }
    },
  };
}

export type PronunciationController = ReturnType<typeof createPronunciationController>;
