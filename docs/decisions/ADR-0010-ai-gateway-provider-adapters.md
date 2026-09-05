# ADR-0010: AI gateway, provider adapters and model routing

**Status:** Accepted (Phase 6 first slice)
**Date:** 2026-09-05

## Context

Every AI-touching feature in the spec (coaching, lesson explanations,
artifact/task proposals, sketch specifications) needs to call a language
model without coupling the rest of the codebase to one provider's SDK or
request/response shape - the same reasoning §7/§39 give for keeping
financial formulas provider-neutral of any one spreadsheet tool.

Relevant specification sections: §7, §39, packages/ai.

## Decision

`packages/ai` exports a provider-neutral `AiProvider` interface:

```ts
interface AiProvider {
  readonly id: string;
  complete(request: CompletionRequest): Promise<CompletionResult>;
}
```

`CompletionRequest`/`CompletionResult` are plain, provider-agnostic shapes
(system prompt, messages, max tokens, temperature in; text, stop reason,
token usage, latency out) - no provider SDK type ever crosses this
boundary.

Two adapters ship in this slice:

- **`createAnthropicProvider`**: a real adapter calling the Claude Messages
  API directly over `fetch` (no SDK dependency added just for this),
  reading its API key from `ANTHROPIC_API_KEY` (added to
  `packages/contracts/src/env.ts` as **optional** - a deployment without a
  key configured yet must still build and run; only code paths that
  actually call the gateway with this provider fail, and they fail with a
  clear, typed error rather than a silent no-op). Per the root README's
  "default to the latest and most capable Claude models" guidance, the
  default model is the latest Claude generation, not pinned to whatever
  was current when this ADR was written - callers can override it.
- **`createDeterministicProvider`**: a fixed/echo adapter with no network
  call at all, used by every test and by any environment with no API key
  configured. This is the same "prove the pipeline without a live
  dependency" reasoning as ADR-0006's calculation engine tests.

`runCompletion(provider, request)` (the actual gateway entry point) wraps
`provider.complete` with latency measurement and structured logging
(`@onevyrt/observability`) - cost/latency _persistence_ is a separate,
later Phase 6 slice ("Cost and latency tracking"); this slice only
produces the numbers, it does not yet store them.

Model routing (choosing _which_ provider/model for a given call) is a
single explicit parameter on `CompletionRequest`, not a hidden global -
call sites decide, the gateway does not guess.

## Consequences

- New AI providers (a second real vendor, a local model) are a new file
  implementing `AiProvider`, not a change to every call site.
- Every AI-touching domain/route test can run in CI with zero external
  dependency or secret, using the deterministic provider.
- Nothing in this slice sends real user data to a real model yet - context
  assembly, redaction and retention (ADR-0011) and the proposed-action
  approval flow (ADR-0012) are still separate, not-yet-decided slices this
  gateway will sit underneath.

**Update (Phase 6 eleventh/final slice, "Evaluation system"):** the same
deterministic-provider mechanism this ADR uses for tests now also backs
`packages/ai`'s golden evaluation harness (`eval-registry.ts`,
`run-eval.ts`, `evals/*`), per spec §5.4 - each golden case supplies a
fixed canned response for a real prompt template and checks specific
properties (factual grounding, appropriate uncertainty, refusal to touch
identity/ownership fields, referential consistency) the same way a
production call would be validated, without a live model. `evals/run-
all.test.ts` is the actual CI gate spec §44 calls for ("AI schema and
evaluation thresholds for changed capabilities") - a prompt change that
breaks a golden case fails that test, the same way a broken numerical
fixture fails a formula test (once ADR-0006 is decided). This closes
Phase 6's README checklist.

## Reversibility

High - `AiProvider` is a small interface; adding, removing or replacing an
adapter behind it does not touch call sites.

**Approvers:** Claude (autonomous build, per this repository's standing
delegation - see PR description for the slice that accepted this ADR)
