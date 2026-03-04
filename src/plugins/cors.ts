import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import cors from "@fastify/cors";
import { env } from "../core/config/env.js";

export const corsPlugin = fp(
  async (fastify: FastifyInstance) => {
    await fastify.register(cors, {
      origin: env.CORS_ORIGIN.includes(",")
        ? env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
        : env.CORS_ORIGIN,
      credentials: true,
    });
  },
  { name: "cors" }
);
