# ADR-0018: Legacy extraction, transformation and migration verification

**Status:** Proposed (not yet decided - Phase 18)
**Date:** 2026-09-05

## Context

How legacy data would be extracted/transformed/reconciled - moot until a legacy data source is available again; the legacy application backing this repository was reset to empty before this specification was committed (see docs/parity/*.md's source notes), so there is currently nothing to extract from. Revisit if/when a legacy data export becomes available.

Relevant specification sections: §43, docs/parity/legacy-file-manifest.md.

## Decision

Not made yet. This entry exists per §36's ADR catalogue requirement ("create
and approve ADRs covering at least" this list "before broad feature
development") so the decision is tracked and named before the phase that
needs it starts - not to pre-decide something Phase 0/1 has no basis to
decide yet.

## Phase 8 revisit ("Import legacy data" / "Verify parity")

The root README's Phase 8 checklist names "Import legacy data" and
"Verify parity" as explicit bullets, so this ADR was re-checked rather
than left to sit unexamined since Phase 0/1. The blocker is unchanged: no
legacy data export, database dump, or read access to the original
hosting environment has become available anywhere this session can
reach. Re-confirmed directly rather than assumed:

- `origin/master` is still a single empty commit (`git log origin/master`
  shows exactly one commit, "Empty branch content").
- No legacy archive, dump, or export exists anywhere on this session's
  filesystem (checked explicitly - nothing found).
- This session has no network path to any external legacy system or
  backup store to pull one from, even if a location were known.

Nothing here is fabricated to look complete: no legacy rows were
invented, no fake "import" migration was written against data that
doesn't exist, and no parity row was reclassified from `pending` without
the actual legacy behavior to compare against. `docs/parity/README.md`
carries the matching note for "Verify parity" specifically.

**What would unblock this**: any one of - a database dump or structured
export of the legacy application's data, read/SSH access to wherever the
legacy system (or its backups) actually lives, or the original
repository history restored somewhere this session (or a future one) can
clone from. Whichever arrives first, the actual extraction/
transformation/reconciliation decision this ADR exists to make can be
made against real data - not before.

## Reversibility

N/A - no decision recorded.

**Approvers:** (none yet - proposed only)
