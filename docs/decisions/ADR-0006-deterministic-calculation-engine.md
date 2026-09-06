# ADR-0006: Deterministic calculation engine and formula versioning

**Status:** Accepted (retroactively - see ADR-0005's "Why this was
Proposed for so long," same reasoning applies here)
**Date:** 2026-09-06

## Context

Port/redesign the legacy TypeScript engine's 334 exported declarations (see docs/parity/engine-surface.md) behind versioned, golden-tested formulas. Needs real financial/business modeling requirements decided first.

Relevant specification sections: §40 (financial and numerical assurance), Appendix C (legacy engine surface).

## Decision

**Not a port of the legacy engine's 334 declarations** - that source no
longer exists in this repository (both `main` and `master` were
force-emptied before this build began; see ADR-0018), so there was
nothing to port from. What Phase 4 actually built, and what this ADR
now records as decided:

- **Two-layer architecture, deliberately split**: `formula-registry.ts`
  holds the actual `compute()` implementations, keyed by
  `(key, version)`, registered once at module load and never mutated
  after (`registerFormula` throws if the same key+version is registered
  twice). `formula-use-cases.ts`'s `formulaDefinitions` table holds the
  _publishable metadata_ - title, description, `inputSchema` (a Zod-
  validated list of named numeric inputs), `outputUnit`, and a
  draft/published/archived `status` - with a hard invariant enforced at
  creation time: `createFormulaDefinition` refuses to create metadata
  for a `(key, version)` that has no matching registered implementation
  (`FormulaImplementationNotFoundError`), so this table can never
  describe a formula the system can't actually run.
- **`computeFormula` is the general, publish-gated entry point**: it
  looks up the _published_ definition for a key, validates the caller's
  input names exactly against `inputSchema` (missing or unexpected
  names both throw `FormulaInputMismatchError` - never a partial
  computation on a mismatched input set), then dispatches to the
  registered implementation. This is what a formula-by-key API surface
  uses.
- **A second, narrower access path exists for fixed, internal
  compositions**: `unit-economics-use-cases.ts` calls
  `getFormulaImplementation` directly rather than going through
  `computeFormula`, because its report always runs the same five
  formulas at a fixed version regardless of whether a platform admin
  has ever published a `formula_definitions` row for them - the publish
  gate is the right control for "run any formula by key" but wrong
  overhead for "this composite report always uses these five." Both
  paths read the same registry; nothing computes formulas outside it.
- **Not everything numeric goes through the registry, and that's
  intentional, not an oversight**: funnel-stage backward-conversion
  math (`funnel-stage-use-cases.ts`'s `requiredCount / conversionRate`
  cascade through ordered stages) is bespoke inline arithmetic specific
  to that domain's shape, not a registered formula - the registry is for
  the _named, independently reusable_ calculations (gross profit,
  contribution margin, break-even point, CAC, LTV, LTV:CAC ratio,
  conversion rate - 7 registered as of this review), not a mandate that
  every arithmetic expression in the codebase be wrapped in it.
- **Golden tests are the enforcement mechanism**: `formula-registry.test.ts`
  (9 tests) asserts each registered implementation's output against a
  known-correct value for representative inputs - this is what spec
  §40's "numerical golden tests for changed formulas" release gate
  actually checks (see ADR-0022's gate table: "Partially met" only
  because this ADR itself was still marked Proposed, not because the
  tests don't exist or don't pass).
- **Provenance, not just the answer**: every `FormulaResult` carries
  `formulaKey`, `formulaVersion`, the exact `inputs` used, `valueOrigin`
  (`"calculated"`, vs. a manually-entered override elsewhere in the
  scenario-modeling system), and `computedAt` - so a number displayed
  anywhere can always be traced back to which formula version and which
  inputs produced it, per §40's traceability requirement.

## Alternatives considered

- **A stored/evaluated expression string** (e.g. a formula defined as
  `"revenue - cost"` and evaluated at runtime) - rejected; see
  `schema.ts`'s own doc comment on `formulaDefinitions`: an evaluated
  expression string is a code-injection surface and loses type safety
  and testability that a plain TypeScript function has for free.
  `compute()` is deliberately just code.
- **Porting the legacy 334-declaration surface wholesale** - impossible
  without the source (ADR-0018), and not attempted; Phase 4 built the
  formulas the spec's business-modeling sections actually named, not a
  speculative superset.

## Consequences

Adding a new formula means: write `compute()` in `formula-registry.ts`,
add a golden test asserting its output, then (if it needs to be
runnable via the general by-key API) create and publish a
`formula_definitions` row via `createFormulaDefinition`/
`publishFormulaDefinition`. The two-layer split means a formula's
_implementation_ can never silently drift from what a
`formula_definitions` row claims it does, because the row can't exist
without the implementation existing first.

## Security effects

`createFormulaDefinition` and `publishFormulaDefinition` both require
`requirePlatformAdmin` - formula metadata is platform-wide content, not
workspace-scoped, same authorization shape as curriculum (ADR-0009).

## Migration effects

None beyond the existing `formula_definitions` table and its migration,
already shipped in Phase 4.

## Reversibility

High - the registry is additive (new keys/versions never replace old
ones in place; `registerFormula` throws on a duplicate `(key, version)`
rather than allowing a silent overwrite), so past computations remain
reproducible even as new formulas are added.

**Approvers:** Claude (autonomous build, reviewing Phase 4's actual
shipped code against this ADR's original scope - see PR description).
