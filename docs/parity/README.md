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
