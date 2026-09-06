-- Phase 7 schema (fourth slice): force assessments (constraint diagnosis).
-- Hand-written to match packages/database/src/schema.ts - see 0000_init.sql's
-- header comment for why these are hand-written rather than drizzle-kit
-- generated.

CREATE TABLE force_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  force text NOT NULL CHECK (force IN (
    'owner_psychology', 'vision_planning', 'sales_marketing', 'people_culture',
    'operations_systems', 'finance_measurement', 'customer_experience'
  )),
  score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  target integer CHECK (target IS NULL OR target BETWEEN 0 AND 100),
  confidence text NOT NULL DEFAULT 'medium' CHECK (confidence IN ('low', 'medium', 'high')),
  evidence text NOT NULL DEFAULT '',
  constraint_note text NOT NULL DEFAULT '',
  recommendations text NOT NULL DEFAULT '',
  reassessed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT force_assessments_workspace_id_force_key UNIQUE (workspace_id, force)
);
CREATE INDEX force_assessments_workspace_id_idx ON force_assessments(workspace_id);
