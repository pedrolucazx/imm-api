import type { FastifyRequest, FastifyReply } from "fastify";
import type { OnboardingService } from "./onboarding.service.js";
import { updateOnboardingSchema, type UpdateOnboardingInput } from "./onboarding.types.js";
import { handleControllerError } from "../../shared/http/handle-error.js";

export function createOnboardingController(service: OnboardingService) {
  return {
    async getStatus(request: FastifyRequest, reply: FastifyReply) {
      try {
        const { id } = request.user;
        const status = await service.getStatus(id);
        return reply.code(200).send(status);
      } catch (error) {
        return handleControllerError(error, reply);
      }
    },

    async update(request: FastifyRequest<{ Body: UpdateOnboardingInput }>, reply: FastifyReply) {
      try {
        const { id } = request.user;
        const data = updateOnboardingSchema.parse(request.body);
        const status = await service.update(id, data);
        return reply.code(200).send(status);
      } catch (error) {
        return handleControllerError(error, reply);
      }
    },
  };
}

export type OnboardingController = ReturnType<typeof createOnboardingController>;
