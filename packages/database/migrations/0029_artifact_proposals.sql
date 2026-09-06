-- Phase 6 schema (sixth slice): artifact proposals.
-- Hand-written to match packages/database/src/schema.ts - see 0000_init.sql's
-- header comment for why these are hand-written rather than drizzle-kit
-- generated.

CREATE TABLE artifact_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  artifact_type text NOT NULL CHECK (artifact_type IN ('offer', 'customer_profile', 'funnel_step')),
  artifact_id uuid NOT NULL,
  proposed_patch jsonb NOT NULL,
  rationale text NOT NULL DEFAULT '',
  prompt_template_key text NOT NULL,
  prompt_template_version integer NOT NULL,
  provider_id text NOT NULL,
  model text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  reviewed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX artifact_proposals_workspace_id_idx ON artifact_proposals(workspace_id);
CREATE INDEX artifact_proposals_artifact_idx ON artifact_proposals(artifact_type, artifact_id);
