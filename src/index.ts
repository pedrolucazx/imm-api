import { env } from "./core/config/env.js";
import { buildApp } from "./app.js";

const start = async () => {
  const fastify = await buildApp();

  const shutdown = async () => {
    await fastify.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

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
    process.exit(1);
  }
};

start();
