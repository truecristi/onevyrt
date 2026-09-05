-- Phase 3 schema (first slice): programs, program versions and lessons.
-- Hand-written to match packages/database/src/schema.ts - see 0000_init.sql's
-- header comment for why these are hand-written rather than drizzle-kit
-- generated.
--
-- Unlike every Phase 2 table, this content is platform-wide, not
-- workspace-scoped - see the doc comment on schema.ts's programs table.

ALTER TABLE users ADD COLUMN is_platform_admin boolean NOT NULL DEFAULT false;

CREATE TABLE programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  order_index integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE program_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  outcomes text NOT NULL DEFAULT '',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT program_versions_program_id_version_key UNIQUE (program_id, version)
);
CREATE INDEX program_versions_program_id_idx ON program_versions(program_id);
-- At most one published version per program - see the doc comment on
-- schema.ts's programVersions table for why this is a backstop, not the
-- primary enforcement mechanism.
CREATE UNIQUE INDEX program_versions_one_published_per_program_idx
  ON program_versions(program_id) WHERE status = 'published';

CREATE TABLE lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_version_id uuid NOT NULL REFERENCES program_versions(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  outcome text NOT NULL DEFAULT '',
  order_index integer NOT NULL DEFAULT 0,
  estimated_minutes integer,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lessons_program_version_id_slug_key UNIQUE (program_version_id, slug)
);
CREATE INDEX lessons_program_version_id_idx ON lessons(program_version_id);
