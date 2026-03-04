import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { env } from "../core/config/env.js";

export const swaggerPlugin = fp(
  async (fastify: FastifyInstance) => {
    await fastify.register(swagger, {
      swagger: {
        info: {
          title: "Inside My Mind API",
          description: "API documentation for Inside My Mind project",
          version: "1.0.0",
        },
        host: env.API_HOST,
        schemes: ["http", "https"],
        consumes: ["application/json"],
        produces: ["application/json"],
      },
    });

    await fastify.register(swaggerUI, {
      routePrefix: "/documentation",
    });
  },
  { name: "swagger" }
);
