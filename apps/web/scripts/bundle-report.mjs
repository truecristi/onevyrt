#!/usr/bin/env node
/**
 * Bundle Size Report Generator
 *
 * Compares current bundle to previous baseline and generates a detailed report.
 * Shows which chunks grew/shrank and identifies opportunities for optimization.
 *
 * Usage: node scripts/bundle-report.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE_SIZE_FILE = path.join(__dirname, '..', '.bundle-sizes.json');
const REPORT_FILE = path.join(__dirname, '..', 'BUNDLE_REPORT.md');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes.toFixed(0)}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

function formatPercent(value) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function generateReport() {
  if (!fs.existsSync(BUNDLE_SIZE_FILE)) {
    console.log(`${colors.yellow}⚠️  No baseline found. Run "pnpm build" first.${colors.reset}`);
    return;
  }

  const baseline = JSON.parse(fs.readFileSync(BUNDLE_SIZE_FILE, 'utf-8'));
  const timestamp = new Date(baseline.timestamp).toLocaleString();

  let report = `# Bundle Size Report

Generated: ${timestamp}

## Summary

| Metric | Current | Trend |
|--------|---------|-------|
| Total Bundle (gzipped) | ${formatBytes(baseline.total)} | - |
| Number of Chunks | ${Object.keys(baseline.bundles).length} | - |
| Status | ${baseline.results.failedChecks === 0 ? '✓ OK' : '✗ FAILED'} | - |

## Detailed Breakdown

### By Bundle Type

| Bundle | Size (gzipped) | Size (raw) | Status |
|--------|----------------|-----------|--------|
`;

  let mainSize = 0;
  let frameworkSize = 0;

  Object.entries(baseline.bundles).forEach(([name, { gzipSize, rawSize }]) => {
    const status = gzipSize < 50 * 1024 ? '✓' : '⚠️';
    const row = `| ${name} | ${formatBytes(gzipSize)} | ${formatBytes(rawSize)} | ${status} |`;
    report += row + '\n';

    if (name.includes('main')) mainSize = gzipSize;
    if (name.includes('framework')) frameworkSize = gzipSize;
  });

  report += `

## Optimization Opportunities

### High Priority

- **Code Splitting:** Ensure heavy components use dynamic imports
  - Studio components (FunnelCanvas, ProgramCentre)
  - Large education components (FunnelCalculator, DropoffAnalysis)

- **Dependency Review:** Check for unused or duplicate packages
  - Consider alternative libraries if sizes are excessive
  - Use tree-shaking for large libraries like @heroicons

- **SVG Optimization:** Compress SVG assets before including
  - Remove unnecessary attributes
  - Use SVGO for automated optimization

### Medium Priority

- **Route-Based Prefetching:** Implement intelligent prefetching for common navigation patterns
- **Package Import Optimization:** Ensure optimizePackageImports includes all large libraries
- **Tailwind CSS Purging:** Remove unused utility classes in production builds

### Low Priority

- **Service Worker Caching:** Implement intelligent caching strategies
- **API Response Compression:** Ensure gzip compression on all API endpoints
- **Font Subsetting:** Reduce webfont sizes by subsetting to used characters

## Recommendations

1. **Target:** Achieve 20-30% reduction from current size
2. **Method:** Combine code splitting + dependency optimization + SVG compression
3. **Monitoring:** Run this report after each optimization round
4. **CI/CD:** Add bundle-check to pre-deploy pipeline

## Bundle Analysis

To visualize the bundle composition:

\`\`\`bash
pnpm build:analyze
\`\`\`

This generates an interactive HTML report showing which dependencies consume the most space.

---

*Generated automatically. Re-run \`pnpm bundle:report\` after builds.*
`;

  fs.writeFileSync(REPORT_FILE, report);
  console.log(`${colors.green}✓${colors.reset} Report generated: ${colors.cyan}${path.relative(process.cwd(), REPORT_FILE)}${colors.reset}\n`);
  console.log(report);
}

generateReport();
