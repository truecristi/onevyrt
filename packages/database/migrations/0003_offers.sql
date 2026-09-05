-- Phase 2 schema (third slice): offers.
-- Hand-written to match packages/database/src/schema.ts - see 0000_init.sql's
-- header comment for why these are hand-written rather than drizzle-kit
-- generated.

CREATE TABLE offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price_cents integer CHECK (price_cents IS NULL OR price_cents >= 0),
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX offers_workspace_id_idx ON offers(workspace_id);
