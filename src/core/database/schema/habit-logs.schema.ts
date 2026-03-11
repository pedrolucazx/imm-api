import { pgTable, uuid, date, boolean, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";
import { habits } from "./habits.schema.js";

export const habitLogs = pgTable("habit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  habitId: uuid("habit_id")
    .notNull()
    .references(() => habits.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  logDate: date("log_date").notNull(),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
});

export type HabitLog = typeof habitLogs.$inferSelect;
export type NewHabitLog = typeof habitLogs.$inferInsert;
