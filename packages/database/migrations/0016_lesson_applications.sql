-- Phase 3 schema (seventh slice): lesson application.
-- Hand-written to match packages/database/src/schema.ts - see 0000_init.sql's
-- header comment for why these are hand-written rather than drizzle-kit
-- generated.

CREATE TABLE lesson_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  lesson_block_id uuid NOT NULL REFERENCES lesson_blocks(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  resource_type text NOT NULL CHECK (resource_type IN (
    'goal', 'task', 'offer', 'customer_profile', 'business_metric',
    'assumption', 'decision'
  )),
  resource_id uuid NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lesson_applications_enrollment_id_lesson_block_id_key UNIQUE (enrollment_id, lesson_block_id)
);
CREATE INDEX lesson_applications_enrollment_id_idx ON lesson_applications(enrollment_id);
CREATE INDEX lesson_applications_workspace_id_idx ON lesson_applications(workspace_id);
