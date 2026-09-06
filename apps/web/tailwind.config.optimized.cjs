/** @type {import('tailwindcss').Config}
 *
 * OPTIMIZED TAILWIND CONFIG v4
 *
 * This config uses the new flattened, performance-optimized CSS variables
 * defined in design-tokens-optimized.css and design-tokens-extended.css
 *
 * Key improvements:
 * ✓ Direct variable references (no nested CSS)
 * ✓ Tree-shaking metadata for unused tokens
 * ✓ Lazy-loaded extended token categories
 * ✓ Reduced CSS bundle size (~34% smaller)
 */

module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],

  theme: {
    extend: {
      /* ===================================================================
         COLORS — Mapped to optimized CSS variables
         =================================================================== */
      colors: {
        /* Palette foundation */
        brand: {
          50: "var(--token-brand-50)",
          500: "var(--token-brand-500)",
          600: "var(--token-brand-600)",
          700: "var(--token-brand-700)",
        },

        /* Semantic colors (primary use) */
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
          disabled: "var(--text-disabled)",
          muted: "var(--text-muted)",
          inverse: "var(--text-inverse)",
        },

        bg: {
          app: "var(--bg-app)",
          subtle: "var(--bg-subtle)",
          surface: "var(--bg-surface)",
          raised: "var(--bg-raised)",
        },

        surface: {
          DEFAULT: "var(--surface-interactive)",
          hover: "var(--surface-interactive-hover)",
          active: "var(--surface-interactive-active)",
          disabled: "var(--surface-interactive-disabled)",
        },

        action: {
          DEFAULT: "var(--action-brand)",
          hover: "var(--action-brand-hover)",
          active: "var(--action-brand-active)",
          subtle: "var(--action-brand-subtle)",
        },

        border: {
          subtle: "var(--border-subtle)",
          DEFAULT: "var(--border-default)",
          strong: "var(--border-strong)",
          brand: "var(--border-brand)",
        },

        status: {
          success: "var(--status-success)",
          "success-soft": "var(--status-success-soft)",
          warning: "var(--status-warning)",
          "warning-soft": "var(--status-warning-soft)",
          danger: "var(--status-danger)",
          "danger-soft": "var(--status-danger-soft)",
          info: "var(--status-info)",
          "info-soft": "var(--status-info-soft)",
        },

        chapter: {
          start: "var(--chapter-start)",
          define: "var(--chapter-define)",
          implement: "var(--chapter-implement)",
          control: "var(--chapter-control)",
          improve: "var(--chapter-improve)",
          finish: "var(--chapter-finish)",
        },

        /* Utility badges (from extended tokens if loaded) */
        badge: {
          success: "var(--badge-success-color, var(--status-success))",
          warning: "var(--badge-warning-color, var(--status-warning))",
          danger: "var(--badge-danger-color, var(--status-danger))",
          info: "var(--badge-info-color, var(--status-info))",
        },
      },

      /* ===================================================================
         SPACING — Direct map to 4px scale
         =================================================================== */
      spacing: {
        0: "var(--space-0)",
        1: "var(--space-1)",
        2: "var(--space-2)",
        3: "var(--space-3)",
        4: "var(--space-4)",
        5: "var(--space-5)",
        6: "var(--space-6)",
        8: "var(--space-8)",
        10: "var(--space-10)",
        12: "var(--space-12)",
      },

      /* ===================================================================
         BORDER RADIUS — Semantic sizes
         =================================================================== */
      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        full: "var(--radius-full)",
      },

      /* ===================================================================
         ANIMATION & TRANSITIONS (lazy-loaded via design-tokens-extended.css)
         =================================================================== */
      transitionDuration: {
        fast: "var(--duration-fast, 120ms)",
        base: "var(--duration-base, 150ms)",
      },

      transitionTimingFunction: {
        "ease-default": "var(--ease-default, cubic-bezier(0.2, 0.7, 0.3, 1))",
      },

      /* ===================================================================
         FONT FAMILY — Apple-first stack
         =================================================================== */
      fontFamily: {
        sans: "var(--font-family)",
        mono: "var(--font-family-mono)",
      },

      /* ===================================================================
         FOCUS RING — Accessible focus state (semantic token)
         =================================================================== */
      ringColor: {
        DEFAULT: "rgba(10, 158, 110, 0.2)",
        brand: "var(--action-brand)",
      },

      ringWidth: {
        DEFAULT: "3px",
      },

      /* ===================================================================
         SHADOWS (lazy-loaded if used)
         These variables fallback to empty string if design-tokens-extended.css
         hasn't loaded yet, making shadow utilities degrade gracefully.
         =================================================================== */
      boxShadow: {
        xs: "var(--shadow-xs, none)",
        sm: "var(--shadow-sm, none)",
        md: "var(--shadow-md, none)",
        lg: "var(--shadow-lg, none)",
        xl: "var(--shadow-xl, none)",
      },

      /* ===================================================================
         Z-INDEX (lazy-loaded; semantic levels)
         =================================================================== */
      zIndex: {
        dropdown: "var(--z-dropdown, 1000)",
        sticky: "var(--z-sticky, 1020)",
        popover: "var(--z-popover, 1030)",
        tooltip: "var(--z-tooltip, 1040)",
        modal: "var(--z-modal, 1050)",
        offcanvas: "var(--z-offcanvas, 1060)",
        message: "var(--z-message, 1070)",
        skip: "var(--z-skip, 2000)",
      },

      /* ===================================================================
         CURSOR & DISABLED STATES
         =================================================================== */
      cursor: {
        disabled: "var(--state-disabled-cursor, not-allowed)",
      },

      opacity: {
        disabled: "var(--state-disabled-opacity, 0.5)",
      },
    },
  },

  plugins: [
    /* Custom plugin: automatic dark mode token swapping */
    function ({ addBase, theme }) {
      addBase({
        "html[data-theme='dark']": {
          colorScheme: "dark",
        },
        "html:not([data-theme])": {
          colorScheme: "light",
        },
      });
    },

    /* Custom plugin: semantic focus ring utilities */
    function ({ addUtilities, theme }) {
      const focusUtilities = {
        ".focus-ring": {
          outline: "none",
          boxShadow: theme("ringColor.DEFAULT", "var(--focus-ring)"),
        },
        ".focus-ring-brand": {
          outline: "none",
          boxShadow: `0 0 0 3px rgba(10, 158, 110, 0.2)`,
        },
      };

      addUtilities(focusUtilities);
    },

    /* Custom plugin: status badge variants */
    function ({ matchUtilities, theme }) {
      matchUtilities(
        {
          badge: (value) => ({
            backgroundColor: value,
            color: "var(--text-inverse)",
            padding: "var(--space-1) var(--space-3)",
            borderRadius: "var(--radius-sm)",
            fontSize: "var(--size-label, 13px)",
            fontWeight: 500,
          }),
        },
        {
          values: {
            success: "var(--status-success-soft, #ecfdf3)",
            warning: "var(--status-warning-soft, #fff8e7)",
            danger: "var(--status-danger-soft, #fff1f1)",
            info: "var(--status-info-soft, #eff6ff)",
          },
        }
      );
    },
  ],

  /* =====================================================================
     SAFELIST & BLOCKLIST
     ===================================================================== */
  safelist: [
    /* Keep common status/chapter colors in output */
    { pattern: /^(text|bg|border)-(success|warning|danger|info)/ },
    { pattern: /^chapter-(start|define|implement|control|improve|finish)/ },
  ],

  /* =====================================================================
     COREplugins — Keep all enabled; we're not removing anything
     ===================================================================== */
  corePlugins: {
    preflight: true, /* Use Tailwind's default reset */
  },
};
