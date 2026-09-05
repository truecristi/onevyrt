-- Phase 6 schema (tenth slice): AI call cost and latency tracking.
-- Hand-written to match packages/database/src/schema.ts - see 0000_init.sql's
-- header comment for why these are hand-written rather than drizzle-kit
-- generated.

CREATE TABLE ai_call_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  prompt_template_key text NOT NULL,
  prompt_template_version integer NOT NULL,
  provider_id text NOT NULL,
  model text NOT NULL,
  input_tokens integer NOT NULL,
  output_tokens integer NOT NULL,
  latency_ms integer NOT NULL,
  estimated_cost_micros integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_call_records_actor_user_id_idx ON ai_call_records(actor_user_id);
CREATE INDEX ai_call_records_workspace_id_idx ON ai_call_records(workspace_id);
