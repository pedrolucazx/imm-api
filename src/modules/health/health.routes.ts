import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { getDb } from "../../core/database/connection.js";

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    "/health",
    {
      schema: {
        description:
          "Health check endpoint — prevents Render free tier from sleeping and Supabase from pausing",
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
              database: { type: "string" },
            },
          },
          503: {
            description: "Service is degraded — database unreachable",
            type: "object",
            properties: {
              status: { type: "string" },
              timestamp: { type: "string" },
              uptime: { type: "number" },
              environment: { type: "string" },
              database: { type: "string" },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      let dbStatus = "ok";

      try {
        const db = getDb();
        await db.execute(sql`SELECT 1`);

        const usersTableCheck = await db.execute(
          sql`
            SELECT COUNT(*)::int AS table_count
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'users'
          `
        );

        if (Number(usersTableCheck[0]?.table_count ?? 0) === 0) {
          dbStatus = "error";
        }
      } catch {
        dbStatus = "error";
      }

      const httpStatus = dbStatus === "ok" ? 200 : 503;

      return reply.status(httpStatus).send({
        status: dbStatus === "ok" ? "ok" : "degraded",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV ?? "production",
        database: dbStatus,
      });
    }
  );
}
