/**
 * Dynamic Open Graph / social-share card (1200×630) rendered by next/og.
 * A branded card beats the raw brand PNG as a link preview: it carries the
 * product name, the one-line promise, and an illustrative funnel so a shared
 * link reads as a real product, not a stray image. Next also serves this for
 * Twitter (summary_large_image) unless a twitter-image is provided.
 */
import { ImageResponse } from "next/og";

// Default (Node) runtime deliberately — this app deploys as a self-hosted Node
// server (see RUNBOOK/Docker), not on an edge platform.
export const alt = "OneVYRT — turn a raw idea into a numbers-backed business plan";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const bars = ["100%", "78%", "54%", "34%"];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background:
            "radial-gradient(900px 600px at 15% -10%, rgba(48,209,88,0.18), transparent 60%)," +
            "radial-gradient(800px 560px at 95% 10%, rgba(120,110,255,0.14), transparent 55%)," +
            "#000000",
          color: "#F5F5F7",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: "#30D158" }} />
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 1 }}>ONEVYRT</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 62, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1, maxWidth: 900 }}>
            Turn a raw idea into a numbers-backed business plan.
          </div>
          <div style={{ fontSize: 27, color: "#98989F", maxWidth: 820, lineHeight: 1.4 }}>
            A guided business-planning program and a live funnel canvas — define, map, simulate, and know what to do next.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {bars.map((w, i) => (
            <div
              key={w}
              style={{
                width: w,
                height: 16,
                borderRadius: 8,
                background: `rgba(48,209,88,${0.95 - i * 0.18})`,
              }}
            />
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
