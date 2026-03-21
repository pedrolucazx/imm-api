/**
 * Database schema for user consents (LGPD compliance).
 * Stores user consent records for cookies, privacy policy, and terms of use.
 */
import { pgTable, uuid, text, timestamp, unique } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";

/** Types of consent supported by the system. */
export type ConsentType = "cookie_consent" | "privacy_policy" | "terms_of_use";

/**
 * Users table - stores user consent records for LGPD compliance.
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
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
  },
  (table) => ({
    userTypeUnique: unique("consents_user_type_unique").on(table.userId, table.type),
  })
);

export type Consent = typeof consents.$inferSelect;
export type NewConsent = typeof consents.$inferInsert;
