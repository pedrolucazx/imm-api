import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import multipart from "@fastify/multipart";

export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

export const multipartPlugin = fp(
  async (fastify: FastifyInstance) => {
    await fastify.register(multipart, {
      limits: { fileSize: MAX_AUDIO_BYTES, files: 1, fields: 3, fieldSize: 16 * 1024, parts: 4 },
      throwFileSizeLimit: true,
    });
  },
  { name: "multipart" }
);
