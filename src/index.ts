import { env } from "./core/config/env.js";
import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";

const start = async () => {
  const fastify = Fastify({
    logger: true,
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

  try {
    await fastify.listen({ port: env.PORT });
    fastify.log.info(`Server is running on http://localhost:${env.PORT}`);
    fastify.log.info(
      `Swagger documentation available at http://localhost:${env.PORT}/documentation`
    );
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
