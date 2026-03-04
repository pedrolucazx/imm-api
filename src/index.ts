import { env } from "./core/config/env.js";
import { buildApp } from "./app.js";
import { logger } from "./core/config/logger.js";
import { setTimeout } from "node:timers";

const SHUTDOWN_TIMEOUT = 10_000;

const start = async () => {
  try {
    const fastify = await buildApp();

    const shutdown = async () => {
      setTimeout(() => {
        fastify.log.error("Shutdown timed out, forcing exit");
        process.exit(1);
      }, SHUTDOWN_TIMEOUT).unref();

      try {
        await fastify.close();
        process.exit(0);
      } catch (err) {
        fastify.log.error(err, "Error during shutdown");
        process.exit(1);
      }
    };

    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);

    await fastify.listen({ port: env.PORT, host: "0.0.0.0" });

    const isProduction = env.NODE_ENV === "production";
    const baseUrl = isProduction ? `https://${env.API_HOST}` : `http://localhost:${env.PORT}`;

    fastify.log.info(`✓ Server running at ${baseUrl}\n`);
    fastify.log.info(`✓ API documentation at ${baseUrl}/documentation`);
  } catch (err) {
    logger.fatal(err, "Failed to start application");
    process.exit(1);
  }
};

start();
