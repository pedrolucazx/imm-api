import type { FastifyRequest, FastifyReply } from "fastify";
import { UnauthorizedError } from "../../shared/errors/index.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    user: { id: string; email: string };
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("Missing or invalid Authorization header");
    }

    const token = authHeader.slice(7);
    const payload = request.server.jwt.verify<{ id: string; email: string }>(token);

    request.user = { id: payload.id, email: payload.email };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return reply.code(401).send({ error: error.message });
    }
    return reply.code(401).send({ error: "Invalid or expired token" });
  }
}
