-- Phase 4 schema (first slice): versioned formula library.
-- Hand-written to match packages/database/src/schema.ts - see 0000_init.sql's
-- header comment for why these are hand-written rather than drizzle-kit
-- generated.

CREATE TABLE formula_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  version integer NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  input_schema jsonb NOT NULL,
  output_unit text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT formula_definitions_key_version_key UNIQUE (key, version)
);
CREATE INDEX formula_definitions_key_idx ON formula_definitions(key);
CREATE UNIQUE INDEX formula_definitions_one_published_per_key_idx
  ON formula_definitions(key)
  WHERE status = 'published';
