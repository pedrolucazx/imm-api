import type { FastifyInstance } from "fastify";

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    "/health",
    {
      schema: {
        description: "Health check endpoint — prevents Render free tier from sleeping",
        tags: ["Health"],
        response: {
          200: {
            description: "Service is healthy",
            type: "object",
            properties: {
              status: { type: "string" },
              timestamp: { type: "string" },
              uptime: { type: "number" },
              environment: { type: "string" },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      return reply.status(200).send({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV ?? "production",
      });
    }
  );
}
