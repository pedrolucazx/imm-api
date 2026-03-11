-- Migration 0003: Create habits and habit_logs tables
-- Created by: opencode

-- Step 1: Create habits table
CREATE TABLE "habits" (
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

-- Step 2: Create index on user_id for active habits
CREATE INDEX "idx_habits_user_active" ON "habits"("user_id") WHERE "is_active" = TRUE;

-- Step 3: Create GIN index for habit_plan JSONB
CREATE INDEX "idx_habit_plan_gin" ON "habits" USING GIN("habit_plan");

-- Step 4: Create habit_logs table
CREATE TABLE "habit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "habit_id" uuid NOT NULL REFERENCES "habits"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "log_date" date NOT NULL,
  "completed" boolean NOT NULL DEFAULT FALSE,
  "completed_at" timestamptz
);

-- Step 5: Create unique index on habit_id + log_date
CREATE UNIQUE INDEX "uq_habit_log" ON "habit_logs"("habit_id", "log_date");

-- Step 6: Add index on user_id for habit_logs
CREATE INDEX "idx_habit_logs_user" ON "habit_logs"("user_id");
