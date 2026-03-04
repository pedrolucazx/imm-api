import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { env } from "../core/config/env.js";
import { API_VERSION } from "@/shared/utils/constants.js";

export const swaggerPlugin = fp(
  async (fastify: FastifyInstance) => {
    await fastify.register(swagger, {
      swagger: {
        info: {
          title: "Inside My Mind API",
          description: "API documentation for Inside My Mind project",
          version: API_VERSION,
        },
        host: env.API_HOST,
        schemes: ["http", "https"],
        consumes: ["application/json"],
        produces: ["application/json"],
        securityDefinitions: {
          Bearer: {
            type: "apiKey",
            name: "Authorization",
            in: "header",
            description: 'JWT Authorization header. Example: "Bearer {token}"',
          },
        },
        security: [{ Bearer: [] }],
      },
    });

    await fastify.register(swaggerUI, {
      routePrefix: "/documentation",
    });
  },
  { name: "swagger" }
);
