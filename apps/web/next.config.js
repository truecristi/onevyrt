/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages ship raw TypeScript (no build step of their own),
  // so Next must transpile them itself - see ADR-0001.
  transpilePackages: [
    "@onevyrt/auth",
    "@onevyrt/contracts",
    "@onevyrt/database",
    "@onevyrt/design-system",
    "@onevyrt/domain",
    "@onevyrt/observability",
    "@onevyrt/security",
  ],
  eslint: {
    // Linting runs as its own CI step across the whole monorepo;
    // no need to duplicate it inside the Next build.
    ignoreDuringBuilds: true,
  },
  // Phase 8 security review finding: no baseline security headers were
  // set anywhere (no middleware, no per-route headers). These are cheap,
  // standard defense-in-depth that cost nothing regardless of how little
  // page UI exists yet - clickjacking, MIME-sniffing and referrer-leakage
  // protection apply to the API responses themselves, not just rendered
  // pages. A real Content-Security-Policy is deferred until there's
  // actual page markup/script origins to write a meaningful policy
  // against (see docs/decisions - this is intentionally not invented
  // speculatively).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
