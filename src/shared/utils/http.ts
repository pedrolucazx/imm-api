import type { FastifyReply } from "fastify";
import { ZodError } from "zod";
import { AppError } from "../errors/index.js";
import { logger } from "../../core/config/logger.js";

export function handleControllerError(error: unknown, reply: FastifyReply) {
  if (error instanceof AppError) {
    return reply.code(error.statusCode).send({ error: error.message });
  }
  if (error instanceof ZodError) {
    return reply.code(422).send({ error: "Validation failed", details: error.issues });
  }
  logger.error({ err: error }, "Unexpected error");
  return reply.code(500).send({ error: "Internal server error" });
}
