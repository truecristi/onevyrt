import type { ReactNode } from "react";
import { Roboto } from "next/font/google";

import "./globals.css";
import "./design-system.css";
import AiConnectionSync from "../components/AiConnectionSync";
import CsrfTokenInitializer from "../components/SecurityInitializer";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
  variable: "--font-roboto",
});

const TITLE = "OneVYRT — Know if your funnel makes money before you spend on ads";
const DESCRIPTION = "For founders and marketers: map your funnel, simulate the numbers, and know exactly what to fix next — before the ad spend. Built on the DigitalMarketer framework.";

export const metadata = {
  metadataBase: new URL("https://onevyrt.masteryresearch.com"),
  title: TITLE,
  description: DESCRIPTION,
  // og/twitter images are supplied by app/opengraph-image.tsx (a dynamic
  // 1200×630 branded card) — Next injects it automatically, so no static
  // image URL is listed here. Twitter uses the large-image card to match.
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: "OneVYRT",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  icons: {
    icon: [
      {
        url: "/brand/onevyrt/ONEVYRT_BROWSER_ICON_64.png",
        type: "image/png",
        sizes: "64x64",
      },
    ],
    apple: [
      {
        url: "/brand/onevyrt/ONEVYRT_APPLE_ICON_180.png",
        type: "image/png",
        sizes: "180x180",
      },
    ],
  },
};

// Tints the mobile browser chrome (Safari address bar, Android status bar) to
// match the app background so the product feels seamless from the OS in — the
// values mirror the light/dark --bg tokens in lib/studio/theme-css.ts.
// width=device-width ensures proper viewport scaling on mobile devices.
// viewport-fit=cover extends content into safe areas (notches, Dynamic Island).
// See docs/MOBILE_TESTING_CHECKLIST.md for complete mobile responsiveness spec.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F2F7" },
    { media: "(prefers-color-scheme: dark)", color: "#1a2438" },
  ],
};

// Applies the saved light/dark choice to <html data-theme> before first paint,
// so there is no flash of the wrong theme. One key for the whole product:
// "gb-theme" (also used by the Studio's toggle), resolved here into the single
// <html data-theme> attribute every surface reads. Default is light. Kept tiny +
// inline and runs synchronously in <head>. suppressHydrationWarning on <html>
// because this script sets an attribute React doesn't render on the server.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('gb-theme');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light');}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={roboto.variable} data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <CsrfTokenInitializer />
      </head>
      <body><AiConnectionSync />{children}</body>
    </html>
  );
}
