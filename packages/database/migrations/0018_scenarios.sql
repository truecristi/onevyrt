-- Phase 4 schema (second slice): scenario modeling.
-- Hand-written to match packages/database/src/schema.ts - see 0000_init.sql's
-- header comment for why these are hand-written rather than drizzle-kit
-- generated.

CREATE TABLE scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  scenario_type text NOT NULL DEFAULT 'custom' CHECK (scenario_type IN ('base', 'best', 'worst', 'custom')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX scenarios_workspace_id_idx ON scenarios(workspace_id);
CREATE UNIQUE INDEX scenarios_one_per_canonical_type_idx
  ON scenarios(workspace_id, scenario_type)
  WHERE scenario_type != 'custom';

CREATE TABLE scenario_assumption_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  assumption_id uuid NOT NULL REFERENCES assumptions(id) ON DELETE CASCADE,
  value double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scenario_assumption_overrides_scenario_id_assumption_id_key UNIQUE (scenario_id, assumption_id)
);
CREATE INDEX scenario_assumption_overrides_scenario_id_idx ON scenario_assumption_overrides(scenario_id);
