import type { FastifyRequest, FastifyReply } from "fastify";
import type { ConsentsService } from "./consents.service.js";

/** Controller interface for consent HTTP handlers. */
export interface ConsentsController {
  /** Handles POST /consents - saves a consent record. */
  save(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  /** Handles GET /consents - lists all consents for a user. */
  list(request: FastifyRequest, reply: FastifyReply): Promise<void>;
}

/**
 * Creates a consents controller instance.
 * @param service - ConsentsService implementation
 * @returns ConsentsController implementation
 */
export function createConsentsController(service: ConsentsService): ConsentsController {
  return {
    /**
     * Saves a consent record for the authenticated user.
     * Validates that consent type is provided and is valid.
     */
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

    /**
     * Lists all consent records for the authenticated user.
     */
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
