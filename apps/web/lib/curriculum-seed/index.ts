/**
 * The default ONEVYRT programme served to learners: the canonical 20-module
 * Master Course Map (Start → Chapter 1 → Chapter 2 → Chapter 3 → Finish), with
 * every module wired to the tool that already backs it — so the scattered tools
 * become one locked-order journey.
 *
 * The content itself lives in the engine (packages/engine/src/curriculum-content.ts
 * → CANONICAL_PROGRAMME) so the seed, the versioned DB migration, and the tests
 * all share ONE definition of the course rather than a hand-maintained copy.
 * reconcileToChapters() here is a no-op on already-canonical content except that
 * it stamps the current schemaVersion — the single flag the migration and the
 * store's read-time canonicalization key on.
 *
 * A fresh install seeds this directly; an existing install is brought to this
 * shape (and its enrollment ids bridged from the old 22-lesson seed) by the
 * one-time v3 migration.
 */
import { reconcileToChapters, CANONICAL_PROGRAMME, type ProgrammeTemplate } from "@onevyrt/engine";

export const DEFAULT_PROGRAMME: ProgrammeTemplate = reconcileToChapters(CANONICAL_PROGRAMME);
