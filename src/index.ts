import { env } from "./core/config/env.js";
import { buildApp } from "./app.js";
import { setTimeout } from "timers";

const start = async () => {
  try {
    const fastify = await buildApp();

    const shutdown = async () => {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Shutdown timed out after 10s")), 10_000)
      );
      try {
        await Promise.race([fastify.close(), timeout]);
        process.exit(0);
      } catch (err) {
        fastify.log.error(err);
        process.exit(1);
      }
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);

    await fastify.listen({ port: env.PORT, host: "0.0.0.0" });

    const protocol = env.NODE_ENV === "production" ? "https" : "http";
    const baseUrl =
      env.NODE_ENV === "production"
        ? `${protocol}://${env.API_HOST}`
        : `${protocol}://localhost:${env.PORT}`;

    fastify.log.info(`✓ Server running at ${baseUrl}`);
    fastify.log.info(`✓ API documentation at ${baseUrl}/documentation`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
