import type { FastifyRequest, FastifyReply } from "fastify";
import type { ProfileService } from "./profile.service.js";
import { updateProfileSchema, type UpdateProfileInput } from "./profile.types.js";
import { handleControllerError } from "../../shared/utils/http.js";

export function createProfileController(service: ProfileService) {
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
  };
}

export type ProfileController = ReturnType<typeof createProfileController>;
