import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

/**
 * Hosts allowed to load dev resources (/_next/*, HMR).
 *
 * Next blocks these cross-origin by default, and it is right to: `next dev`
 * serves source maps and an HMR websocket. Reaching the studio over a tunnel
 * means the browser's origin is the public hostname, not the LAN IP, so that
 * host must be listed or the page shell loads and the app never boots.
 *
 * Set GEARBOX_DEV_ORIGINS to a comma-separated list to add your own without
 * editing source (and therefore without tripping the injector drift guard).
 *
 * This is a DEVELOPMENT convenience only. A public deployment should run a
 * production build (`next build` + `next start`), where none of this applies.
 */
const extra = (process.env.GEARBOX_DEV_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Production security headers. Shipped as Content-Security-Policy-Report-Only
 * rather than enforcing: the app loads Stripe.js, calls OpenRouter directly
 * from the browser (see funnel-studio.tsx), and there's been no full audit of
 * every inline style/script the studio's canvas relies on. Report-only can
 * never break the app — it only logs violations to devtools — so this ships
 * safely today and gives real data to tighten into an enforcing policy (and
 * eventually nonce-based script-src instead of 'unsafe-inline') later. The
 * other headers below are unconditionally safe and enforced immediately.
 */
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://openrouter.ai https://api.openai.com https://api.anthropic.com https://api.x.ai https://api.stripe.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [
    "100.81.25.26",
    "192.168.0.22",
    "truecristi-server-1.tail20d2c7.ts.net",
    ...extra,
  ],
  // Performance optimization: Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 365, // Cache images for 1 year
    dangerouslyAllowSVG: true, // Allow SVG optimization
  },
  // Performance optimization: Code splitting and tree-shaking
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Client-side optimizations
      config.optimization = {
        ...config.optimization,
        // Aggressive tree-shaking of unused code
        usedExports: true,
        sideEffects: false,
        // Minimize to reduce bundle size
        minimize: true,
        // Split vendor code into separate chunks for better caching
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          maxAsyncRequests: 30,
          maxInitialRequests: 30,
          cacheGroups: {
            // Core Next.js/React split - highest priority
            framework: {
              chunks: 'all',
              name: 'framework',
              test: /(?<!node_modules.*)[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
              priority: 50,
              reuseExistingChunk: true,
              enforce: true,
            },
            // Stripe and payment providers
            payments: {
              test: /[\\/]node_modules[\\/](@stripe|stripe)[\\/]/,
              name: 'payments',
              priority: 45,
              reuseExistingChunk: true,
              enforce: true,
            },
            // Heavy visualization/editor dependencies
            editors: {
              test: /[\\/]node_modules[\\/](@xyflow|xflow)[\\/]/,
              name: 'editors',
              priority: 40,
              reuseExistingChunk: true,
              enforce: true,
            },
            // PDF generation
            pdf: {
              test: /[\\/]node_modules[\\/](jspdf|pdf-lib)[\\/]/,
              name: 'pdf',
              priority: 35,
              reuseExistingChunk: true,
              enforce: true,
            },
            // State management and utilities
            utilities: {
              test: /[\\/]node_modules[\\/](@onevyrt|zustand|immer)[\\/]/,
              name: 'utilities',
              priority: 25,
              reuseExistingChunk: true,
              enforce: true,
            },
            // Common shared code between routes
            commons: {
              chunks: 'all',
              minChunks: 2,
              name: 'commons',
              priority: 20,
              reuseExistingChunk: true,
              enforce: false,
            },
          },
        },
      };

      // SVG optimization with SVGO
      config.module.rules.push({
        test: /\.svg$/,
        use: [
          {
            loader: '@svgr/webpack',
            options: {
              svgoConfig: {
                plugins: [
                  {
                    name: 'preset-default',
                    params: {
                      overrides: {
                        removeViewBox: false,
                        removeHiddenElems: true,
                        removeEmptyContainers: true,
                        cleanupNumericValues: { floatToShort: true },
                        convertPathData: { precision: 2 },
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      });
    }
    return config;
  },
  // Experimental features for performance
  experimental: {
    // Enable optimized package imports (auto tree-shake)
    optimizePackageImports: [
      '@heroicons/react',
      'jspdf',
      '@xyflow/react',
      '@onevyrt/engine',
      'zustand',
    ],
  },
  // Compression and minification
  compress: true,
  productionBrowserSourceMaps: false, // Disable source maps in production for smaller bundle
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
          // Ignored unless the response is actually served over HTTPS (which
          // it always is here, via the Cloudflare Tunnel) — harmless over
          // plain-http LAN/dev access, so no NODE_ENV gate needed.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
        ],
      },
    ];
  },
};

// Enable bundle analyzer when ANALYZE env var is set
export default withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: process.env.ANALYZE === 'true' && !process.env.CI,
})(nextConfig);
