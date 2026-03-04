-- Migration 0002: Refactor users schema, add user_profiles and refresh_tokens
-- Created by: opencode

-- Step 1: Drop the old ui_lang column from users
ALTER TABLE "users" DROP COLUMN IF EXISTS "ui_lang";

-- Step 2: Add avatar_url column to users
ALTER TABLE "users" ADD COLUMN "avatar_url" varchar(500);

-- Step 3: Create user_profiles table
CREATE TABLE "user_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "ui_language" varchar(10) DEFAULT 'pt-BR',
  "bio" text,
  "timezone" varchar(50) DEFAULT 'America/Sao_Paulo',
  "ai_requests_today" integer DEFAULT 0,
  "last_ai_request" timestamptz
);

-- Step 4: Create index on user_profiles.user_id
CREATE UNIQUE INDEX "idx_profiles_user" ON "user_profiles"("user_id");

-- Step 5: Create refresh_tokens table
CREATE TABLE "refresh_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" varchar(255) NOT NULL UNIQUE,
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz,
  "user_agent" text
);

-- Step 6: Create index on refresh_tokens.token_hash (for active tokens)
CREATE INDEX "idx_refresh_active" ON "refresh_tokens"("token_hash");
