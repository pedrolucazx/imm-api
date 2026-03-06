import type { FastifyRequest, FastifyReply } from "fastify";
import { ZodError } from "zod";
import { authService } from "./auth.service.js";
import { registerSchema, loginSchema, type RegisterInput, type LoginInput } from "./auth.types.js";
import { AppError } from "../../shared/errors/index.js";
import { REFRESH_TOKEN_EXPIRES_MS } from "../../shared/constants.js";
import { logger } from "../../core/config/logger.js";

function handleControllerError(error: unknown, reply: FastifyReply) {
  if (error instanceof AppError) {
    return reply.code(error.statusCode).send({ error: error.message });
  }
  if (error instanceof ZodError) {
    return reply.code(422).send({ error: "Validation failed", details: error.issues });
  }
  logger.error({ err: error }, "Unexpected error");
  return reply.code(500).send({ error: "Internal server error" });
}

function setRefreshTokenCookie(reply: FastifyReply, token: string) {
  reply.setCookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: Math.floor(REFRESH_TOKEN_EXPIRES_MS / 1000),
    path: "/",
  });
}

function clearRefreshTokenCookie(reply: FastifyReply) {
  reply.clearCookie("refreshToken", {
    path: "/",
  });
}

export class AuthController {
  async register(request: FastifyRequest<{ Body: RegisterInput }>, reply: FastifyReply) {
    try {
      const data = registerSchema.parse(request.body);
      const jwt = request.server.jwt.sign.bind(request.server.jwt);
      const result = await authService.register(data, jwt);

      setRefreshTokenCookie(reply, result.refreshToken);

      return reply.code(201).send({ accessToken: result.accessToken, user: result.user });
    } catch (error) {
      return handleControllerError(error, reply);
    }
  }

  async login(request: FastifyRequest<{ Body: LoginInput }>, reply: FastifyReply) {
    try {
      const data = loginSchema.parse(request.body);
      const jwt = request.server.jwt.sign.bind(request.server.jwt);
      const result = await authService.login(data, jwt);

      setRefreshTokenCookie(reply, result.refreshToken);

      return reply.code(200).send({ accessToken: result.accessToken, user: result.user });
    } catch (error) {
      return handleControllerError(error, reply);
    }
  }

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    try {
      const refreshToken = request.cookies.refreshToken;
      if (!refreshToken) {
        return reply.code(401).send({ error: "Refresh token not provided" });
      }

      const jwt = request.server.jwt.sign.bind(request.server.jwt);
      const result = await authService.refresh(refreshToken, jwt);

      setRefreshTokenCookie(reply, result.refreshToken);

      return reply.code(200).send({ accessToken: result.accessToken, user: result.user });
    } catch (error) {
      return handleControllerError(error, reply);
    }
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    try {
      const refreshToken = request.cookies.refreshToken;
      if (refreshToken) {
        await authService.logout(refreshToken);
      }

      clearRefreshTokenCookie(reply);
      return reply.code(204).send();
    } catch (error) {
      return handleControllerError(error, reply);
    }
  }
}

export const authController = new AuthController();
