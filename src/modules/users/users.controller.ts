import type { FastifyRequest, FastifyReply } from "fastify";
import type { UsersService } from "./users.service.js";
import { updateProfileSchema, type UpdateProfileInput } from "./users.types.js";
import { handleControllerError } from "../../shared/http/handle-error.js";
import {
  createAvatarSignedUploadUrl,
  isAllowedContentType,
} from "../../core/storage/supabase-storage.js";

export function createUsersController(service: UsersService) {
  return {
    async get(request: FastifyRequest, reply: FastifyReply) {
      try {
        const { id } = request.user;
        const profile = await service.getProfile(id);
        return reply.code(200).send(profile);
      } catch (error) {
        return handleControllerError(error, reply);
      }
    },

    async update(request: FastifyRequest<{ Body: UpdateProfileInput }>, reply: FastifyReply) {
      try {
        const { id } = request.user;
        const data = updateProfileSchema.parse(request.body);
        const profile = await service.updateProfile(id, data);
        return reply.code(200).send(profile);
      } catch (error) {
        return handleControllerError(error, reply);
      }
    },

    async getAvatarUploadUrl(
      request: FastifyRequest<{ Body: { contentType: string } }>,
      reply: FastifyReply
    ) {
      try {
        const { id } = request.user;
        const { contentType } = request.body;

        if (!isAllowedContentType(contentType)) {
          return reply
            .code(422)
            .send({ error: "contentType must be image/jpeg, image/png or image/webp" });
        }

        const result = await createAvatarSignedUploadUrl(id, contentType);
        return reply.code(200).send(result);
      } catch (error) {
        return handleControllerError(error, reply);
      }
    },
  };
}

export type UsersController = ReturnType<typeof createUsersController>;
