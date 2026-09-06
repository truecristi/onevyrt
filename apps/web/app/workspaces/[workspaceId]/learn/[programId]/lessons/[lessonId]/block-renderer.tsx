import type { ReactNode } from "react";
import type { LessonBlockType } from "@onevyrt/contracts";

export interface RenderableBlock {
  id: string;
  blockType: LessonBlockType;
  payload: Record<string, unknown>;
}

/**
 * Phase 9 Learn slice: the 17 read-only block types (spec section 3.1,
 * packages/contracts/src/lesson-blocks.ts) share one renderer keyed on
 * blockType - knowledge-check and reflection are interactive and handled
 * by their own client islands (knowledge-check-block.tsx,
 * reflection-block.tsx) before this component ever sees them.
 *
 * Each case casts `payload` to the shape createLessonBlockRequestSchema's
 * matching branch already validated at write time (contracts validates
 * at the boundary, domain/UI trusts it after - the same split
 * lesson-block-use-cases.ts's own doc comment describes).
 */
export function BlockRenderer({ block }: { block: RenderableBlock }) {
  const payload = block.payload;

  switch (block.blockType) {
    case "orientation": {
      const p = payload as { outcome: string; prerequisiteCheck: string };
      return (
        <BlockShell label="Orientation">
          <p className="font-medium text-gray-900">{p.outcome}</p>
          {p.prerequisiteCheck && <p className="text-sm text-gray-600">{p.prerequisiteCheck}</p>}
        </BlockShell>
      );
    }
    case "concept": {
      const p = payload as { explanation: string };
      return (
        <BlockShell label="Concept">
          <p className="whitespace-pre-wrap text-gray-900">{p.explanation}</p>
        </BlockShell>
      );
    }
    case "why": {
      const p = payload as { explanation: string };
      return (
        <BlockShell label="Why this matters">
          <p className="whitespace-pre-wrap text-gray-900">{p.explanation}</p>
        </BlockShell>
      );
    }
    case "story": {
      const p = payload as { narrative: string };
      return (
        <BlockShell label="Story">
          <p className="whitespace-pre-wrap text-gray-900">{p.narrative}</p>
        </BlockShell>
      );
    }
    case "metaphor": {
      const p = payload as {
        sourceDomain: string;
        targetConcept: string;
        mappingPairs: { source: string; target: string }[];
        limitations: string;
      };
      return (
        <BlockShell label="Metaphor">
          <p className="text-gray-900">
            {p.sourceDomain} <span className="text-gray-500">is like</span> {p.targetConcept}
          </p>
          <ul className="list-inside list-disc text-sm text-gray-600">
            {p.mappingPairs.map((pair, index) => (
              <li key={index}>
                {pair.source} &rarr; {pair.target}
              </li>
            ))}
          </ul>
          <p className="text-sm text-gray-500">Where this breaks down: {p.limitations}</p>
        </BlockShell>
      );
    }
    case "figure": {
      const p = payload as {
        primitiveType: string;
        dataSummary: string;
        accessibilityDescription: string;
      };
      return (
        <BlockShell label="Figure">
          <p className="text-sm text-gray-500">{p.primitiveType}</p>
          <p className="text-gray-900">{p.accessibilityDescription}</p>
          {p.dataSummary && <p className="text-sm text-gray-600">{p.dataSummary}</p>}
        </BlockShell>
      );
    }
    case "worked-example": {
      const p = payload as { scenario: string; inputs: Record<string, number>; result: string };
      return (
        <BlockShell label="Worked example">
          <p className="text-gray-900">{p.scenario}</p>
          <dl className="grid grid-cols-2 gap-x-4 text-sm text-gray-600">
            {Object.entries(p.inputs).map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="text-gray-500">{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="font-medium text-gray-900">{p.result}</p>
        </BlockShell>
      );
    }
    case "counterexample": {
      const p = payload as { scenario: string; whyItFails: string };
      return (
        <BlockShell label="Counterexample">
          <p className="text-gray-900">{p.scenario}</p>
          <p className="text-sm text-gray-600">{p.whyItFails}</p>
        </BlockShell>
      );
    }
    case "calculation": {
      const p = payload as { formula: string; inputs: Record<string, number>; result: string };
      return (
        <BlockShell label="Calculation">
          <p className="font-mono text-sm text-gray-900">{p.formula}</p>
          <dl className="grid grid-cols-2 gap-x-4 text-sm text-gray-600">
            {Object.entries(p.inputs).map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="text-gray-500">{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="font-medium text-gray-900">{p.result}</p>
        </BlockShell>
      );
    }
    case "practice": {
      const p = payload as { instructions: string };
      return (
        <BlockShell label="Practice">
          <p className="whitespace-pre-wrap text-gray-900">{p.instructions}</p>
        </BlockShell>
      );
    }
    case "build": {
      const p = payload as { instructions: string; targetAsset: string };
      return (
        <BlockShell label="Build">
          <p className="whitespace-pre-wrap text-gray-900">{p.instructions}</p>
          <p className="text-sm text-gray-500">Creates or updates: {p.targetAsset}</p>
        </BlockShell>
      );
    }
    case "implementation": {
      const p = payload as { action: string; ownerRole: string; deadlineDays?: number };
      return (
        <BlockShell label="Implementation">
          <p className="text-gray-900">{p.action}</p>
          <p className="text-sm text-gray-500">
            {p.ownerRole && <>Owner: {p.ownerRole}. </>}
            {p.deadlineDays !== undefined && <>Due in {p.deadlineDays} days.</>}
          </p>
        </BlockShell>
      );
    }
    case "coach-prompt": {
      const p = payload as { question: string; rubric: string };
      return (
        <BlockShell label="Coach prompt">
          <p className="text-gray-900">{p.question}</p>
          {p.rubric && <p className="text-sm text-gray-600">{p.rubric}</p>}
        </BlockShell>
      );
    }
    case "evidence": {
      const p = payload as { instructions: string };
      return (
        <BlockShell label="Evidence">
          <p className="whitespace-pre-wrap text-gray-900">{p.instructions}</p>
        </BlockShell>
      );
    }
    case "review": {
      const p = payload as { reviewPrompt: string };
      return (
        <BlockShell label="Review">
          <p className="text-gray-900">{p.reviewPrompt}</p>
        </BlockShell>
      );
    }
    case "celebration": {
      const p = payload as { message: string };
      return (
        <BlockShell label="Celebration">
          <p className="font-medium text-gray-900">{p.message}</p>
        </BlockShell>
      );
    }
    case "resource": {
      const p = payload as { title: string; url: string; description: string };
      return (
        <BlockShell label="Resource">
          <a
            href={p.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-blue-600 hover:underline"
          >
            {p.title}
          </a>
          {p.description && <p className="text-sm text-gray-600">{p.description}</p>}
        </BlockShell>
      );
    }
    default:
      // knowledge-check and reflection are rendered by their own
      // client islands before reaching this component - if one lands
      // here, say so honestly rather than rendering nothing.
      return (
        <BlockShell label={block.blockType}>
          <p className="text-sm text-gray-500">This block type isn&rsquo;t rendered yet.</p>
        </BlockShell>
      );
  }
}

function BlockShell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-gray-500 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      {children}
    </div>
  );
}
