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
     * Validation is handled by the route schema (type is required and must be valid).
     */
    async save(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      try {
        const { id: userId } = request.user;
        const { type } = request.body as {
          type: "cookie_consent" | "privacy_policy" | "terms_of_use";
        };

        const consent = await service.saveConsent(userId, type);
        reply.code(201).send(consent);
      } catch (error) {
        request.log.error(error);
        reply.code(500).send({ error: "Internal server error" });
      }
    },

    /**
     * Lists all consent records for the authenticated user.
     * @param request - The Fastify request
     * @param reply - The Fastify reply
     */
    async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      try {
        const { id: userId } = request.user;
        const userConsents = await service.getConsents(userId);
        reply.code(200).send(userConsents);
      } catch (error) {
        request.log.error(error);
        reply.code(500).send({ error: "Internal server error" });
      }
    },
  };
}
