import type { FastifyInstance } from "fastify";
import { buildApp } from "@/app.js";

export async function buildTestApp(): Promise<FastifyInstance> {
  const fastify = await buildApp();
  await fastify.ready();
  return fastify;
}
