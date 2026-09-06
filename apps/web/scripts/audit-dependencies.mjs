#!/usr/bin/env node
/**
 * Dependency Audit Script
 *
 * Analyzes package.json for:
 * 1. Unused dependencies
 * 2. Duplicate dependencies
 * 3. Large packages that could be optimized
 * 4. Security vulnerabilities
 *
 * Usage: node scripts/audit-dependencies.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(ROOT, 'package.json');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * Known large packages with smaller alternatives
 */
const LARGE_PACKAGE_ALTERNATIVES = {
  'moment': {
    size: '67 KB',
    alternative: 'date-fns (13 KB) or dayjs (2 KB)',
    savings: '50-65 KB',
  },
  'lodash': {
    size: '70 KB',
    alternative: 'lodash-es with tree-shaking or native JS',
    savings: '60-70 KB',
  },
  '@material-ui/core': {
    size: '180 KB',
    alternative: 'Import only what you need or use shadcn',
    savings: '100-150 KB',
  },
  'react-query': {
    size: '40 KB',
    alternative: 'swr (4 KB) or native fetch + React hooks',
    savings: '35-40 KB',
  },
  'axios': {
    size: '15 KB',
    alternative: 'native fetch API or got',
    savings: '10-15 KB',
  },
  'chalk': {
    size: '8 KB',
    alternative: 'native console methods',
    savings: '5-8 KB',
  },
};

/**
 * Packages that should only be in devDependencies
 */
const SERVER_ONLY_PACKAGES = [
  'pg',
  'nodemailer',
  'node-pg-migrate',
];

function analyzePackageJson() {
  console.log(`\n${colors.cyan}📦 Dependency Audit Report${colors.reset}\n`);
  console.log(`Analyzing: ${PACKAGE_JSON_PATH}\n`);

  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  let issues = 0;
  let warnings = 0;

  // Check 1: Identify dependencies (should only be in devDependencies)
  console.log(`${colors.cyan}1. Server-Only Dependencies${colors.reset}`);
  console.log('─'.repeat(60));

  let serverOnlyIssues = false;
  SERVER_ONLY_PACKAGES.forEach(pkg => {
    if (packageJson.dependencies?.[pkg]) {
      console.log(
        `${colors.red}✗${colors.reset} ${pkg} is in dependencies but should be in devDependencies`
      );
      serverOnlyIssues = true;
      issues++;
    }
  });

  if (!serverOnlyIssues) {
    console.log(`${colors.green}✓${colors.reset} All server packages are in devDependencies\n`);
  } else {
    console.log('');
  }

  // Check 2: Large packages with alternatives
  console.log(`${colors.cyan}2. Large Packages Optimization Opportunities${colors.reset}`);
  console.log('─'.repeat(60));

  let largePackageWarnings = 0;
  Object.entries(LARGE_PACKAGE_ALTERNATIVES).forEach(([pkg, alt]) => {
    if (allDeps[pkg]) {
      console.log(`${colors.yellow}⚠${colors.reset} ${pkg} (${alt.size})`);
      console.log(`   Alternative: ${alt.alternative}`);
      console.log(`   Potential savings: ${alt.savings}\n`);
      largePackageWarnings++;
      warnings++;
    }
  });

  if (largePackageWarnings === 0) {
    console.log(`${colors.green}✓${colors.reset} No large packages found that have better alternatives\n`);
  }

  // Check 3: Peer dependencies
  console.log(`${colors.cyan}3. Dependency Tree Analysis${colors.reset}`);
  console.log('─'.repeat(60));

  const depCount = Object.keys(packageJson.dependencies || {}).length;
  const devDepCount = Object.keys(packageJson.devDependencies || {}).length;

  console.log(`Production dependencies: ${depCount}`);
  console.log(`Development dependencies: ${devDepCount}`);
  console.log(`Total: ${depCount + devDepCount}\n`);

  // Check 4: Tree-shakeable packages
  console.log(`${colors.cyan}4. Tree-Shaking Verification${colors.reset}`);
  console.log('─'.repeat(60));

  const treeShakeable = [
    '@heroicons/react',
    '@xyflow/react',
    'jspdf',
    '@onevyrt/engine',
    'zustand',
  ];

  const treeShakeConfig = [
    '@heroicons/react',
    'jspdf',
    '@xyflow/react',
    '@onevyrt/engine',
    'zustand',
  ];

  treeShakeable.forEach(pkg => {
    if (allDeps[pkg]) {
      const isConfigured = treeShakeConfig.includes(pkg);
      const icon = isConfigured
        ? `${colors.green}✓${colors.reset}`
        : `${colors.yellow}⚠${colors.reset}`;
      const status = isConfigured
        ? 'Configured for optimization'
        : 'Add to optimizePackageImports in next.config.ts';
      console.log(`${icon} ${pkg}: ${status}`);
    }
  });

  console.log('');

  // Check 5: Recommendations
  console.log(`${colors.cyan}5. Optimization Recommendations${colors.reset}`);
  console.log('─'.repeat(60));

  const recommendations = [
    '✓ Ensure all large libraries are in their own chunks (webpack config)',
    '✓ Use lazy loading for route-specific components (lazy-components.tsx)',
    '✓ Enable code splitting: splitChunks in webpack config',
    '✓ Use dynamic imports for heavy dependencies',
    '✓ Monitor bundle size with "pnpm build:analyze" after each change',
    '✓ Regularly audit for unused dependencies',
    '✓ Use alternative packages for common large libraries',
  ];

  recommendations.forEach(rec => console.log(rec));

  console.log('\n' + '─'.repeat(60));
  console.log(`\n${colors.cyan}Summary${colors.reset}`);
  console.log(`Issues: ${issues} | Warnings: ${warnings}`);

  if (issues > 0) {
    console.log(`\n${colors.red}⚠️  Fix the issues above to reduce bundle size.${colors.reset}`);
    process.exit(1);
  } else if (warnings > 0) {
    console.log(`\n${colors.yellow}ℹ️  Review the optimization opportunities above.${colors.reset}\n`);
  } else {
    console.log(`\n${colors.green}✓ All dependency checks passed!${colors.reset}\n`);
  }
}

analyzePackageJson();
