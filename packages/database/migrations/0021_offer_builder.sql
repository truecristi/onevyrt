-- Phase 5 schema (first slice): offer builder.
-- Hand-written to match packages/database/src/schema.ts - see 0000_init.sql's
-- header comment for why these are hand-written rather than drizzle-kit
-- generated.

ALTER TABLE offers
  ADD COLUMN problem_statement text NOT NULL DEFAULT '',
  ADD COLUMN desired_outcome text NOT NULL DEFAULT '',
  ADD COLUMN positioning_statement text NOT NULL DEFAULT '',
  ADD COLUMN value_proposition text NOT NULL DEFAULT '',
  ADD COLUMN guarantee text NOT NULL DEFAULT '',
  ADD COLUMN risk_reversal text NOT NULL DEFAULT '',
  ADD COLUMN offer_components jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN bonuses jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN objections jsonb NOT NULL DEFAULT '[]';
