import {
  pgTable,
  uuid,
  varchar,
  text,
  date,
  smallint,
  timestamp,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";
import { habits } from "./habits.schema.js";

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    habitId: uuid("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    entryDate: date("entry_date").notNull(),
    content: text("content").notNull(),
    wordCount: smallint("word_count"),
    uiLanguageSnap: varchar("ui_language_snap", { length: 10 }),
    targetSkillSnap: varchar("target_skill_snap", { length: 20 }),
    aiFeedback: jsonb("ai_feedback"),
    aiAgentType: varchar("ai_agent_type", { length: 30 }),
    moodScore: smallint("mood_score"),
    energyScore: smallint("energy_score"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_journal").on(table.userId, table.habitId, table.entryDate),
    index("idx_journal_ai_gin").using("gin", table.aiFeedback),
    index("idx_journal_user_created_at").on(table.userId, table.createdAt),
  ]
);

export type JournalEntry = typeof journalEntries.$inferSelect;
export type NewJournalEntry = typeof journalEntries.$inferInsert;
