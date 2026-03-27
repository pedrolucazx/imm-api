import { pgTable, uuid, date, text, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users.schema.js";
import { habits } from "./habits.schema.js";

export const pronunciationEntries = pgTable(
  "pronunciation_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    habitId: uuid("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    entryDate: date("entry_date").notNull(),
    originalText: text("original_text").notNull(),
    transcription: text("transcription"),
    score: numeric("score", { precision: 4, scale: 3 }),
    missedWords: text("missed_words")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    correctWords: text("correct_words")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    extraWords: text("extra_words")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    audioUrl: text("audio_url"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_pronunciation_user_habit").on(table.userId, table.habitId),
    index("idx_pronunciation_entry_date").on(table.habitId, table.entryDate),
  ]
);

export type PronunciationEntry = typeof pronunciationEntries.$inferSelect;
export type NewPronunciationEntry = typeof pronunciationEntries.$inferInsert;
