import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import { env } from "../core/config/env.js";

export const jwtPlugin = fp(
  async (fastify: FastifyInstance) => {
    await fastify.register(jwt, {
      secret: env.JWT_SECRET,
    });
  },
  { name: "jwt" }
);
