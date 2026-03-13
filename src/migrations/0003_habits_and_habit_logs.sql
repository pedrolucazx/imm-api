-- Migration 0003: Create habits and habit_logs tables
-- Created by: opencode

-- Step 1: Create habits table
CREATE TABLE IF NOT EXISTS "habits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "target_skill" varchar(100),
  "icon" varchar(50) NOT NULL,
  "color" varchar(20) NOT NULL,
  "frequency" varchar(20) NOT NULL DEFAULT 'daily',
  "target_days" integer NOT NULL DEFAULT 7,
  "is_active" boolean NOT NULL DEFAULT TRUE,
  "sort_order" integer NOT NULL DEFAULT 0,
  "start_date" date,
  "habit_plan" jsonb NOT NULL DEFAULT '{}',
  "plan_status" varchar(20) NOT NULL DEFAULT 'active',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Step 2: Create index on user_id for all habits
CREATE INDEX IF NOT EXISTS "idx_habits_user_id" ON "habits"("user_id");

-- Step 3: Create partial index on user_id for active habits
CREATE INDEX IF NOT EXISTS "idx_habits_user_active" ON "habits"("user_id") WHERE "is_active" = TRUE;

-- Step 4: Create GIN index for habit_plan JSONB
CREATE INDEX IF NOT EXISTS "idx_habit_plan_gin" ON "habits" USING GIN("habit_plan");

-- Step 5: Create habit_logs table (user_id removed - derived from habits.habit_id)
CREATE TABLE IF NOT EXISTS "habit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "habit_id" uuid NOT NULL REFERENCES "habits"("id") ON DELETE CASCADE,
  "log_date" date NOT NULL,
  "completed" boolean NOT NULL DEFAULT FALSE,
  "completed_at" timestamptz
);

-- Step 6: Create unique index on habit_id + log_date
-- Note: uq_habit_log also covers queries by habit_id alone (leftmost prefix),
-- so a separate idx_habit_logs_habit index is redundant
CREATE UNIQUE INDEX IF NOT EXISTS "uq_habit_log" ON "habit_logs"("habit_id", "log_date");

-- Rollback section (run in reverse order if needed)
-- DROP INDEX IF EXISTS "uq_habit_log";
-- DROP TABLE IF EXISTS "habit_logs";
-- DROP INDEX IF EXISTS "idx_habit_plan_gin";
-- DROP INDEX IF EXISTS "idx_habits_user_active";
-- DROP INDEX IF EXISTS "idx_habits_user_id";
-- DROP TABLE IF EXISTS "habits";
