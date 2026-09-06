/**
 * Generated 512×512 maskable app icon for the web manifest (installability).
 * The shipped brand PNGs are only 64/180px; PWA install wants a 512 icon, so
 * this renders one from the brand mark — a green rounded square on black — via
 * next/og. Node runtime to match the self-hosted deploy.
 */
import { ImageResponse } from "next/og";

// Note: no `export const contentType` here — that export is only recognized
// on the special icon.tsx/opengraph-image.tsx convention files, not a plain
// route.tsx. It's not needed anyway: ImageResponse sets the real
// `Content-Type: image/png` response header itself.
const SIZE = 512;

export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#000000" }}>
        <div style={{ width: 300, height: 300, borderRadius: 84, background: "#30D158", display: "flex", alignItems: "center", justifyContent: "center", color: "#04140b", fontSize: 190, fontWeight: 700, fontFamily: "sans-serif" }}>O</div>
      </div>
    ),
    { width: SIZE, height: SIZE },
  );
}
