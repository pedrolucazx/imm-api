import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import { env } from "./core/config/env.js";
import { prettyTransport } from "./core/config/logger.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import {
  cookiePlugin,
  corsPlugin,
  helmetPlugin,
  jwtPlugin,
  rateLimitPlugin,
  swaggerPlugin,
} from "./plugins/index.js";

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: { level: env.LOG_LEVEL, transport: prettyTransport } });
  await fastify.register(helmetPlugin);
  await fastify.register(corsPlugin);
  await fastify.register(jwtPlugin);
  await fastify.register(rateLimitPlugin);
  await fastify.register(cookiePlugin);
  await fastify.register(swaggerPlugin);
  fastify.get("/", async () => ({
    message: "Welcome to Inside My Mind API",
    version: "1.0.0",
  }));

  await fastify.register(healthRoutes);
  await fastify.register(authRoutes);

  return fastify;
}
