-- Migration 0002: Refactor users schema, add user_profiles and refresh_tokens
-- Created by: opencode

-- Step 1: Convert existing timestamps to TIMESTAMPTZ
ALTER TABLE "users" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "users" ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC';

-- Step 2: Add avatar_url column to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" varchar(500);

-- Step 3: Create user_profiles table with NOT NULL constraints
CREATE TABLE "user_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "ui_language" varchar(10) NOT NULL DEFAULT 'pt-BR',
  "bio" text,
  "timezone" varchar(50) NOT NULL DEFAULT 'America/Sao_Paulo',
  "ai_requests_today" integer NOT NULL DEFAULT 0,
  "last_ai_request" timestamptz
);

-- Step 4: Create index on user_profiles.user_id
CREATE UNIQUE INDEX "idx_profiles_user" ON "user_profiles"("user_id");

-- Step 5: Backfill user_profiles for existing users (using ui_lang if exists, else default)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'ui_lang'
  ) THEN
    INSERT INTO "user_profiles" ("user_id", "ui_language", "timezone")
    SELECT "id", COALESCE("ui_lang", 'pt-BR'), 'America/Sao_Paulo'
    FROM "users"
    ON CONFLICT ("user_id") DO NOTHING;
  ELSE
    INSERT INTO "user_profiles" ("user_id", "ui_language", "timezone")
    SELECT "id", 'pt-BR', 'America/Sao_Paulo'
    FROM "users"
    ON CONFLICT ("user_id") DO NOTHING;
  END IF;
END $$;

-- Step 6: Drop the old ui_lang column from users
ALTER TABLE "users" DROP COLUMN IF EXISTS "ui_lang";

-- Step 7: Create refresh_tokens table
CREATE TABLE "refresh_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" varchar(255) NOT NULL UNIQUE,
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz,
  "user_agent" text
);
