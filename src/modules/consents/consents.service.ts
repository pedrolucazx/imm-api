import type { ConsentsRepository } from "./consents.repository.js";
import type { ConsentType } from "@/core/database/schema/consents.schema.js";

export interface ConsentResponse {
  id: string;
  type: ConsentType;
  version: string;
  acceptedAt: Date;
}

export interface ConsentsService {
  saveConsent(userId: string, type: ConsentType): Promise<ConsentResponse>;
  getConsents(userId: string): Promise<ConsentResponse[]>;
}

export function createConsentsService(repository: ConsentsRepository): ConsentsService {
  const CONSENT_VERSION = "1.0";

  return {
    async saveConsent(userId: string, type: ConsentType): Promise<ConsentResponse> {
      const consent = await repository.save(userId, type, CONSENT_VERSION);
      return {
        id: consent.id,
        type: consent.type as ConsentType,
        version: consent.version,
        acceptedAt: consent.acceptedAt,
      };
    },

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
