-- Phase 5 schema (second slice): customer and positioning tools.
-- Hand-written to match packages/database/src/schema.ts - see 0000_init.sql's
-- header comment for why these are hand-written rather than drizzle-kit
-- generated.

ALTER TABLE customer_profiles
  ADD COLUMN emotional_consequence text NOT NULL DEFAULT '',
  ADD COLUMN unique_mechanism text NOT NULL DEFAULT '',
  ADD COLUMN proof text NOT NULL DEFAULT '',
  ADD COLUMN call_to_action text NOT NULL DEFAULT '',
  ADD COLUMN positioning_statement text NOT NULL DEFAULT '';
