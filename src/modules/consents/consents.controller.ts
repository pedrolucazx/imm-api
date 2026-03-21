import type { FastifyRequest, FastifyReply } from "fastify";
import type { ConsentsService } from "./consents.service.js";

export interface ConsentsController {
  save(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  list(request: FastifyRequest, reply: FastifyReply): Promise<void>;
}

export function createConsentsController(service: ConsentsService): ConsentsController {
  return {
    async save(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      try {
        const { id: userId } = request.user;
        const { type } = request.body as { type: string };

        if (!type) {
          reply.code(400).send({ error: "Consent type is required" });
          return;
        }

        const validTypes = ["cookie_consent", "privacy_policy", "terms_of_use"];
        if (!validTypes.includes(type)) {
          reply.code(400).send({ error: "Invalid consent type" });
          return;
        }

        const consent = await service.saveConsent(
          userId,
          type as "cookie_consent" | "privacy_policy" | "terms_of_use"
        );
        reply.code(201).send(consent);
      } catch (error) {
        request.log.error(error);
        reply.code(500).send({ error: "Internal server error" });
      }
    },

    async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      try {
        const { id: userId } = request.user;
        const consents = await service.getConsents(userId);
        reply.code(200).send(consents);
      } catch (error) {
        request.log.error(error);
        reply.code(500).send({ error: "Internal server error" });
      }
    },
  };
}
