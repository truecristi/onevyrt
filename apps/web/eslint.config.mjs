import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

/**
 * ESLint Configuration for ONEVYRT Web App
 *
 * Flat config (ESLint 10). Deliberately pragmatic: correctness-oriented rules
 * stay as errors, but rules that would demand a mass rewrite of this codebase's
 * intentional patterns (typed-boundary `any`, empty catches) are relaxed — so
 * `pnpm lint` is useful, not a wall of noise. Type-aware linting is off (no
 * parserOptions.project) to keep it fast; `pnpm typecheck` covers types.
 *
 * Rules Configuration:
 * - Error: Hard violations (hooks rules, undefined variables)
 * - Warn: Code quality issues (unused vars, missing types, console logs)
 * - Off: Intentional patterns in codebase (any, empty catches)
 *
 * The `@next/next` and `react` no-op plugins exist only so the codebase's
 * existing `eslint-disable @next/next/no-img-element` / `react/no-unknown-property`
 * comments resolve without pulling in the full Next/React eslint plugins.
 *
 * `react-hooks` IS pulled in for real: `rules-of-hooks` is a hard
 * error (a conditionally-called hook is always a bug), and `exhaustive-deps`
 * is a warning — the codebase has a handful of deliberate
 * `eslint-disable-next-line react-hooks/exhaustive-deps` sites that only resolve
 * once the rule is actually defined.
 *
 * See docs/CODE_STYLE_GUIDE.md for coding standards that complement these rules.
 */
const noop = { meta: { schema: [] }, create: () => ({}) };

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "**/*.d.ts",
      "eslint.config.mjs",
      "dist/**",
      "coverage/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    linterOptions: { reportUnusedDisableDirectives: "warn" },
    plugins: {
      "@next/next": { rules: { "no-img-element": noop } },
      react: { rules: { "no-unknown-property": noop } },
      "react-hooks": reactHooks,
    },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      // ========================================================================
      // TypeScript Rules
      // ========================================================================
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
      "@typescript-eslint/explicit-function-return-types": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      // no-floating-promises requires type-aware linting (a typed `services`
      // object from parserOptions.project), which this config deliberately
      // doesn't set up (see the file header). Enabling it without that setup
      // doesn't just no-op — it throws and aborts the entire lint run on the
      // first file it's checked against. Left off rather than wiring up
      // typed linting, which would slow down every run just for this rule.

      // ========================================================================
      // JavaScript & General Best Practices
      // ========================================================================
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-console": [
        "warn",
        {
          allow: ["warn", "error", "info"],
        },
      ],
      "no-debugger": "warn",
      "no-alert": "warn",
      "prefer-const": "warn",
      "no-var": "error",
      "no-control-regex": "off",
      "no-useless-escape": "warn",
      "no-useless-assignment": "warn",
      "preserve-caught-error": "off",
      "eqeqeq": ["warn", "always", { null: "ignore" }],

      // ========================================================================
      // React & Hooks Rules
      // ========================================================================
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // ========================================================================
      // Code Style & Formatting
      // ========================================================================
      "curly": ["warn", "multi-line"],
      "brace-style": ["warn", "1tbs", { allowSingleLine: true }],
      "semi": ["warn", "always"],
      "quotes": [
        "warn",
        "single",
        {
          avoidEscape: true,
          allowTemplateLiterals: true,
        },
      ],
      "comma-dangle": [
        "warn",
        {
          arrays: "always-multiline",
          objects: "always-multiline",
          imports: "always-multiline",
          exports: "always-multiline",
          functions: "never",
        },
      ],
      "no-trailing-spaces": "warn",
      "keyword-spacing": "warn",
      "space-before-function-paren": [
        "warn",
        {
          anonymous: "always",
          named: "never",
          asyncArrow: "always",
        },
      ],
    },
  }
);
