import { pgTable, uuid, varchar, text, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users.schema";

export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    uiLanguage: varchar("ui_language", { length: 10 }).default("pt-BR"),
    bio: text("bio"),
    timezone: varchar("timezone", { length: 50 }).default("America/Sao_Paulo"),
    aiRequestsToday: integer("ai_requests_today").default(0),
    lastAiRequest: timestamp("last_ai_request", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    userIdUnique: uniqueIndex("idx_profiles_user").on(table.userId),
  })
);

export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
