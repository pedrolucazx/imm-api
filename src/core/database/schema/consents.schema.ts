/**
 * Consents table - stores user consent records for LGPD compliance.
 * Each user can have one consent record per type.
 */
import { pgTable, uuid, text, timestamp, unique } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";

/** Types of consent supported by the system. */
export const CONSENT_TYPES = ["cookie_consent", "privacy_policy", "terms_of_use"] as const;

/** Union type of valid consent types. */
export type ConsentType = (typeof CONSENT_TYPES)[number];

/**
 * Consents table schema for LGPD compliance.
 * Stores user consent records for cookies, privacy policy, and terms of use.
 * Each user can have one consent record per type.
 */
export const consents = pgTable(
  "consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    version: text("version").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    userTypeUnique: unique("consents_user_type_unique").on(table.userId, table.type),
  })
);

export type Consent = typeof consents.$inferSelect;
export type NewConsent = typeof consents.$inferInsert;
