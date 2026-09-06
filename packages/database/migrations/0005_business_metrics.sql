-- Phase 2 schema (sixth slice): business metrics.
-- Hand-written to match packages/database/src/schema.ts - see 0000_init.sql's
-- header comment for why these are hand-written rather than drizzle-kit
-- generated.

CREATE TABLE business_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit text NOT NULL DEFAULT '',
  direction text NOT NULL DEFAULT 'increase' CHECK (direction IN ('increase', 'decrease')),
  cadence text NOT NULL DEFAULT 'monthly' CHECK (cadence IN ('weekly', 'monthly', 'quarterly')),
  baseline_value double precision,
  target_value double precision,
  current_value double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX business_metrics_workspace_id_idx ON business_metrics(workspace_id);
