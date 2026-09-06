#!/usr/bin/env node
/**
 * Bundle Size Check Script
 *
 * Analyzes the production bundle and verifies it meets size targets.
 * Targets: Main bundle < 100KB (gzipped), chunk < 50KB
 *
 * Usage: node scripts/bundle-check.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = path.join(__dirname, '..', '.next', 'static', 'chunks');
const BUNDLE_SIZE_FILE = path.join(__dirname, '..', '.bundle-sizes.json');

// Bundle size targets in bytes
const TARGETS = {
  main: 100 * 1024,      // 100 KB gzipped
  chunk: 50 * 1024,      // 50 KB gzipped
  framework: 80 * 1024,  // 80 KB gzipped
  total: 300 * 1024,     // 300 KB total gzipped
};

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function getGzipSize(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return zlib.gzipSync(content).length;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return 0;
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes.toFixed(0)}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

function checkBundleSize() {
  if (!fs.existsSync(BUILD_DIR)) {
    console.error(`${colors.red}✗${colors.reset} Build directory not found: ${BUILD_DIR}`);
    console.log('Run "pnpm build" first');
    process.exit(1);
  }

  console.log(`\n${colors.cyan}📦 Bundle Size Analysis${colors.reset}\n`);

  const files = fs.readdirSync(BUILD_DIR).filter(f => f.endsWith('.js'));
  const bundles = {};
  let totalSize = 0;
  let passedChecks = 0;
  let failedChecks = 0;

  // Analyze each bundle
  files.forEach(file => {
    const filePath = path.join(BUILD_DIR, file);
    const gzipSize = getGzipSize(filePath);
    const rawSize = fs.statSync(filePath).size;

    bundles[file] = { gzipSize, rawSize };
    totalSize += gzipSize;

    // Determine bundle type
    let bundleType = 'chunk';
    if (file.includes('main')) bundleType = 'main';
    else if (file.includes('framework')) bundleType = 'framework';

    // Check against targets
    const target = TARGETS[bundleType] || TARGETS.chunk;
    const status = gzipSize <= target;
    const icon = status ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;

    if (status) passedChecks++;
    else failedChecks++;

    console.log(
      `${icon} ${file.padEnd(40)} ${formatBytes(gzipSize).padStart(10)} ` +
      `${colors.gray}(raw: ${formatBytes(rawSize).padStart(10)})${colors.reset}`
    );

    if (!status) {
      const excess = gzipSize - target;
      console.log(`   ${colors.yellow}→ Exceeds target by ${formatBytes(excess)}${colors.reset}`);
    }
  });

  console.log('\n' + '─'.repeat(60));

  // Total size check
  const totalStatus = totalSize <= TARGETS.total;
  const totalIcon = totalStatus ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
  console.log(
    `${totalIcon} Total (gzipped): ${formatBytes(totalSize).padStart(10)} / ${formatBytes(TARGETS.total)}`
  );
  if (!totalStatus) {
    const excess = totalSize - TARGETS.total;
    console.log(`   ${colors.yellow}→ Exceeds target by ${formatBytes(excess)}${colors.reset}`);
    failedChecks++;
  } else {
    passedChecks++;
  }

  // Save baseline for comparison
  const baseline = {
    timestamp: new Date().toISOString(),
    bundles,
    total: totalSize,
    results: { passedChecks, failedChecks },
  };

  fs.writeFileSync(BUNDLE_SIZE_FILE, JSON.stringify(baseline, null, 2));
  console.log(`\n💾 Baseline saved to ${path.relative(process.cwd(), BUNDLE_SIZE_FILE)}`);

  // Summary
  console.log('\n' + '─'.repeat(60));
  console.log(`${colors.cyan}Summary${colors.reset}: ${passedChecks} passed, ${failedChecks} failed`);

  if (failedChecks > 0) {
    console.log(`\n${colors.red}⚠️  Some bundles exceed size targets.${colors.reset}`);
    console.log('Optimization suggestions:');
    console.log('  1. Check lib/ for unused dependencies');
    console.log('  2. Use code splitting for large components');
    console.log('  3. Lazy load route-specific dependencies');
    console.log('  4. Check for duplicate dependencies in node_modules');
    console.log('  5. Use "pnpm build:analyze" to visualize bundle');
    process.exit(1);
  } else {
    console.log(`\n${colors.green}✓ All bundles meet size targets!${colors.reset}\n`);
  }
}

checkBundleSize();
