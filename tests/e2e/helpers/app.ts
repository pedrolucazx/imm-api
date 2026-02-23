import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import cors from "@fastify/cors";
import { authRoutes } from "@/modules/auth/auth.routes.js";

export async function buildTestApp(): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: false });

  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET!,
  });

  await fastify.register(cors, { origin: "*" });

  fastify.get("/", async () => ({
    message: "Welcome to Inside My Mind API",
    version: "1.0.0",
  }));

  await fastify.register(authRoutes);
  await fastify.ready();

  return fastify;
}
