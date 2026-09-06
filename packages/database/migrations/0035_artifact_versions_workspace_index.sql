-- Phase 8 performance audit: index artifact_versions.workspace_id.
-- Hand-written to match packages/database/src/schema.ts - see 0000_init.sql's
-- header comment for why these are hand-written rather than drizzle-kit
-- generated.
--
-- Every current query against this table filters by (workspace_id,
-- artifact_type, artifact_id) together, so the existing
-- artifact_versions_artifact_idx (artifact_type, artifact_id) already
-- serves them efficiently - this isn't fixing a slow query that exists
-- today. Added for the same reason every other workspace-scoped table
-- has one: a future query listing version history across a whole
-- workspace, not one specific artifact, would otherwise have no index
-- to use at all.

CREATE INDEX artifact_versions_workspace_id_idx ON artifact_versions(workspace_id);
