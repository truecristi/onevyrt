/**
 * Web app manifest — makes ONEVYRT installable (Add to Home Screen) as a
 * standalone app, matching the theme-color/icon work in layout.tsx. Colours
 * mirror the dark --bg token so the splash and chrome match the product.
 */
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OneVYRT — Business planning & funnel modelling",
    short_name: "OneVYRT",
    description:
      "A guided business-planning program and a live funnel canvas: define the business, map the funnel, simulate the numbers, and know what to do next.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/brand/onevyrt/ONEVYRT_BROWSER_ICON_64.png", sizes: "64x64", type: "image/png" },
      { src: "/brand/onevyrt/ONEVYRT_APPLE_ICON_180.png", sizes: "180x180", type: "image/png" },
      { src: "/pwa-icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
