#!/usr/bin/env node
/**
 * Verification Script
 *
 * Checks that all bundle optimization components are correctly installed
 * and configured. Run this to ensure the optimization setup is complete.
 *
 * Usage: node scripts/verify-optimization-setup.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

let passed = 0;
let failed = 0;
let warnings = 0;

function checkFile(name, filePath, critical = true) {
  const exists = fs.existsSync(filePath);
  const relPath = path.relative(ROOT, filePath);

  if (exists) {
    console.log(`${colors.green}✓${colors.reset} ${relPath}`);
    passed++;
  } else {
    const symbol = critical ? `${colors.red}✗${colors.reset}` : `${colors.yellow}⚠${colors.reset}`;
    console.log(`${symbol} ${relPath}`);
    if (critical) failed++;
    else warnings++;
  }
}

function checkContent(name, filePath, searchString, critical = true) {
  const exists = fs.existsSync(filePath);
  if (!exists) {
    console.log(`${colors.red}✗${colors.reset} ${name}: File not found`);
    if (critical) failed++;
    else warnings++;
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const found = content.includes(searchString);
  const relPath = path.relative(ROOT, filePath);

  if (found) {
    console.log(`${colors.green}✓${colors.reset} ${name}`);
    passed++;
  } else {
    const symbol = critical ? `${colors.red}✗${colors.reset}` : `${colors.yellow}⚠${colors.reset}`;
    console.log(`${symbol} ${name}: Missing in ${relPath}`);
    if (critical) failed++;
    else warnings++;
  }
}

function verify() {
  console.log(`\n${colors.cyan}🔍 Bundle Optimization Setup Verification${colors.reset}\n`);

  // === SECTION 1: Configuration Files ===
  console.log(`${colors.cyan}1. Configuration Files${colors.reset}`);
  console.log('─'.repeat(60));
  checkFile('next.config.ts', path.join(ROOT, 'next.config.ts'));
  checkFile('package.json', path.join(ROOT, 'package.json'));
  checkFile('tailwind.config.optimized.cjs', path.join(ROOT, 'tailwind.config.optimized.cjs'), false);
  console.log('');

  // === SECTION 2: Package Dependencies ===
  console.log(`${colors.cyan}2. Package Dependencies${colors.reset}`);
  console.log('─'.repeat(60));
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));

  const requiredDevDeps = ['@next/bundle-analyzer', 'webpack-bundle-analyzer'];
  requiredDevDeps.forEach(dep => {
    if (packageJson.devDependencies?.[dep]) {
      console.log(`${colors.green}✓${colors.reset} ${dep} (v${packageJson.devDependencies[dep]})`);
      passed++;
    } else {
      console.log(`${colors.red}✗${colors.reset} ${dep}: Not in devDependencies`);
      failed++;
    }
  });
  console.log('');

  // === SECTION 3: Build Scripts ===
  console.log(`${colors.cyan}3. Build Scripts${colors.reset}`);
  console.log('─'.repeat(60));
  const requiredScripts = ['build:analyze', 'bundle:check', 'bundle:report'];
  requiredScripts.forEach(script => {
    if (packageJson.scripts?.[script]) {
      console.log(`${colors.green}✓${colors.reset} ${script}`);
      passed++;
    } else {
      console.log(`${colors.red}✗${colors.reset} ${script}: Not defined in scripts`);
      failed++;
    }
  });
  console.log('');

  // === SECTION 4: Component Files ===
  console.log(`${colors.cyan}4. Component & Utility Files${colors.reset}`);
  console.log('─'.repeat(60));
  checkFile('lazy-components.tsx', path.join(ROOT, 'components', 'lazy-components.tsx'));
  checkFile('svg-optimization.ts', path.join(ROOT, 'lib', 'svg-optimization.ts'));
  checkFile('performance.ts', path.join(ROOT, 'lib', 'performance.ts'));
  console.log('');

  // === SECTION 5: Scripts ===
  console.log(`${colors.cyan}5. Optimization Scripts${colors.reset}`);
  console.log('─'.repeat(60));
  checkFile('bundle-check.mjs', path.join(ROOT, 'scripts', 'bundle-check.mjs'));
  checkFile('bundle-report.mjs', path.join(ROOT, 'scripts', 'bundle-report.mjs'));
  checkFile('audit-dependencies.mjs', path.join(ROOT, 'scripts', 'audit-dependencies.mjs'));
  console.log('');

  // === SECTION 6: Documentation ===
  console.log(`${colors.cyan}6. Documentation${colors.reset}`);
  console.log('─'.repeat(60));
  checkFile('BUNDLE_OPTIMIZATION.md', path.join(ROOT, 'docs', 'BUNDLE_OPTIMIZATION.md'));
  checkFile('BUNDLE_OPTIMIZATION_ROADMAP.md', path.join(ROOT, 'docs', 'BUNDLE_OPTIMIZATION_ROADMAP.md'));
  checkFile('BUNDLE_OPTIMIZATION_SUMMARY.md', path.join(ROOT, '..', '..', 'BUNDLE_OPTIMIZATION_SUMMARY.md'));
  console.log('');

  // === SECTION 7: Configuration Content ===
  console.log(`${colors.cyan}7. Configuration Content${colors.reset}`);
  console.log('─'.repeat(60));

  // Check next.config.ts
  checkContent(
    'next.config.ts: Bundle analyzer',
    path.join(ROOT, 'next.config.ts'),
    'withBundleAnalyzer'
  );
  checkContent(
    'next.config.ts: Tree-shaking enabled',
    path.join(ROOT, 'next.config.ts'),
    'usedExports: true'
  );
  checkContent(
    'next.config.ts: Code splitting configured',
    path.join(ROOT, 'next.config.ts'),
    'splitChunks'
  );
  checkContent(
    'next.config.ts: SVGO configured',
    path.join(ROOT, 'next.config.ts'),
    'svgoConfig'
  );
  checkContent(
    'next.config.ts: Optimized package imports',
    path.join(ROOT, 'next.config.ts'),
    'optimizePackageImports'
  );
  console.log('');

  // === SECTION 8: Lazy Components Registry ===
  console.log(`${colors.cyan}8. Lazy Components Registry${colors.reset}`);
  console.log('─'.repeat(60));
  const lazyComponentsPath = path.join(ROOT, 'components', 'lazy-components.tsx');
  if (fs.existsSync(lazyComponentsPath)) {
    const lazyContent = fs.readFileSync(lazyComponentsPath, 'utf-8');
    const lazyComponents = [
      'LazyFunnelCanvasBuilder',
      'LazyProgramCentre',
      'LazyProgrammeCentre',
      'LazyFunnelCalculator',
      'LazyDropoffAnalysis',
    ];
    lazyComponents.forEach(comp => {
      if (lazyContent.includes(comp)) {
        console.log(`${colors.green}✓${colors.reset} ${comp}`);
        passed++;
      } else {
        console.log(`${colors.yellow}⚠${colors.reset} ${comp}: Not found (optional)`);
        warnings++;
      }
    });
  }
  console.log('');

  // === SECTION 9: Health Check ===
  console.log(`${colors.cyan}9. Project Health${colors.reset}`);
  console.log('─'.repeat(60));

  // Check if node_modules exists
  if (fs.existsSync(path.join(ROOT, 'node_modules'))) {
    console.log(`${colors.green}✓${colors.reset} Dependencies installed`);
    passed++;
  } else {
    console.log(`${colors.yellow}⚠${colors.reset} node_modules not found (run pnpm install)`);
    warnings++;
  }

  // Check if .next exists
  if (fs.existsSync(path.join(ROOT, '.next'))) {
    console.log(`${colors.green}✓${colors.reset} Build artifacts present`);
    passed++;
  } else {
    console.log(`${colors.yellow}⚠${colors.reset} .next not found (run pnpm build)`);
    warnings++;
  }
  console.log('');

  // === SUMMARY ===
  console.log('─'.repeat(60));
  console.log(`\n${colors.cyan}Summary${colors.reset}`);
  console.log(`Passed:  ${colors.green}${passed}${colors.reset}`);
  console.log(`Warnings: ${colors.yellow}${warnings}${colors.reset}`);
  console.log(`Failed:  ${colors.red}${failed}${colors.reset}`);

  if (failed > 0) {
    console.log(`\n${colors.red}✗ Setup incomplete. Fix the failed items above.${colors.reset}`);
    console.log('\nNext steps:');
    console.log('1. Ensure all files are created');
    console.log('2. Run: pnpm install');
    console.log('3. Verify: node scripts/verify-optimization-setup.mjs');
    process.exit(1);
  }

  if (warnings > 0) {
    console.log(`\n${colors.yellow}⚠️  Some optional components missing.${colors.reset}`);
    console.log('\nNext steps to complete setup:');
    console.log('1. Run: pnpm install');
    console.log('2. Run: pnpm build');
    console.log('3. Run: pnpm bundle:check');
    console.log('4. Run: pnpm build:analyze');
    process.exit(0);
  }

  console.log(`\n${colors.green}✓ Setup complete!${colors.reset}`);
  console.log('\nNext steps to get started:');
  console.log('1. pnpm install');
  console.log('2. pnpm build');
  console.log('3. pnpm bundle:check');
  console.log('4. pnpm build:analyze');
  console.log('\nRead the full guide:');
  console.log('  docs/BUNDLE_OPTIMIZATION_ROADMAP.md');
}

verify();
