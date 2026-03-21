import type { ConsentsRepository } from "./consents.repository.js";
import type { ConsentType } from "@/core/database/schema/consents.schema.js";

/** Response format for consent data. */
export interface ConsentResponse {
  id: string;
  type: ConsentType;
  version: string;
  acceptedAt: Date;
}

/** Service interface for consent business logic. */
export interface ConsentsService {
  /** Saves a consent for a user with current version. */
  saveConsent(userId: string, type: ConsentType): Promise<ConsentResponse>;
  /** Gets all consents for a user. */
  getConsents(userId: string): Promise<ConsentResponse[]>;
}

/**
 * Creates a consents service instance.
 * @param repository - ConsentsRepository implementation
 * @returns ConsentsService implementation
 */
export function createConsentsService(repository: ConsentsRepository): ConsentsService {
  const CONSENT_VERSION = "1.0";

  return {
    /**
     * Saves a consent record with the current version.
     * @param userId - User ID
     * @param type - Type of consent
     * @returns ConsentResponse with saved consent data
     */
    async saveConsent(userId: string, type: ConsentType): Promise<ConsentResponse> {
      const consent = await repository.save(userId, type, CONSENT_VERSION);
      return {
        id: consent.id,
        type: consent.type as ConsentType,
        version: consent.version,
        acceptedAt: consent.acceptedAt,
      };
    },

    /**
     * Retrieves all consents for a user.
     * @param userId - User ID
     * @returns Array of ConsentResponse
     */
    async getConsents(userId: string): Promise<ConsentResponse[]> {
      const consents = await repository.findByUserId(userId);
      return consents.map((c) => ({
        id: c.id,
        type: c.type as ConsentType,
        version: c.version,
        acceptedAt: c.acceptedAt,
      }));
    },
  };
}
