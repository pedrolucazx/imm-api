import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import cookie from "@fastify/cookie";

export const cookiePlugin = fp(
  async (fastify: FastifyInstance) => {
    await fastify.register(cookie);
  },
  { name: "cookie" }
);
