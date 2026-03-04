import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import rateLimit from "@fastify/rate-limit";
import { env } from "../core/config/env.js";

export const rateLimitPlugin = fp(
  async (fastify: FastifyInstance) => {
    await fastify.register(rateLimit, {
      max: env.RATE_LIMIT_MAX,
      timeWindow: env.RATE_LIMIT_TIMEWINDOW,
    });
  },
  { name: "rate-limit" }
);
