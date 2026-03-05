import type { FastifyRequest, FastifyReply } from "fastify";
import { ZodError } from "zod";
import { authService } from "./auth.service.js";
import { registerSchema, loginSchema, type RegisterInput, type LoginInput } from "./auth.types.js";
import { AppError } from "../../shared/errors/index.js";

function handleControllerError(error: unknown, reply: FastifyReply) {
  if (error instanceof AppError) {
    return reply.code(error.statusCode).send({ error: error.message });
  }
  if (error instanceof ZodError) {
    return reply.code(422).send({ error: "Validation failed", details: error.issues });
  }
  console.error("Unexpected error:", error);
  return reply.code(500).send({ error: "Internal server error" });
}

export class AuthController {
  async register(request: FastifyRequest<{ Body: RegisterInput }>, reply: FastifyReply) {
    try {
      const data = registerSchema.parse(request.body);
      const result = await authService.register(data);
      const token = request.server.jwt.sign({
        id: result.user.id,
        email: result.user.email,
      });

      return reply.code(201).send({ token, user: result.user });
    } catch (error) {
      return handleControllerError(error, reply);
    }
  }

  async login(request: FastifyRequest<{ Body: LoginInput }>, reply: FastifyReply) {
    try {
      const data = loginSchema.parse(request.body);
      const result = await authService.login(data);
      const token = request.server.jwt.sign({
        id: result.user.id,
        email: result.user.email,
      });

      return reply.code(200).send({ token, user: result.user });
    } catch (error) {
      return handleControllerError(error, reply);
    }
  }
}

export const authController = new AuthController();
