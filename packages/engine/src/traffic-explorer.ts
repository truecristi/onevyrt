/**
 * Traffic Explorer: the ACTUAL-mode counterpart to step-explorer.ts.
 *
 * step-explorer.ts answers "what's upstream/downstream of this node" by walking
 * the PLANNED graph (funnel.edges) — no real people involved. This module answers
 * the same *shape* of question from real tracked behavior instead: given a log of
 * page/event visits, what did people actually do next, previous, and where did
 * they come from.
 *
 * There is no tracking pixel, event ingestion endpoint, or session store in the
 * product yet — this file defines the data model those future pieces would
 * produce and pure functions to query it. It is intentionally NOT imported by
 * funnel-studio.tsx or any other UI. It exists so the shape is settled before
 * ACTUAL-mode tracking is built, per the design-now-build-later decision.
 */
import type { NodeId } from "./types.ts";

/** One tracked touchpoint. `nodeId` is set only once a matching step has been
 *  mapped onto the canvas — most events start unmapped (raw URL/source only). */
export interface TrackedEvent {
  id: string;
  sessionId: string;
  personId?: string;
  timestamp: number;       // epoch ms
  type: "pageview" | "click" | "conversion" | "custom";
  url?: string;             // pageview/click target
  sourceLabel?: string;     // e.g. "Facebook", "Google" — set on the session's entry event
  nodeId?: NodeId;          // set once mapped onto the funnel canvas
  utm?: { source?: string; medium?: string; campaign?: string };
  label?: string;           // custom event name, e.g. "booked_call"
}

/** A single visitor's ordered run of events. Events must be time-ordered. */
export interface TrackedSession {
  id: string;
  personId?: string;
  events: TrackedEvent[];
  deviceType?: "desktop" | "mobile" | "tablet";
  country?: string;
}

/** One row in a discovery panel: a destination/source plus how many sessions
 *  and what share of the reference population it accounts for. */
export interface JourneyStep {
  key: string;       // url, sourceLabel, or nodeId — whatever was grouped on
  people: number;     // distinct sessions reaching this step
  rate: number;       // people / totalFromReference, 0..1
}

function eventKey(e: TrackedEvent, by: "url" | "nodeId" | "source"): string | undefined {
  if (by === "url") return e.url;
  if (by === "nodeId") return e.nodeId;
  return e.sourceLabel ?? e.utm?.source;
}

/** Rank a set of keyed counts into JourneyStep rows, descending by people. */
function rank(counts: Map<string, Set<string>>, totalSessions: number): JourneyStep[] {
  return [...counts.entries()]
    .map(([key, sessions]) => ({ key, people: sessions.size, rate: totalSessions ? sessions.size / totalSessions : 0 }))
    .sort((a, b) => b.people - a.people);
}

/** For sessions that hit `fromKey`, what did they do immediately after? */
export function discoverNextSteps(
  sessions: TrackedSession[],
  fromKey: string,
  by: "url" | "nodeId" = "url",
): JourneyStep[] {
  const counts = new Map<string, Set<string>>();
  let totalSessions = 0;
  for (const s of sessions) {
    const idx = s.events.findIndex((e) => eventKey(e, by) === fromKey);
    if (idx === -1) continue;
    totalSessions++;
    const next = s.events[idx + 1];
    const key = next ? eventKey(next, by) : undefined;
    if (!key) continue;
    if (!counts.has(key)) counts.set(key, new Set());
    counts.get(key)!.add(s.id);
  }
  return rank(counts, totalSessions);
}

/** For sessions that hit `toKey`, what did they do immediately before? */
export function discoverPreviousSteps(
  sessions: TrackedSession[],
  toKey: string,
  by: "url" | "nodeId" = "url",
): JourneyStep[] {
  const counts = new Map<string, Set<string>>();
  let totalSessions = 0;
  for (const s of sessions) {
    const idx = s.events.findIndex((e) => eventKey(e, by) === toKey);
    if (idx <= 0) continue;
    totalSessions++;
    const prev = s.events[idx - 1];
    const key = eventKey(prev, by);
    if (!key) continue;
    if (!counts.has(key)) counts.set(key, new Set());
    counts.get(key)!.add(s.id);
  }
  return rank(counts, totalSessions);
}

/** Which entry sources (first event of the session) led to `toKey` at all. */
export function discoverSources(
  sessions: TrackedSession[],
  toKey: string,
  by: "url" | "nodeId" = "url",
): JourneyStep[] {
  const counts = new Map<string, Set<string>>();
  let totalSessions = 0;
  for (const s of sessions) {
    if (!s.events.length) continue;
    const reached = s.events.some((e) => eventKey(e, by) === toKey);
    if (!reached) continue;
    totalSessions++;
    const source = s.events[0].sourceLabel ?? s.events[0].utm?.source;
    if (!source) continue;
    if (!counts.has(source)) counts.set(source, new Set());
    counts.get(source)!.add(s.id);
  }
  return rank(counts, totalSessions);
}

/** People + conversion rate for a single fromKey -> toKey hop, for drawing a
 *  labeled connector line the way step-explorer edges are labeled in PLAN. */
export function stepConversion(
  sessions: TrackedSession[],
  fromKey: string,
  toKey: string,
  by: "url" | "nodeId" = "url",
): { people: number; fromPeople: number; rate: number } {
  let fromPeople = 0;
  let people = 0;
  for (const s of sessions) {
    const idx = s.events.findIndex((e) => eventKey(e, by) === fromKey);
    if (idx === -1) continue;
    fromPeople++;
    if (s.events.slice(idx + 1).some((e) => eventKey(e, by) === toKey)) people++;
  }
  return { people, fromPeople, rate: fromPeople ? people / fromPeople : 0 };
}
