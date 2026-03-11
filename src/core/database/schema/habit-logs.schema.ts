import { pgTable, uuid, date, boolean, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { habits } from "./habits.schema.js";

export const habitLogs = pgTable(
  "habit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    habitId: uuid("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    logDate: date("log_date").notNull(),
    completed: boolean("completed").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    uniqueIndex("uq_habit_log").on(table.habitId, table.logDate),
    index("idx_habit_logs_habit").on(table.habitId),
  ]
);

export type HabitLog = typeof habitLogs.$inferSelect;
export type NewHabitLog = typeof habitLogs.$inferInsert;
