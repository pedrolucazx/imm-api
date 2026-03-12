import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  date,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users.schema.js";

export const habits = pgTable(
  "habits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    targetSkill: varchar("target_skill", { length: 100 }),
    icon: varchar("icon", { length: 50 }).notNull(),
    color: varchar("color", { length: 20 }).notNull(),
    frequency: varchar("frequency", { length: 20 }).notNull().default("daily"),
    targetDays: integer("target_days").notNull().default(7),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    startDate: date("start_date"),
    habitPlan: jsonb("habit_plan").notNull().default({}),
    planStatus: varchar("plan_status", { length: 20 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_habits_user_id").on(table.userId),
    index("idx_habits_user_active")
      .on(table.userId)
      .where(sql`${table.isActive} = TRUE`),
    index("idx_habit_plan_gin").using("gin", table.habitPlan),
  ]
);

export type Habit = typeof habits.$inferSelect;
export type NewHabit = typeof habits.$inferInsert;
