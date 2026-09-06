"use client";
/**
 * Small, read-only "what you're testing right now" strip — surfaces the
 * workspace's Experiment Register (Studio's "experiments" tab) on pages
 * that don't otherwise see it: Offer, Message, Constraint. This is how
 * Section 13 of the platform spec's "one experiment system shared by
 * growth, pricing, offers, operations, and customer experience" is met
 * WITHOUT promoting ExperimentEntry to a per-workspace store (that would
 * strand its siblings — see api/projects/primary-experiments/route.ts's
 * own comment for why). Self-fetching so each page only needs to render
 * <RecentExperiments />, matching this app's existing convention for
 * workspace-scoped client fetches (no ws param — the route defaults to
 * the caller's own workspace via cookie).
 *
 * Renders nothing when there's nothing to show (no primary project, or a
 * primary project with an empty register) — this is a bonus signal, not
 * a form, so an empty state would just be clutter on every page for
 * anyone who hasn't touched the Studio Experiments tab yet.
 */
import { useEffect, useState } from "react";
import type { ExperimentEntry, ExperimentStatus } from "@onevyrt/engine";
import { CANONICAL_ROUTES } from "../../lib/navigation/canonical-routes";

const STATUS_COLOR: Record<ExperimentStatus, string> = {
  planned: "var(--ds-text-tertiary)",
  running: "#f59e0b",
  completed: "#16a34a",
  abandoned: "#dc2626",
};

export function RecentExperiments({ limit = 3 }: { limit?: number }) {
  const [experiments, setExperiments] = useState<ExperimentEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/projects/primary-experiments", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { experiments: [] }))
      .then((d: { experiments?: ExperimentEntry[] }) => { if (!cancelled) setExperiments(d.experiments ?? []); })
      .catch(() => { if (!cancelled) setExperiments([]); });
    return () => { cancelled = true; };
  }, []);

  if (!experiments || experiments.length === 0) return null;

  return (
    <div style={{ border: "1px solid var(--ds-border-default)", borderRadius: 10, padding: "10px 12px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ds-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
          What you&apos;re testing right now
        </span>
        <a href={CANONICAL_ROUTES.studio} style={{ fontSize: 11.5, color: "var(--ds-brand)", textDecoration: "none" }}>
          View all in Studio →
        </a>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {experiments.slice(0, limit).map((e) => (
          <div key={e.id} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 12.5 }}>
            <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_COLOR[e.status], flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{e.hypothesis}</span>
            {e.metric && <span style={{ color: "var(--ds-text-tertiary)", fontSize: 11.5 }}>{e.metric}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
