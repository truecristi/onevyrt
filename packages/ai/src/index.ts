// PRD-AI-001/002 vertical slices: the provider-neutral AI gateway and the
// prompt/schema registry (README "AI coaching" -> first two slices of
// Phase 6; ADR-0010). Everything else in the spec's AI section (§7, §28) -
// context assembly, the coaching interface, lesson explanations,
// artifact/task proposals, sketch specifications, safety checks,
// cost/latency persistence, evaluation - is a separate, later slice; these
// two only establish the gateway and template registry they'll all sit on
// top of. See docs/decisions/ADR-0010-ai-gateway-provider-adapters.md.

export * from "./types";
export * from "./gateway";
export * from "./rate-limit";
export * from "./pricing";
export * from "./provider-selection";
export * from "./providers/anthropic";
export * from "./providers/deterministic";
export * from "./prompt-registry";
export * from "./run-prompt";

// Re-exporting also registers each of these as a side effect of importing
// this package - see prompt-registry.ts's doc comment for why
// registration happens at module load rather than lazily.
export * from "./prompts/explain-calculation";
export * from "./prompts/coaching-ask";
export * from "./prompts/explain-lesson-block";
export * from "./prompts/propose-artifact-patch";
export * from "./prompts/propose-task";
export * from "./prompts/interpret-sketch";
