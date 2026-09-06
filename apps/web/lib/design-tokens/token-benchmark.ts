/**
 * Token Benchmarking Utility
 *
 * Measures CSS variable access patterns, performance overhead, and optimization effectiveness.
 * Run in browser console or integrate into performance monitoring pipeline.
 *
 * USAGE:
 * import { TokenBenchmark } from '@/lib/design-tokens/token-benchmark'
 *
 * // Run a quick benchmark
 * const results = TokenBenchmark.quickBench()
 * console.log(results)
 *
 * // Or detailed multi-scenario analysis
 * const detailed = TokenBenchmark.detailedBench()
 * TokenBenchmark.exportMetrics(detailed)
 */

interface BenchmarkResult {
  tokenName: string;
  accessTimeMs: number;
  reads: number;
  totalTimeMs: number;
  avgTimePerRead: number;
}

interface BenchmarkSuite {
  timestamp: string;
  environmentInfo: {
    browser: string;
    os: string;
    cpu_throttle: string;
  };
  results: {
    cssVariableAccess: BenchmarkResult[];
    darkModeSwitch: { timeMs: number; repaints: number };
    tokenTreeShaking: { unusedTokens: string[]; potentialSavingsKb: number };
    overallMetrics: {
      avgAccessTimeMs: number;
      p95AccessTimeMs: number;
      p99AccessTimeMs: number;
    };
  };
}

export class TokenBenchmark {
  /**
   * Quick benchmark: measure access time for most-frequent tokens
   */
  static quickBench(): Partial<BenchmarkSuite> {
    const tokens = [
      "--text-primary",
      "--bg-surface",
      "--border-default",
      "--action-brand",
      "--text-secondary",
      "--status-success",
      "--chapter-define",
    ];

    const results: BenchmarkResult[] = [];

    for (const token of tokens) {
      const start = performance.now();
      this.getComputedToken(token);
      const end = performance.now();

      results.push({
        tokenName: token,
        accessTimeMs: end - start,
        reads: 1,
        totalTimeMs: end - start,
        avgTimePerRead: end - start,
      });
    }

    return {
      timestamp: new Date().toISOString(),
      environmentInfo: this.captureEnvironment(),
      results: {
        cssVariableAccess: results,
        darkModeSwitch: { timeMs: 0, repaints: 0 },
        tokenTreeShaking: {
          unusedTokens: [],
          potentialSavingsKb: 0,
        },
        overallMetrics: {
          avgAccessTimeMs:
            results.reduce((sum, r) => sum + r.accessTimeMs, 0) /
            results.length,
          p95AccessTimeMs: this.percentile(
            results.map((r) => r.accessTimeMs),
            95
          ),
          p99AccessTimeMs: this.percentile(
            results.map((r) => r.accessTimeMs),
            99
          ),
        },
      },
    };
  }

  /**
   * Detailed benchmark: comprehensive analysis including dark mode, tree-shaking
   */
  static detailedBench(): BenchmarkSuite {
    // Measure CSS variable access
    const cssResults = this.benchmarkCssVariableAccess();

    // Measure dark mode switch performance
    const darkModeTiming = this.benchmarkDarkModeSwitch();

    // Analyze token tree-shaking opportunities
    const treeShakingAnalysis = this.analyzeTreeShaking();

    const accessTimes = cssResults.map((r) => r.accessTimeMs);

    return {
      timestamp: new Date().toISOString(),
      environmentInfo: this.captureEnvironment(),
      results: {
        cssVariableAccess: cssResults,
        darkModeSwitch: darkModeTiming,
        tokenTreeShaking: treeShakingAnalysis,
        overallMetrics: {
          avgAccessTimeMs:
            accessTimes.reduce((a, b) => a + b, 0) / accessTimes.length,
          p95AccessTimeMs: this.percentile(accessTimes, 95),
          p99AccessTimeMs: this.percentile(accessTimes, 99),
        },
      },
    };
  }

  /**
   * Measure CSS variable access time across all defined tokens
   */
  private static benchmarkCssVariableAccess(): BenchmarkResult[] {
    const results: BenchmarkResult[] = [];

    // Sample tokens across all categories
    const tokenSamples = [
      // Palette (18)
      "--token-brand-500",
      "--token-neutral-500",
      "--token-blue-500",

      // Semantic (40)
      "--text-primary",
      "--bg-app",
      "--action-brand",
      "--border-default",
      "--status-success",
      "--chapter-define",

      // Spacing (10)
      "--space-4",

      // Radius (6)
      "--radius-md",

      // Animation (12) - from extended
      "--duration-base",
      "--ease-in-out",

      // Shadows (5) - from extended
      "--shadow-md",
    ];

    for (const token of tokenSamples) {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        this.getComputedToken(token);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      results.push({
        tokenName: token,
        accessTimeMs: totalTime / iterations,
        reads: iterations,
        totalTimeMs: totalTime,
        avgTimePerRead: totalTime / iterations,
      });
    }

    return results.sort((a, b) => b.accessTimeMs - a.accessTimeMs);
  }

  /**
   * Measure dark mode switch performance (DOM update + repaint)
   */
  private static benchmarkDarkModeSwitch(): {
    timeMs: number;
    repaints: number;
  } {
    const html = document.documentElement;

    // Observe repaints using requestAnimationFrame
    const framesBefore = performance.now();
    let frameCount = 0;

    const countFrames = () => {
      frameCount++;
      if (performance.now() - framesBefore < 1000) {
        requestAnimationFrame(countFrames);
      }
    };

    requestAnimationFrame(countFrames);

    const start = performance.now();

    // Toggle dark mode
    const isDark = html.getAttribute("data-theme") === "dark";
    html.setAttribute("data-theme", isDark ? "light" : "dark");

    // Force reflow to measure repaint time
    void html.offsetHeight;

    const end = performance.now();

    // Restore original state
    html.setAttribute("data-theme", isDark ? "dark" : "light");

    return {
      timeMs: end - start,
      repaints: frameCount,
    };
  }

  /**
   * Analyze which tokens might be tree-shaken based on usage
   */
  private static analyzeTreeShaking(): {
    unusedTokens: string[];
    potentialSavingsKb: number;
  } {
    const allTokenPatterns = [
      "--size-display-xl", // Rarely used
      "--size-display-lg", // Rarely used
      "--z-dropdown", // Rarely used
      "--z-popover", // Rarely used
      "--line-loose", // Rarely used
      "--line-tight", // Rarely used
    ];

    // Check CSS for which tokens are actually used in stylesheets
    const styleSheets = Array.from(document.styleSheets);
    const usedTokens = new Set<string>();

    try {
      for (const sheet of styleSheets) {
        try {
          const rules = sheet.cssRules;
          for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];
            if (rule instanceof CSSStyleRule) {
              const text = rule.cssText;
              for (const token of allTokenPatterns) {
                if (text.includes(token)) {
                  usedTokens.add(token);
                }
              }
            }
          }
        } catch (e) {
          // Cross-origin stylesheets may be blocked
        }
      }
    } catch (e) {
      console.warn("Could not analyze stylesheets:", e);
    }

    const unused = allTokenPatterns.filter((t) => !usedTokens.has(t));

    // Rough estimate: ~0.015KB per unused token on average
    const potentialSavingsKb = unused.length * 0.015;

    return {
      unusedTokens: unused,
      potentialSavingsKb: Math.round(potentialSavingsKb * 100) / 100,
    };
  }

  /**
   * Capture environment information for benchmark context
   */
  private static captureEnvironment(): BenchmarkSuite["environmentInfo"] {
    const ua = navigator.userAgent;
    const browser = ua.includes("Chrome")
      ? "Chrome"
      : ua.includes("Firefox")
        ? "Firefox"
        : ua.includes("Safari")
          ? "Safari"
          : "Unknown";

    const os = ua.includes("Mac")
      ? "macOS"
      : ua.includes("Windows")
        ? "Windows"
        : ua.includes("Linux")
          ? "Linux"
          : "Unknown";

    // Try to detect CPU throttling via DevTools
    const cpu_throttle = this.detectCPUThrottle();

    return { browser, os, cpu_throttle };
  }

  /**
   * Detect if Chrome DevTools CPU throttling is active
   */
  private static detectCPUThrottle(): string {
    // Heuristic: measure loop speed and compare
    const start = performance.now();
    let iterations = 0;
    while (performance.now() - start < 10) {
      iterations++;
    }

    // If < 100M iterations/10ms, likely throttled
    return iterations < 1000000 ? "likely-active" : "not-detected";
  }

  /**
   * Get computed CSS variable value
   */
  private static getComputedToken(varName: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(varName);
  }

  /**
   * Calculate percentile of array
   */
  private static percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[index]!;
  }

  /**
   * Export metrics to JSON for external analysis
   */
  static exportMetrics(suite: BenchmarkSuite): string {
    return JSON.stringify(suite, null, 2);
  }

  /**
   * Log results in human-readable format
   */
  static logResults(suite: BenchmarkSuite): void {
    console.group("Token Benchmark Results");
    console.log("Timestamp:", suite.timestamp);
    console.log("Environment:", suite.environmentInfo);

    console.group("Token Access Times");
    for (const result of suite.results.cssVariableAccess) {
      console.log(
        `${result.tokenName}: ${result.accessTimeMs.toFixed(4)}ms (${result.reads} reads)`
      );
    }
    console.groupEnd();

    console.group("Overall Metrics");
    console.log(
      "Avg Access Time:",
      suite.results.overallMetrics.avgAccessTimeMs.toFixed(4),
      "ms"
    );
    console.log(
      "p95 Access Time:",
      suite.results.overallMetrics.p95AccessTimeMs.toFixed(4),
      "ms"
    );
    console.log(
      "p99 Access Time:",
      suite.results.overallMetrics.p99AccessTimeMs.toFixed(4),
      "ms"
    );
    console.groupEnd();

    console.group("Dark Mode Switch");
    console.log("Switch Time:", suite.results.darkModeSwitch.timeMs.toFixed(2), "ms");
    console.log("Repaints:", suite.results.darkModeSwitch.repaints);
    console.groupEnd();

    console.group("Tree Shaking Opportunities");
    console.log(
      "Unused Tokens:",
      suite.results.tokenTreeShaking.unusedTokens.length
    );
    if (suite.results.tokenTreeShaking.unusedTokens.length > 0) {
      console.log(
        suite.results.tokenTreeShaking.unusedTokens.join(", ")
      );
    }
    console.log(
      "Potential Savings:",
      suite.results.tokenTreeShaking.potentialSavingsKb,
      "KB"
    );
    console.groupEnd();

    console.groupEnd();
  }
}
