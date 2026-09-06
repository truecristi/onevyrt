import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * PRD-HARDEN-002: workspace isolation (README "Migration and
 * hardening" -> "Test workspace isolation", Phase 8; spec §4's "every
 * query must include the active workspace boundary" and §46 item 20's
 * "prove a second workspace cannot access any object from the first").
 * ADR-0003 decided the mechanism (every packages/domain use case takes
 * the caller's ID and re-derives workspace scope via
 * requireWorkspaceMembership, never trusting a caller-supplied
 * workspaceId without checking it) and proved it with one integration
 * test at Phase 1's scale (a handful of tables). This is the same
 * decision re-verified as a permanent, automated architecture guard now
 * that the domain layer has grown to dozens of modules: rather than a
 * one-time manual audit, this test statically scans every
 * `*-use-cases.ts` file and fails if a new exported function
 * referencing `workspaceId` is ever added without calling
 * requireWorkspaceMembership (or requirePlatformAdmin, for
 * platform-wide content that is deliberately not workspace-scoped) -
 * catching the mistake at review time, not in production.
 *
 * This is a static text check, not full semantic analysis: it looks for
 * the *literal call* within each top-level exported function's own body
 * (this codebase never nests one `export async function` inside
 * another, and every existing use case calls the gate directly rather
 * than relying on a callee to have already checked - "every function
 * here re-derives the caller's membership and fails closed", per this
 * codebase's own established convention). A function that's flagged but
 * is actually safe must be added to KNOWN_EXEMPTIONS below with a
 * comment explaining why, so an exemption is always a reviewed,
 * intentional decision - never silent.
 */

const SRC_DIR = __dirname;

/** Whole files exempt because they define one of the gates themselves, or run before any workspace membership exists yet. */
const EXEMPT_FILES = new Set([
  "workspace-use-cases.ts", // defines requireWorkspaceMembership itself
  "auth-use-cases.ts", // registration creates the first membership row - there is no prior membership to check
  "platform-admin-use-cases.ts", // guards platform-wide content via a different gate, requirePlatformAdmin - not workspace-scoped by design
]);

/**
 * Specific functions exempt with a reviewed reason, rather than an
 * entire file - each entry names exactly why trusting workspaceId here
 * doesn't create a cross-tenant access or mutation risk.
 */
const KNOWN_EXEMPTIONS: Record<string, string> = {
  "ai-call-record-use-cases.ts:recordAiCall":
    "Write-only internal bookkeeping called by an AI route immediately after that route already independently verified workspace membership for the same workspaceId (via assembleWorkspaceContext, getArtifactForProposal, etc.) - see this function's own doc comment. It never reads or exposes another workspace's data; the worst case of a wrong workspaceId here is a misattributed cost/latency record, not unauthorized access.",
};

function listUseCaseFiles(): string[] {
  return readdirSync(SRC_DIR).filter((f) => f.endsWith("-use-cases.ts"));
}

interface FunctionChunk {
  name: string;
  body: string;
}

/** Splits a use-case file's source into one chunk per top-level `export async function`, from its declaration to the start of the next one (or EOF). */
function splitIntoFunctions(source: string): FunctionChunk[] {
  const marker = /^export async function (\w+)/gm;
  const matches = [...source.matchAll(marker)];
  const chunks: FunctionChunk[] = [];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const name = match?.[1];
    if (match === undefined || name === undefined) continue;
    const start = match.index ?? 0;
    const nextMatch = matches[i + 1];
    const end = nextMatch !== undefined ? (nextMatch.index ?? source.length) : source.length;
    chunks.push({ name, body: source.slice(start, end) });
  }
  return chunks;
}

const GATE_CALLS = ["requireWorkspaceMembership(", "requirePlatformAdmin("];

describe("workspace isolation architecture guard", () => {
  const files = listUseCaseFiles();

  it("finds domain use-case files to check", () => {
    // A guard against this test silently checking nothing if the
    // directory listing or file-naming convention ever changes.
    expect(files.length).toBeGreaterThan(30);
  });

  it.each(files.filter((f) => !EXEMPT_FILES.has(f)))(
    "every workspaceId-touching export in %s calls a workspace/platform authorization gate",
    (file) => {
      const source = readFileSync(join(SRC_DIR, file), "utf8");
      const functions = splitIntoFunctions(source);

      const violations = functions
        .filter((fn) => fn.body.includes("workspaceId"))
        .filter((fn) => !GATE_CALLS.some((gate) => fn.body.includes(gate)))
        .filter((fn) => !(`${file}:${fn.name}` in KNOWN_EXEMPTIONS))
        .map((fn) => fn.name);

      expect(
        violations,
        `${file} has function(s) touching workspaceId with no requireWorkspaceMembership/requirePlatformAdmin call: ${violations.join(", ")}. ` +
          `If this is genuinely safe, add "${file}:${violations[0]}" to KNOWN_EXEMPTIONS with a reviewed reason - never silently ignore it.`,
      ).toEqual([]);
    },
  );

  it("documents every exemption with a file that still exists", () => {
    for (const key of Object.keys(KNOWN_EXEMPTIONS)) {
      const [file] = key.split(":");
      expect(
        files,
        `exemption "${key}" references a file that is no longer a use-case file`,
      ).toContain(file);
    }
  });
});
