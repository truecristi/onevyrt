"use client";
/**
 * 404 page. Next.js otherwise renders a bare, unbranded default here; this keeps
 * a wrong URL on-brand and gives the owner a way back instead of a dead end.
 *
 * Self-contained styling for the same reason error.tsx is: this can render
 * outside any themed wrapper, so it resolves the palette from the saved theme
 * (falling back to the OS preference) and inlines every colour, matching the
 * error boundary's Liquid-Glass look and green accent.
 */
import { useEffect, useState } from "react";

export default function NotFound() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "dark") setDark(true);
    else if (attr === "light") setDark(false);
    else setDark(window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true);
  }, []);

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
      backgroundImage: `radial-gradient(60vw 40vh at 50% -10%, ${dark ? "rgba(48,209,88,0.12)" : "rgba(10,158,110,0.1)"}, transparent 70%)`,
    }}>
      <div style={{
        maxWidth: 420, width: "100%", textAlign: "center", background: cardBg,
        backdropFilter: "blur(26px) saturate(1.7)", WebkitBackdropFilter: "blur(26px) saturate(1.7)",
        border: `1px solid ${cardBorder}`, borderRadius: 21, padding: "34px 30px",
        boxShadow: dark ? "0 24px 60px -16px rgba(0,0,0,0.65)" : "0 24px 60px -18px rgba(40,54,90,0.2)",
      }}>
        <div aria-hidden style={{
          fontSize: 40, fontWeight: 800, letterSpacing: -1, margin: "0 0 4px",
          color: green,
        }}>404</div>
        <h1 style={{ fontSize: 19, fontWeight: 700, margin: "0 0 8px" }}>This page doesn&rsquo;t exist</h1>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: muted, margin: "0 0 22px" }}>
          The link may be old or mistyped. Nothing&rsquo;s broken — head back to your Dashboard and pick up where you left off.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/command-center" style={{
            padding: "9px 18px", borderRadius: 11, border: "none", background: green, color: "#fff",
            fontWeight: 500, fontSize: 14, cursor: "pointer", textDecoration: "none",
          }}>Go to Dashboard</a>
          <a href="/" style={{
            padding: "9px 18px", borderRadius: 11, border: `1px solid ${cardBorder}`, background: "transparent",
            color: text, fontWeight: 500, fontSize: 14, cursor: "pointer", textDecoration: "none",
          }}>Home</a>
        </div>
      </div>
    </div>
  );
}
