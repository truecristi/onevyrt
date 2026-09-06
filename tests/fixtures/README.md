# Shared test fixtures

Empty for Phase 1. Package-level tests currently build their own small
fixtures inline (see `packages/domain/src/auth-workspace-isolation.test.ts`).
Promote a fixture here once the same one is needed by two or more packages;
don't pre-build a fixture library speculatively.
