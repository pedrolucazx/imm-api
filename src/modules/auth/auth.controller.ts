import type { FastifyRequest, FastifyReply } from "fastify";
import type { AuthService } from "./auth.service.js";
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  type RegisterInput,
  type LoginInput,
  type VerifyEmailInput,
  type ResendVerificationInput,
} from "./auth.types.js";
import { AppError } from "../../shared/errors/index.js";
import { REFRESH_TOKEN_EXPIRES_MS } from "../../shared/constants.js";
import { handleControllerError } from "../../shared/http/handle-error.js";
import { env } from "../../core/config/env.js";

export function createAuthController(service: AuthService) {
  const isProduction = env.NODE_ENV === "production";

  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? "none" : "lax") as "none" | "lax",
    path: "/",
  };

  function setRefreshTokenCookie(reply: FastifyReply, token: string) {
    reply.setCookie("refreshToken", token, {
      ...cookieOptions,
      maxAge: Math.floor(REFRESH_TOKEN_EXPIRES_MS / 1000),
    });
  }

  function clearRefreshTokenCookie(reply: FastifyReply) {
    reply.clearCookie("refreshToken", cookieOptions);
  }

  return {
    async register(request: FastifyRequest<{ Body: RegisterInput }>, reply: FastifyReply) {
      try {
        const data = registerSchema.parse(request.body);
        const result = await service.register(data);

        return reply.code(201).send({ message: result.message });
      } catch (error) {
        return handleControllerError(error, reply);
      }
    },

    async login(request: FastifyRequest<{ Body: LoginInput }>, reply: FastifyReply) {
      try {
        const data = loginSchema.parse(request.body);
        const jwt = request.server.jwt.sign.bind(request.server.jwt);
        const result = await service.login(data, jwt);

        setRefreshTokenCookie(reply, result.refreshToken);
        return reply.code(200).send({ token: result.accessToken, user: result.user });
      } catch (error) {
        return handleControllerError(error, reply);
      }
    },

    async refresh(request: FastifyRequest, reply: FastifyReply) {
      const refreshToken = request.cookies.refreshToken;
      if (!refreshToken) {
        return reply.code(401).send({ error: "Refresh token not provided" });
      }

      try {
        const jwt = request.server.jwt.sign.bind(request.server.jwt);
        const result = await service.refresh(refreshToken, jwt);

        setRefreshTokenCookie(reply, result.refreshToken);
        return reply.code(200).send({ token: result.accessToken, user: result.user });
      } catch (error) {
        if (error instanceof AppError && error.statusCode === 401) {
          clearRefreshTokenCookie(reply);
        }
        return handleControllerError(error, reply);
      }
    },

    async logout(request: FastifyRequest, reply: FastifyReply) {
      const refreshToken = request.cookies.refreshToken;
      try {
        if (refreshToken) {
          await service.logout(refreshToken);
        }
      } catch (error) {
        clearRefreshTokenCookie(reply);
        return handleControllerError(error, reply);
      }

      clearRefreshTokenCookie(reply);
      return reply.code(204).send();
    },

    async verifyEmail(request: FastifyRequest<{ Body: VerifyEmailInput }>, reply: FastifyReply) {
      try {
        const data = verifyEmailSchema.parse(request.body);
        const jwt = request.server.jwt.sign.bind(request.server.jwt);
        const result = await service.verifyEmail(data, jwt);

        setRefreshTokenCookie(reply, result.refreshToken);
        return reply.code(200).send({ token: result.accessToken, user: result.user });
      } catch (error) {
        return handleControllerError(error, reply);
      }
    },

    async resendVerification(
      request: FastifyRequest<{ Body: ResendVerificationInput }>,
      reply: FastifyReply
    ) {
      try {
        const data = resendVerificationSchema.parse(request.body);
        await service.resendVerification(data);
        return reply.code(200).send({ message: "Verification email sent if account exists" });
      } catch (error) {
        return handleControllerError(error, reply);
      }
    },
  };
}
