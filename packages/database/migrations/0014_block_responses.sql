-- Phase 3 schema (fifth slice): knowledge check and reflection responses.
-- Hand-written to match packages/database/src/schema.ts - see 0000_init.sql's
-- header comment for why these are hand-written rather than drizzle-kit
-- generated.

CREATE TABLE block_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  lesson_block_id uuid NOT NULL REFERENCES lesson_blocks(id) ON DELETE CASCADE,
  block_type text NOT NULL CHECK (block_type IN (
    'orientation', 'concept', 'why', 'story', 'metaphor', 'figure',
    'worked-example', 'counterexample', 'calculation', 'reflection',
    'knowledge-check', 'practice', 'build', 'implementation',
    'coach-prompt', 'evidence', 'review', 'celebration', 'resource'
  )),
  response jsonb NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT block_responses_enrollment_id_lesson_block_id_key UNIQUE (enrollment_id, lesson_block_id)
);
CREATE INDEX block_responses_enrollment_id_idx ON block_responses(enrollment_id);
