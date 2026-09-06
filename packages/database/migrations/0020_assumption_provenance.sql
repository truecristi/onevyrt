-- Phase 4 schema (sixth slice): assumption provenance.
-- Hand-written to match packages/database/src/schema.ts - see 0000_init.sql's
-- header comment for why these are hand-written rather than drizzle-kit
-- generated.

ALTER TABLE assumptions
  ADD COLUMN source_type text NOT NULL DEFAULT 'estimate-user'
    CHECK (source_type IN (
      'actual-imported', 'actual-entered', 'estimate-user', 'estimate-ai',
      'benchmark', 'derived', 'scenario-override'
    )),
  ADD COLUMN source_date timestamptz,
  ADD COLUMN owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN formula_trace_key text,
  ADD COLUMN formula_trace_version integer;
