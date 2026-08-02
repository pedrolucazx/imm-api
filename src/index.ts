import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";
import { loadSecretsFromSsm } from "./core/config/load-secrets.js";
import { logger } from "./core/config/logger.js";
import { setTimeout } from "node:timers";

// Must run before loadSecretsFromSsm() reads process.env.NODE_ENV — that's
// otherwise unset until env.ts's own dotenv call, which happens after.
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  config({ path: envPath, quiet: true });
}

const SHUTDOWN_TIMEOUT = 10_000;

const start = async () => {
  try {
    // Must resolve before env.js is imported below — it parses process.env
    // synchronously at import time, so SSM-sourced secrets need to already
    // be in process.env by then.
    await loadSecretsFromSsm();
    const { env } = await import("./core/config/env.js");
    const { buildApp } = await import("./app.js");

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
