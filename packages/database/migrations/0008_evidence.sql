-- Phase 2 schema (ninth slice): evidence.
-- Hand-written to match packages/database/src/schema.ts - see 0000_init.sql's
-- header comment for why these are hand-written rather than drizzle-kit
-- generated.

CREATE TABLE evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  source_url text NOT NULL DEFAULT '',
  strength text NOT NULL DEFAULT 'moderate' CHECK (strength IN ('weak', 'moderate', 'strong')),
  assumption_id uuid REFERENCES assumptions(id) ON DELETE SET NULL,
  decision_id uuid REFERENCES decisions(id) ON DELETE SET NULL,
  collected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX evidence_workspace_id_idx ON evidence(workspace_id);
CREATE INDEX evidence_assumption_id_idx ON evidence(assumption_id);
CREATE INDEX evidence_decision_id_idx ON evidence(decision_id);
