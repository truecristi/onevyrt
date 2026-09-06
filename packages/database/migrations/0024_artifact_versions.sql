-- Phase 5 schema (fourth slice): artifact versioning.
-- Hand-written to match packages/database/src/schema.ts - see 0000_init.sql's
-- header comment for why these are hand-written rather than drizzle-kit
-- generated.

CREATE TABLE artifact_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  artifact_type text NOT NULL CHECK (artifact_type IN ('offer', 'customer_profile', 'funnel_step')),
  artifact_id uuid NOT NULL,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  change_note text NOT NULL DEFAULT '',
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT artifact_versions_artifact_version_key UNIQUE (artifact_type, artifact_id, version)
);
CREATE INDEX artifact_versions_artifact_idx ON artifact_versions(artifact_type, artifact_id);
