-- Phase 5 schema (eighth and final slice): launches.
-- Hand-written to match packages/database/src/schema.ts - see 0000_init.sql's
-- header comment for why these are hand-written rather than drizzle-kit
-- generated.

CREATE TABLE launches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  offer_id uuid REFERENCES offers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning', 'scheduled', 'live', 'completed', 'cancelled')),
  launch_date timestamptz,
  notes text NOT NULL DEFAULT '',
  checklist jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX launches_workspace_id_idx ON launches(workspace_id);
CREATE INDEX launches_offer_id_idx ON launches(offer_id);
