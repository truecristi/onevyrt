-- Phase 5 schema (seventh slice): evidence collection - link evidence to
-- experiments. Hand-written to match packages/database/src/schema.ts - see
-- 0000_init.sql's header comment for why these are hand-written rather
-- than drizzle-kit generated.

ALTER TABLE evidence
  ADD COLUMN experiment_id uuid REFERENCES experiments(id) ON DELETE SET NULL;

CREATE INDEX evidence_experiment_id_idx ON evidence(experiment_id);
