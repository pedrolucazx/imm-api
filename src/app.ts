import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import { env } from "./core/config/env.js";
import { prettyTransport } from "./core/config/logger.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { habitsRoutes } from "./modules/habits/habits.routes.js";
import { journalRoutes } from "./modules/journal/journal.routes.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { usersRoutes } from "./modules/users/users.routes.js";
import { aiRoutes } from "./modules/ai-agents/ai.routes.js";
import { analyticsRoutes } from "./modules/analytics/analytics.routes.js";
import { consentsRoutes } from "./modules/consents/consents.routes.js";
import { pronunciationRoutes } from "./modules/pronunciation/pronunciation.routes.js";
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

  await fastify.register(healthRoutes);
  await fastify.register(authRoutes, { prefix: "/api" });
  await fastify.register(usersRoutes, { prefix: "/api" });
  await fastify.register(habitsRoutes, { prefix: "/api" });
  await fastify.register(journalRoutes, { prefix: "/api" });
  await fastify.register(aiRoutes, { prefix: "/api" });
  await fastify.register(analyticsRoutes, { prefix: "/api" });
  await fastify.register(consentsRoutes, { prefix: "/api" });
  await fastify.register(pronunciationRoutes, { prefix: "/api" });

  return fastify;
}
