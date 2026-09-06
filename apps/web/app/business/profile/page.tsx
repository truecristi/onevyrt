"use client";
/**
 * The unified business profile — one page that shows every business fact the
 * app knows, assembled from all three stores (the project doc's
 * BusinessDefinition, the workspace Reality Map, and the Brand Brain) by the
 * engine's assembleMyBusiness(). This is the "enter a fact once, see it
 * everywhere" surface.
 *
 * It reads the ready-made GET /api/my-business/summary endpoint (the single
 * assembly path) and renders the existing MyBusinessDashboard — the same
 * component the deprecated /my-business page used, now living inside the
 * canonical /business namespace. Honours a ?ws=<id> deep-link so it reflects
 * the same workspace the rest of the Business OS is working in.
 */
import { useCallback, useEffect, useState } from "react";
import type { MyBusiness, MyBusinessCompleteness } from "@onevyrt/engine";
import { MyBusinessDashboard } from "../../../components/my-business/MyBusinessDashboard";
import { Notice } from "../../../components/ui/Notice";
import { CANONICAL_ROUTES } from "../../../lib/navigation/canonical-routes";

interface MyBusinessData {
  myBusiness: MyBusiness;
  completeness: MyBusinessCompleteness;
  workspace: { id: string; name: string };
}

export default function BusinessProfilePage() {
  const [state, setState] = useState<"loading" | "ok" | "not-authenticated" | "error">("loading");
  const [data, setData] = useState<MyBusinessData | null>(null);
  // Honour a ?ws=<id> deep-link (e.g. from Studio's Business-OS bridge) so this
  // page reads the SAME workspace the rest of the section is working in.
  // Captured once (lazy) to avoid a server/client hydration mismatch.
  const [wsQuery] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const ws = new URLSearchParams(window.location.search).get("ws");
    return ws ? `?ws=${encodeURIComponent(ws)}` : "";
  });

  const load = useCallback(async () => {
    setState("loading");
    try {
      const r = await fetch(`/api/my-business/summary${wsQuery}`, { credentials: "include" });
      if (r.status === 401) { setState("not-authenticated"); return; }
      if (!r.ok) { setState("error"); return; }
      const d = (await r.json()) as MyBusinessData;
      setData(d);
      setState("ok");
    } catch {
      setState("error");
    }
  }, [wsQuery]);
  useEffect(() => { void load(); }, [load]);

  if (state === "loading") {
    return <div style={{ maxWidth: 1152, margin: "0 auto", padding: "48px 24px", color: "var(--ds-text-secondary)" }}>Loading your business profile…</div>;
  }
  if (state === "not-authenticated") {
    return <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px" }}><Notice icon="🔑" title="Please sign in" body="Sign in to view your business profile." href="/" cta="Go to sign in" /></div>;
  }
  if (state === "error" || !data) {
    return <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px" }}><Notice icon="⚠️" title="Couldn't load your profile" body="We couldn't assemble your business profile just now — your data is safe. Try again." onRetry={() => void load()} /></div>;
  }

  return (
    <div>
      <div style={{ maxWidth: 1152, margin: "0 auto", padding: "16px 24px 0" }}>
        <a href={`${CANONICAL_ROUTES.business}${wsQuery}`} style={{ fontSize: 13, fontWeight: 600, color: "var(--ds-brand)", textDecoration: "none" }}>← Back to Business OS</a>
      </div>
      <MyBusinessDashboard data={data} />
    </div>
  );
}
