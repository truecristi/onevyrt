// PRD-AI-001 vertical slice: the provider-neutral AI gateway (README
// "AI coaching" -> "Provider-neutral AI gateway", first slice of Phase 6;
// ADR-0010). Everything else in the spec's AI section (§7, §28) -
// prompt/schema registry, context assembly, the coaching interface,
// lesson explanations, artifact/task proposals, sketch specifications,
// safety checks, cost/latency persistence, evaluation - is a separate,
// later slice; this only establishes the gateway they'll all sit on top
// of. See docs/decisions/ADR-0010-ai-gateway-provider-adapters.md.

export * from "./types";
export * from "./gateway";
export * from "./provider-selection";
export * from "./providers/anthropic";
export * from "./providers/deterministic";
