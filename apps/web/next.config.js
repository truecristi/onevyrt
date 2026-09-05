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
};

module.exports = nextConfig;
