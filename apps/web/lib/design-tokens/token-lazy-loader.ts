/**
 * Design Token Lazy Loader
 *
 * Intelligently lazy-loads extended token categories (animations, shadows, typography)
 * to reduce critical path CSS and improve page load performance.
 *
 * USAGE:
 * import { TokenLazyLoader } from '@/lib/design-tokens/token-lazy-loader'
 *
 * // Auto-detect when to load
 * TokenLazyLoader.autoDetect()
 *
 * // Or manually trigger
 * TokenLazyLoader.loadCategory('animations')
 * TokenLazyLoader.loadCategory('shadows')
 *
 * // Pre-load for known heavy pages
 * TokenLazyLoader.preloadForContext('coaching-dashboard')
 */

interface LoadedCategory {
  name: string;
  loadedAt: number;
  sizeKb: number;
  isLoaded: boolean;
}

type TokenCategory =
  | "animations"
  | "shadows"
  | "typography"
  | "components"
  | "zindex"
  | "utility";

interface LazyLoadConfig {
  enableAutoDetect: boolean;
  autoDetectDelay: number;
  preloadOnContexts: Set<string>;
}

/**
 * Manages lazy loading of extended design token categories
 */
export class TokenLazyLoader {
  private static config: LazyLoadConfig = {
    enableAutoDetect: true,
    autoDetectDelay: 100, // ms after first interaction
    preloadOnContexts: new Set([
      "coaching-dashboard",
      "programme-builder",
      "modal-heavy",
    ]),
  };

  private static loadedCategories = new Map<TokenCategory, LoadedCategory>();

  private static categoryInfo: Record<TokenCategory, { file: string; sizeKb: number }> = {
    animations: {
      file: "/app/design-tokens-extended.css",
      sizeKb: 0.5,
    },
    shadows: {
      file: "/app/design-tokens-extended.css",
      sizeKb: 0.8,
    },
    typography: {
      file: "/app/design-tokens-extended.css",
      sizeKb: 0.4,
    },
    components: {
      file: "/app/design-tokens-extended.css",
      sizeKb: 0.3,
    },
    zindex: {
      file: "/app/design-tokens-extended.css",
      sizeKb: 0.15,
    },
    utility: {
      file: "/app/design-tokens-extended.css",
      sizeKb: 0.2,
    },
  };

  /**
   * Initialize lazy loader and set up auto-detection
   */
  static init(config?: Partial<LazyLoadConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    if (this.config.enableAutoDetect) {
      this.setupAutoDetection();
    }
  }

  /**
   * Load a specific token category
   */
  static loadCategory(category: TokenCategory): void {
    if (this.loadedCategories.has(category)) {
      return; // Already loaded
    }

    const categoryData = this.categoryInfo[category];
    if (!categoryData) {
      console.warn(`Unknown token category: ${category}`);
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = categoryData.file;
    link.dataset.tokenCategory = category;

    link.onload = () => {
      this.loadedCategories.set(category, {
        name: category,
        loadedAt: performance.now(),
        sizeKb: categoryData.sizeKb,
        isLoaded: true,
      });

      if (process.env.NODE_ENV === "development") {
        console.log(
          `[TokenLoader] Loaded category: ${category} (+${categoryData.sizeKb}KB)`
        );
      }
    };

    link.onerror = () => {
      console.warn(`Failed to load token category: ${category}`);
    };

    document.head.appendChild(link);
  }

  /**
   * Pre-load all categories for known heavy contexts
   */
  static preloadForContext(context: string): void {
    if (!this.config.preloadOnContexts.has(context)) {
      return;
    }

    const categories: TokenCategory[] = [
      "animations",
      "shadows",
      "typography",
      "components",
      "zindex",
      "utility",
    ];

    for (const category of categories) {
      this.loadCategory(category);
    }
  }

  /**
   * Set up MutationObserver and interaction listeners for auto-detection
   */
  private static setupAutoDetection(): void {
    // Detect animation usage
    const detectAnimations = () => {
      const elements = document.querySelectorAll("[style*='animation']");
      if (elements.length > 0) {
        this.loadCategory("animations");
        document.removeEventListener("click", detectAnimations);
      }
    };

    // Detect shadow usage
    const detectShadows = () => {
      const elements = document.querySelectorAll("[style*='box-shadow']");
      if (elements.length > 0) {
        this.loadCategory("shadows");
      }
    };

    // Detect modal/dropdown usage (implies zindex)
    const detectModals = () => {
      if (
        document.querySelector("[role='dialog']") ||
        document.querySelector("[role='menuitem']")
      ) {
        this.loadCategory("zindex");
      }
    };

    // Set up observers
    setTimeout(() => {
      document.addEventListener("click", detectAnimations, { once: true });
      detectShadows();
      detectModals();
    }, this.config.autoDetectDelay);

    // Also detect via MutationObserver for dynamically added elements
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          // Check for modals, dropdowns, etc.
          for (const node of mutation.addedNodes) {
            if (node instanceof Element) {
              if (
                node.getAttribute("role") === "dialog" ||
                node.hasAttribute("data-modal")
              ) {
                this.loadCategory("zindex");
              }
              if (node.hasAttribute("data-tooltip")) {
                this.loadCategory("zindex");
              }
            }
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Check if a category is currently loaded
   */
  static isLoaded(category: TokenCategory): boolean {
    const loaded = this.loadedCategories.get(category);
    return loaded?.isLoaded ?? false;
  }

  /**
   * Get info about loaded categories
   */
  static getLoadedInfo(): LoadedCategory[] {
    return Array.from(this.loadedCategories.values());
  }

  /**
   * Calculate total size of loaded categories
   */
  static getTotalLoadedSize(): number {
    return Array.from(this.loadedCategories.values()).reduce(
      (sum, cat) => sum + cat.sizeKb,
      0
    );
  }

  /**
   * Force load all categories (for testing or guaranteed availability)
   */
  static preloadAll(): void {
    const categories: TokenCategory[] = [
      "animations",
      "shadows",
      "typography",
      "components",
      "zindex",
      "utility",
    ];

    for (const category of categories) {
      this.loadCategory(category);
    }
  }

  /**
   * Generate a report of loading performance
   */
  static generateLoadingReport(): string {
    const loaded = this.getLoadedInfo();
    const totalSize = this.getTotalLoadedSize();

    let report = "Token Category Loading Report\n";
    report += "==============================\n\n";

    for (const category of loaded) {
      const loadTime = category.loadedAt;
      report += `${category.name}:\n`;
      report += `  - Loaded at: ${loadTime.toFixed(2)}ms\n`;
      report += `  - Size: ${category.sizeKb}KB\n`;
    }

    report += `\nTotal Loaded: ${totalSize}KB\n`;
    report += `Categories: ${loaded.length}\n`;

    return report;
  }

  /**
   * Log loading report to console
   */
  static logReport(): void {
    console.log(this.generateLoadingReport());
  }
}

// Auto-initialize on module load (in browser)
if (typeof window !== "undefined") {
  // Wait for DOM to be interactive before initializing
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      TokenLazyLoader.init();
    });
  } else {
    TokenLazyLoader.init();
  }
}
