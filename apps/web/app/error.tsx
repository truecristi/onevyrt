"use client";
/**
 * Route-segment error boundary (Ch.090). Runs in the browser, so it can't call
 * logger.ts directly; it best-effort-reports to /api/client-error so a render
 * crash leaves a server-side trace instead of only a console message the user
 * never opens devtools to see.
 *
 * Self-contained styling (no design-token dependency): this renders *after* a
 * crash, when the studio's themed wrapper — and the CSS variables it injects —
 * may be gone. So it resolves the palette itself from the user's saved theme
 * (falling back to the OS preference) and inlines every colour, keeping the
 * Liquid-Glass look and the green accent even here.
 */
import { useEffect, useState } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [dark, setDark] = useState(true);

  // Read the single resolved theme the app-wide init script set on <html>.
  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  useEffect(() => {
    fetch("/api/client-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: error.message, stack: error.stack, digest: error.digest, url: location.href }),
      keepalive: true,
    }).catch(() => {});
  }, [error]);

  const green = dark ? "#30D158" : "#087f57";
  const bg = dark ? "#000000" : "#F2F2F7";
  const cardBg = dark ? "rgba(28,28,30,0.72)" : "rgba(255,255,255,0.7)";
  const cardBorder = dark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.7)";
  const text = dark ? "#F5F5F7" : "#1e2c46";
  const muted = dark ? "#98989F" : "#586687";

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", background: bg, color: text,
      // A soft green bloom so even the failure screen feels part of the product.
      backgroundImage: `radial-gradient(60vw 40vh at 50% -10%, ${dark ? "rgba(48,209,88,0.12)" : "rgba(10,158,110,0.1)"}, transparent 70%)`,
    }}>
      <div style={{
        maxWidth: 420, width: "100%", textAlign: "center", background: cardBg,
        backdropFilter: "blur(26px) saturate(1.7)", WebkitBackdropFilter: "blur(26px) saturate(1.7)",
        border: `1px solid ${cardBorder}`, borderRadius: 21, padding: "34px 30px",
        boxShadow: dark ? "0 24px 60px -16px rgba(0,0,0,0.65)" : "0 24px 60px -18px rgba(40,54,90,0.2)",
      }}>
        <div aria-hidden style={{
          width: 48, height: 48, borderRadius: 11, margin: "0 auto 16px", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 24, background: dark ? "rgba(48,209,88,0.14)" : "rgba(10,158,110,0.12)",
        }}>{"⚠️"}</div>
        <h1 style={{ fontSize: 19, fontWeight: 700, margin: "0 0 8px" }}>Something went wrong</h1>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: muted, margin: "0 0 22px" }}>
          A hiccup on this screen — nothing you did. It has been logged, and your saved work is safe. Try again, or head back home.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => reset()} style={{
            padding: "9px 18px", borderRadius: 11, border: "none", background: green, color: "#fff",
            fontWeight: 500, fontSize: 14, cursor: "pointer",
          }}>Try again</button>
          <button onClick={() => { location.href = "/"; }} style={{
            padding: "9px 18px", borderRadius: 11, border: `1px solid ${cardBorder}`, background: "transparent",
            color: text, fontWeight: 500, fontSize: 14, cursor: "pointer",
          }}>Go home</button>
        </div>
      </div>
    </div>
  );
}
