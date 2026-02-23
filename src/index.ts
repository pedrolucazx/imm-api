import { env } from "./core/config/env.js";
import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import jwt from "@fastify/jwt";
import cors from "@fastify/cors";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { healthRoutes } from "./modules/health/health.routes.js";

const start = async () => {
  const fastify = Fastify({
    logger: {
      level: env.LOG_LEVEL || "info",
      transport:
        env.NODE_ENV === "development"
          ? {
              target: "pino-pretty",
              options: {
                colorize: true,
                translateTime: "HH:MM:ss",
                ignore: "pid,hostname",
                singleLine: false,
                hideObject: false,
              },
            }
          : undefined,
    },
  });

  // Register JWT plugin
  await fastify.register(jwt, {
    secret: env.JWT_SECRET,
  });

  // Register CORS plugin
  await fastify.register(cors, {
    origin: env.CORS_ORIGIN.includes(",")
      ? env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
      : env.CORS_ORIGIN,
    credentials: true,
  });

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

  fastify.get(
    "/",
    {
      schema: {
        description: "Welcome endpoint",
        tags: ["General"],
        response: {
          200: {
            description: "Successful response",
            type: "object",
            properties: {
              message: { type: "string" },
              version: { type: "string" },
            },
          },
        },
      },
    },
    async () => {
      return {
        message: "Welcome to Inside My Mind API",
        version: "1.0.0",
      };
    }
  );

  // Register health route (anti-sleep ping target)
  await fastify.register(healthRoutes);

  // Register auth routes
  await fastify.register(authRoutes);

  try {
    await fastify.listen({ port: env.PORT, host: "0.0.0.0" });

    const protocol = env.NODE_ENV === "production" ? "https" : "http";
    const baseUrl =
      env.NODE_ENV === "production"
        ? `${protocol}://${env.API_HOST}`
        : `${protocol}://localhost:${env.PORT}`;

    fastify.log.info(`✓ Server running at ${baseUrl}`);
    fastify.log.info(`✓ API documentation at ${baseUrl}/documentation`);
  } catch (err) {
    fastify.log.error(err);
  }
};

start();
