-- Phase 3 schema (sixth slice): prerequisites.
-- Hand-written to match packages/database/src/schema.ts - see 0000_init.sql's
-- header comment for why these are hand-written rather than drizzle-kit
-- generated.

CREATE TABLE lesson_prerequisites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  prerequisite_lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lesson_prerequisites_lesson_id_prerequisite_lesson_id_key UNIQUE (lesson_id, prerequisite_lesson_id),
  CONSTRAINT lesson_prerequisites_no_self_reference CHECK (lesson_id != prerequisite_lesson_id)
);
CREATE INDEX lesson_prerequisites_lesson_id_idx ON lesson_prerequisites(lesson_id);
