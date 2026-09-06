-- Phase 5 schema (third slice): funnel builder.
-- Hand-written to match packages/database/src/schema.ts - see 0000_init.sql's
-- header comment for why these are hand-written rather than drizzle-kit
-- generated.

CREATE TABLE funnel_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  step_type text NOT NULL CHECK (step_type IN (
    'landing-page', 'opt-in', 'webinar', 'appointment', 'sales-call',
    'sales-page', 'checkout', 'confirmation', 'custom'
  )),
  order_index integer NOT NULL,
  offer_id uuid REFERENCES offers(id) ON DELETE SET NULL,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT funnel_steps_workspace_id_order_index_key UNIQUE (workspace_id, order_index)
);
CREATE INDEX funnel_steps_workspace_id_idx ON funnel_steps(workspace_id);
