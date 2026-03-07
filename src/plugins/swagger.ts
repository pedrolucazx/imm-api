import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { env } from "../core/config/env.js";
import { API_VERSION } from "@/shared/constants.js";

export const swaggerPlugin = fp(
  async (fastify: FastifyInstance) => {
    await fastify.register(swagger, {
      openapi: {
        info: {
          title: "Inside My Mind API",
          description: "API documentation for Inside My Mind project",
          version: API_VERSION,
        },
        servers: [
          {
            url: `http://${env.API_HOST}`,
            description: "Development server",
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    });

    await fastify.register(swaggerUI, {
      routePrefix: "/documentation",
      uiConfig: {
        persistAuthorization: true,
      },
    });
  },
  { name: "swagger" }
);
