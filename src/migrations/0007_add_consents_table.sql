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
CREATE UNIQUE INDEX IF NOT EXISTS "consents_user_type_unique" ON "consents"("user_id", "type");

-- Index for efficient user consent lookups
CREATE INDEX IF NOT EXISTS "idx_consents_user_id" ON "consents"("user_id");
