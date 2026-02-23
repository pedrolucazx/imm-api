import type { FastifyRequest, FastifyReply } from "fastify";
import { authService } from "./auth.service.js";
import { registerSchema, loginSchema, type RegisterInput, type LoginInput } from "./auth.types.js";

export class AuthController {
  /**
   * Register endpoint - POST /auth/register
   */
  async register(request: FastifyRequest<{ Body: RegisterInput }>, reply: FastifyReply) {
    try {
      // Validate request body
      const data = registerSchema.parse(request.body);

      // Register user
      const result = await authService.register(data);

      // Generate JWT token
      const token = request.server.jwt.sign({
        id: result.user.id,
        email: result.user.email,
      });

      return reply.code(201).send({
        token,
        user: result.user,
      });
    } catch (error) {
      if (error instanceof Error) {
        return reply.code(400).send({
          error: error.message,
        });
      }
      /* istanbul ignore next */
      return reply.code(500).send({
        error: "Internal server error",
      });
    }
  }

  /**
   * Login endpoint - POST /auth/login
   */
  async login(request: FastifyRequest<{ Body: LoginInput }>, reply: FastifyReply) {
    try {
      // Validate request body
      const data = loginSchema.parse(request.body);

      // Login user
      const result = await authService.login(data);

      // Generate JWT token
      const token = request.server.jwt.sign({
        id: result.user.id,
        email: result.user.email,
      });

      return reply.code(200).send({
        token,
        user: result.user,
      });
    } catch (error) {
      if (error instanceof Error) {
        return reply.code(401).send({
          error: error.message,
        });
      }
      /* istanbul ignore next */
      return reply.code(500).send({
        error: "Internal server error",
      });
    }
  }
}

export const authController = new AuthController();
