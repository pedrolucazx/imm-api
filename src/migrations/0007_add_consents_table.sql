-- Migration: Create consents table for LGPD compliance
-- Created: 2026-03-21

CREATE TABLE IF NOT EXISTS "consents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "version" text NOT NULL,
  "accepted_at" timestamptz NOT NULL
);

-- Unique constraint: one consent record per user per type
-- Also serves for efficient user consent lookups (user_id as leading column)
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_type_unique" UNIQUE ("user_id", "type");
