-- Phase 2 schema (second slice): customer profiles.
-- Hand-written to match packages/database/src/schema.ts - see 0000_init.sql's
-- header comment for why these are hand-written rather than drizzle-kit
-- generated.

CREATE TABLE customer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  pain_points text NOT NULL DEFAULT '',
  desired_outcome text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_profiles_workspace_id_idx ON customer_profiles(workspace_id);
