"use client";
/**
 * useEnrollment — the shared read of GET /api/programme/enrollment: which
 * workspace the viewer lands in, their role there, and whether it has a
 * coach. Every programme surface that needs that context (which workspace am
 * I looking at? can I edit? is there a coach to submit to?) previously
 * inlined its own fetch/useEffect for it (see ProgrammeJourney/LessonGuide);
 * this is that context factored out so a new page — like Chapter 4's
 * growth-plan artifact — doesn't have to re-derive it.
 *
 * Deliberately thin: it does NOT know about Chapter 4. The Growth &
 * Improvement Plan itself lives in a separate table behind separate routes
 * (GET/POST /api/programme/chapter/4/*, see lib/chapter4-submissions.ts) —
 * this hook only resolves the shared wsId/role/hasCoach a page layers that
 * fetch on top of, the same way it would for any other programme page.
 */
import { useCallback, useEffect, useState } from "react";
import type { Role } from "../../lib/workspaces";

export type EnrollmentLoadState = "loading" | "ok" | "not-authenticated" | "error";

export interface EnrollmentContext {
  /** The resolved workspace id (the `ws` param passed in, or the viewer's own
   *  personal workspace when omitted) — null until the first load resolves. */
  wsId: string | null;
  role: Role | null;
  hasCoach: boolean;
  state: EnrollmentLoadState;
  /** Re-run the fetch (e.g. after an action elsewhere changes role/coach state). */
  reload: () => void;
}

/** `wsId` is optional — pass a workspace id (typically from a `?ws=` query
 *  param, coach-viewing-a-client convention used across the programme API)
 *  to scope the read to a specific workspace, or omit it to fall back to the
 *  viewer's own personal workspace, matching every other programme fetch. */
export function useEnrollment(wsId?: string): EnrollmentContext {
  const [resolvedWsId, setResolvedWsId] = useState<string | null>(wsId ?? null);
  const [role, setRole] = useState<Role | null>(null);
  const [hasCoach, setHasCoach] = useState(false);
  const [state, setState] = useState<EnrollmentLoadState>("loading");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const q = wsId ? `?ws=${encodeURIComponent(wsId)}` : "";
      const r = await fetch(`/api/programme/enrollment${q}`, { credentials: "include" });
      if (r.status === 401) { setState("not-authenticated"); return; }
      if (!r.ok) { setState("error"); return; }
      const data = (await r.json()) as { role?: Role; hasCoach?: boolean; enrollment?: { workspaceId?: string } };
      // The API resolves wsId itself (the ws param, or the caller's personal
      // workspace when absent) and echoes it on the enrollment — prefer that
      // over the input param so callers that passed nothing still get a
      // concrete id back to scope their own fetches with.
      setResolvedWsId(data.enrollment?.workspaceId ?? wsId ?? null);
      setRole(data.role ?? null);
      setHasCoach(Boolean(data.hasCoach));
      setState("ok");
    } catch {
      setState("error");
    }
  }, [wsId]);

  useEffect(() => { void load(); }, [load]);

  return { wsId: resolvedWsId, role, hasCoach, state, reload: () => void load() };
}
