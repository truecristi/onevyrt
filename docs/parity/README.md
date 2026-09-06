# Parity ledger

Per the root README's parity policy: every legacy capability gets a
classification (`PRESERVE`/`REBUILD`/`IMPROVE`/`MERGE`/`DEFER`/`REMOVE`)
and a stable parity identifier.

**Important caveat, read before trusting any row below as a real audit:**
the legacy ONEVYRT codebase these tables describe no longer exists in this
repository - both branches were force-reset to empty before this
specification was committed (see
[ADR-0018](../decisions/ADR-0018-legacy-extraction-migration-verification.md)).
Every table here is transcribed from the specification document's own
appendices (themselves produced from an earlier audit pass this session
did not perform and cannot re-verify against code), not derived by
inspecting real source. Treat `classification: pending` literally - no row
has actually been classified yet, because that requires a product decision
this phase doesn't have the standing to make unilaterally.

| File                                               | Contents                                                                      | Rows  |
| -------------------------------------------------- | ----------------------------------------------------------------------------- | ----- |
| [screens.md](screens.md)                           | Page routes (PAR-SCREEN-*)                                                    | 67    |
| [api-handlers.md](api-handlers.md)                 | API route handlers (PAR-API-*)                                                | 207   |
| [engine-surface.md](engine-surface.md)             | Deterministic engine exports (PAR-ENGINE-*)                                   | 334   |
| [components.md](components.md)                     | React components (PAR-COMPONENT-*)                                            | 182   |
| [migrations.md](migrations.md)                     | Database migrations (PAR-MIGRATION-*)                                         | 87    |
| [legacy-file-manifest.md](legacy-file-manifest.md) | Every file in the legacy repository (reference only, not classified per-file) | 1,639 |

## Phase 8 status ("Verify parity")

The root README's Phase 8 checklist names "Verify parity" as its own
bullet. Revisited rather than left unexamined: the blocker above is
unchanged (see [ADR-0018](../decisions/ADR-0018-legacy-extraction-migration-verification.md)'s
matching Phase 8 note) - there is still no legacy source or behavior to
verify these `pending` rows against, so none were reclassified. Marking
a row `PRESERVE`/`REBUILD`/etc. without the actual legacy behavior in
front of you would be a guess dressed up as a decision, not verification.

What Phase 8 *can* honestly say: since this ledger was written (Phase
0/1), this repository has actually built substantial functionality
covering identity, curriculum, business modeling, build/execution,
AI coaching and review/intelligence capabilities (Phases 2-7, each with
its own PR). Whether each of those maps to a `PRESERVE` or `REBUILD` of
a specific legacy row here is a real, worthwhile cross-referencing pass
- but a separate, sizeable one (800+ rows across four tables), not
something to rush through inside this hardening slice. Left as follow-up
work rather than attempted partially here.
