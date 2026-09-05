-- Phase 3 schema (second slice): structured lesson blocks.
-- Hand-written to match packages/database/src/schema.ts - see 0000_init.sql's
-- header comment for why these are hand-written rather than drizzle-kit
-- generated.

CREATE TABLE lesson_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  block_type text NOT NULL CHECK (block_type IN (
    'orientation', 'concept', 'why', 'story', 'metaphor', 'figure',
    'worked-example', 'counterexample', 'calculation', 'reflection',
    'knowledge-check', 'practice', 'build', 'implementation',
    'coach-prompt', 'evidence', 'review', 'celebration', 'resource'
  )),
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lesson_blocks_lesson_id_idx ON lesson_blocks(lesson_id);
