"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { BrandMark } from "../BrandLogo";

// Public marketing page shown to a first-time, unauthenticated visitor
// instead of dropping them straight on a bare login form with zero context.
//
// Visual language: iOS-style "Liquid Glass" — a soft gradient ground, frosted
// translucent panels (backdrop-blur), large rounded corners and gentle depth.
// Deliberately low-contrast and airy rather than a heavy, boxy UI.
//
// Theme-aware: a dark-mode visitor (saved preference, else their OS setting)
// gets the dark glass treatment rather than a bright white page — the same
// "same theme everywhere" promise the signed-in app keeps. Resolved on the
// client after mount (default light) to avoid a hydration mismatch.
//
// Honest copy only — real features and real prices, matching PLAN_TIERS in
// SubscriptionModal exactly, no invented metrics or testimonials.

export function LandingPage({ onGetStarted, onSignIn }: { onGetStarted: () => void; onSignIn: () => void }) {
  const [dark, setDark] = useState(false);
  // Read the single resolved theme the app-wide init script set on <html>.
  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  // One palette per theme; every colour below is derived from it. `brandRgb`
  // lets the funnel bars/badges tint the accent at varying alpha.
  const brandRgb = dark ? "48,209,88" : "10,158,110";
  const P = dark
    ? {
        text: "#F5F5F7", dim: "#98989F", brand: "#30D158", violet: "#7D7BFF", teal: "#5AD7EE",
        ground: "#000000",
        glassBg: (s: number) => `rgba(44,44,48,${Math.min(0.92, s + 0.3)})`,
        glassBorder: "rgba(255,255,255,0.12)",
        glassShadow: "0 10px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
        headerShadow: "0 1px 0 rgba(255,255,255,0.06)",
        cardShadow: "0 10px 40px rgba(0,0,0,0.5)",
        bloomA: "rgba(48,209,88,0.11)", bloomB: "rgba(120,110,255,0.10)", bloomC: "rgba(64,200,224,0.09)",
      }
    : {
        text: "#1e2c46", dim: "#586687", brand: "#088057", violet: "#5856D6", teal: "#30B0C7",
        ground: "#F2F2F7",
        glassBg: (s: number) => `rgba(255,255,255,${s})`,
        glassBorder: "rgba(255,255,255,0.6)",
        glassShadow: "0 10px 40px rgba(90,100,170,0.14), inset 0 1px 0 rgba(255,255,255,0.55)",
        headerShadow: "0 1px 0 rgba(255,255,255,0.5)",
        cardShadow: "0 10px 40px rgba(90,100,170,0.14)",
        bloomA: "rgba(10,158,110,0.07)", bloomB: "rgba(106,92,240,0.06)", bloomC: "rgba(14,165,183,0.06)",
      };
  const { text: TEXT, dim: DIM, brand: BRAND, violet: VIOLET, teal: TEAL } = P;

  // The frosted-glass surface every card/panel is built from. `strength` nudges
  // the opacity so a highlighted card can sit a touch more solid than the rest.
  const glass = (strength = 0.46, radius = 22): CSSProperties => ({
    background: P.glassBg(strength),
    backdropFilter: "blur(26px) saturate(175%)",
    WebkitBackdropFilter: "blur(26px) saturate(175%)",
    border: `1px solid ${P.glassBorder}`,
    borderRadius: radius,
    boxShadow: P.glassShadow,
  });

  const primaryBtn: CSSProperties = {
    background: BRAND,
    border: "1px solid rgba(255,255,255,0.4)",
    borderRadius: 14,
    color: dark ? "#04140b" : "#fff",
    padding: "14px 28px",
    fontSize: 15,
    fontWeight: 500,
    cursor: "pointer",
    minHeight: 48,
    boxShadow: `0 8px 24px rgba(${brandRgb},0.38)`,
  };

  const ghostBtn: CSSProperties = {
    ...glass(0.42, 14),
    color: TEXT,
    padding: "13px 24px",
    fontSize: 15,
    fontWeight: 500,
    cursor: "pointer",
    minHeight: 48,
  };

  const wrap: CSSProperties = {
    minHeight: "100vh",
    position: "relative",
    overflowX: "hidden",
    color: TEXT,
    fontFamily: "var(--font-roboto), Roboto, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Arial, sans-serif",
    // Calm ground with faint ambient blooms so the frosted glass has
    // something to mirror — kept very low opacity, not a colour transition.
    background:
      `radial-gradient(1000px 720px at 12% -6%, ${P.bloomA}, transparent 60%),`+
      `radial-gradient(900px 640px at 92% 3%, ${P.bloomB}, transparent 55%),`+
      `radial-gradient(1000px 820px at 50% 110%, ${P.bloomC}, transparent 60%),`+
      P.ground,
  };
  const section: CSSProperties = { maxWidth: 1040, margin: "0 auto", padding: "0 22px", position: "relative", zIndex: 1 };

  const features = [
    { icon: "🧭", title: "The Growth Program", body: "A 20-module guided journey in 5 chapters — Start, Define the Business and Psychology, Implement It, Define and Control the Numbers, Finish — each module wired to a tool you already have, moving you from uncertainty to freedom with a Readiness Score checked at the Start and the Finish." },
    { icon: "🗺️", title: "A live funnel canvas", body: "Map real traffic, pages, and offers as connected blocks, with a simulation that turns your assumptions into visitors, buyers, revenue, and profit." },
    { icon: "🎯", title: "Scenarios & Goal Solver", body: "Compare what-if variants side by side, or work backwards from a revenue target to the numbers that would get you there." },
    { icon: "📊", title: "Reports built for decisions", body: "A Decide-phase report, executive action plan, and scenario comparison — the parts of the plan actually worth acting on, not just a wall of charts." },
  ];
  const plans = [
    { name: "Free", price: "$0", per: "forever", body: "A fully worked, read-only demo — see everything before you commit to anything.", popular: false },
    { name: "Pro", price: "£79", per: "/mo", body: "Unlimited projects, the full Growth Program, Scenarios & Goal Solver, reports & export. One profile.", popular: true },
    { name: "Business", price: "£149", per: "/mo", body: "Everything in Pro, plus inviting your team into a shared workspace.", popular: false },
    { name: "Performance", price: "Contact us", per: "", body: "Everything in Business, plus real visitor-journey tracking and variance analysis.", popular: false },
  ];
  // Illustrative funnel stages for the hero visual — stage names only, no
  // fabricated performance figures.
  const funnel = [
    { label: "Traffic", w: "100%" },
    { label: "Pages", w: "78%" },
    { label: "Offer", w: "54%" },
    { label: "Revenue", w: "34%" },
  ];

  return (
    <div style={wrap}>
      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 10, ...glass(0.42, 0), borderRadius: 0, borderLeft: "none", borderRight: "none", borderTop: "none", boxShadow: P.headerShadow }}>
        <div style={{ ...section, display: "flex", alignItems: "center", padding: "12px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginRight: "auto" }}>
            <BrandMark size={30} color={BRAND} interactive />
            <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: 0.4 }}>ONEVYRT</span>
          </div>
          <button onClick={onSignIn} style={{ background: "none", border: "none", color: TEXT, cursor: "pointer", fontSize: 14, fontWeight: 500, padding: "12px 14px", minHeight: 44 }}>Sign in</button>
          <button onClick={onGetStarted} style={{ ...primaryBtn, padding: "10px 20px", fontSize: 14, minHeight: 44 }}>Get started</button>
        </div>
      </header>

      {/* Hero */}
      <div style={{ ...section, paddingTop: 72, paddingBottom: 40, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 40, alignItems: "center" }}>
        <div>
          <div style={{ display: "inline-block", ...glass(0.4, 14), padding: "7px 15px", fontSize: 12.5, fontWeight: 500, letterSpacing: 0.4, color: VIOLET, marginBottom: 20 }}>
            Business planning + funnel modelling
          </div>
          <h1 style={{ fontSize: "clamp(34px, 5vw, 54px)", fontWeight: 700, lineHeight: 1.08, letterSpacing: -0.5, margin: "0 0 18px" }}>
            Turn a raw idea into a numbers-backed business plan.
          </h1>
          <p style={{ fontSize: 17, color: DIM, maxWidth: 520, margin: "0 0 30px", lineHeight: 1.6 }}>
            A guided business-planning program and a live funnel canvas in one place — define the business, map the funnel, simulate the numbers, and know what to do next.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <button onClick={onGetStarted} style={primaryBtn}>Get started free</button>
            <button onClick={onSignIn} style={ghostBtn}>Sign in</button>
          </div>
          <div style={{ fontSize: 12.5, color: DIM, marginTop: 14 }}>No card required to explore the demo.</div>
        </div>

        {/* Hero glass visual — an illustrative funnel + metric tiles */}
        <div style={{ ...glass(0.42, 26), padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700 }}>Your funnel, simulated</span>
            <span style={{ ...glass(0.46, 14), padding: "4px 11px", fontSize: 11, fontWeight: 500, color: BRAND, border: `1px solid rgba(${brandRgb},0.28)` }}>live</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 18 }}>
            {funnel.map((s, i) => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 11.5, color: DIM, width: 58, flexShrink: 0 }}>{s.label}</span>
                <div style={{ height: 26, width: s.w, borderRadius: 8, background: `rgba(${brandRgb},${0.9 - i * 0.16})`, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)" }} />
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {["Visitors", "Buyers", "Profit"].map((m) => (
              <div key={m} style={{ ...glass(0.42, 14), padding: "12px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: DIM, marginBottom: 4 }}>{m}</div>
                <div style={{ height: 6, borderRadius: 14, background: TEAL }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{ ...section, paddingTop: 30, paddingBottom: 20 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.6, color: VIOLET, textAlign: "center", marginBottom: 8 }}>WHAT&apos;S INSIDE</div>
        <h2 style={{ fontSize: "clamp(24px, 3.4vw, 32px)", fontWeight: 700, letterSpacing: -0.3, textAlign: "center", margin: "0 0 30px" }}>Everything from idea to a plan worth acting on</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 18 }}>
          {features.map((f) => (
            <div key={f.title} style={{ ...glass(0.42, 20), padding: 22 }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, ...glass(0.6, 14), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 14 }}>{f.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 7 }}>{f.title}</div>
              <div style={{ fontSize: 13.5, color: DIM, lineHeight: 1.6 }}>{f.body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <div style={{ ...section, paddingTop: 50, paddingBottom: 20 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.6, color: VIOLET, textAlign: "center", marginBottom: 8 }}>PRICING</div>
        <h2 style={{ fontSize: "clamp(24px, 3.4vw, 32px)", fontWeight: 700, letterSpacing: -0.3, textAlign: "center", margin: "0 0 30px" }}>Simple plans, honest prices</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18, alignItems: "stretch" }}>
          {plans.map((p) => (
            <div key={p.name} style={{ ...glass(p.popular ? 0.72 : 0.5, 20), padding: 24, position: "relative", display: "flex", flexDirection: "column", border: p.popular ? `1.5px solid ${BRAND}` : `1px solid ${P.glassBorder}`, boxShadow: p.popular ? `0 16px 48px rgba(${brandRgb},0.26)` : P.cardShadow }}>
              {p.popular && (
                <span style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: BRAND, color: dark ? "#04140b" : "#fff", fontSize: 11, fontWeight: 700, letterSpacing: 0.3, padding: "5px 14px", borderRadius: 14, boxShadow: `0 6px 16px rgba(${brandRgb},0.4)`, whiteSpace: "nowrap" }}>MOST POPULAR</span>
              )}
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{p.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 12 }}>
                <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>{p.price}</span>
                {p.per && <span style={{ fontSize: 13, color: DIM }}>{p.per}</span>}
              </div>
              <div style={{ fontSize: 13, color: DIM, lineHeight: 1.6, marginBottom: 20, flex: 1 }}>{p.body}</div>
              <button onClick={onGetStarted} style={p.popular ? { ...primaryBtn, width: "100%", padding: "12px 0" } : { ...ghostBtn, width: "100%", padding: "12px 0" }}>
                {p.name === "Performance" ? "Contact us" : p.name === "Free" ? "Explore the demo" : "Get started"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Footer CTA */}
      <div style={{ ...section, paddingTop: 50, paddingBottom: 60, textAlign: "center" }}>
        <div style={{ ...glass(0.46, 34), padding: "44px 24px", maxWidth: 720, margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(22px, 3vw, 30px)", fontWeight: 700, letterSpacing: -0.3, margin: "0 0 10px" }}>Start with the free demo</h2>
          <p style={{ fontSize: 15, color: DIM, margin: "0 0 24px", lineHeight: 1.6 }}>See the whole thing worked end to end — no card required.</p>
          <button onClick={onGetStarted} style={primaryBtn}>Get started free</button>
        </div>
        <div style={{ fontSize: 12, color: DIM, marginTop: 28 }}>
          <a href="/welcome" style={{ color: DIM, textDecoration: "none" }}>How it works</a>
          <span style={{ margin: "0 8px", opacity: 0.5 }}>·</span>
          <a href="/privacy" style={{ color: DIM, textDecoration: "none" }}>Privacy</a>
          <span style={{ margin: "0 8px", opacity: 0.5 }}>·</span>
          <a href="/terms" style={{ color: DIM, textDecoration: "none" }}>Terms</a>
        </div>
      </div>
    </div>
  );
}
