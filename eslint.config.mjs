/**
 * Root ESLint Configuration
 *
 * This is a shared ESLint config that can be extended by workspaces.
 * The web app uses its own config at apps/web/eslint.config.mjs
 */

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

const noop = { meta: { schema: [] }, create: () => ({}) };

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "**/*.d.ts",
      "eslint.config.mjs",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    linterOptions: { reportUnusedDisableDirectives: "warn" },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // TypeScript
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
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
      "@typescript-eslint/no-floating-promises": "warn",

      // General best practices
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-console": [
        "warn",
        {
          allow: ["warn", "error", "info"],
        },
      ],
      "prefer-const": "warn",
      "no-var": "error",
      "no-control-regex": "off",
      "no-useless-escape": "warn",
      "no-useless-assignment": "warn",

      // Formatting & style
      "eqeqeq": ["warn", "always", { null: "ignore" }],
      "curly": ["warn", "multi-line"],
      "brace-style": ["warn", "1tbs", { allowSingleLine: true }],
      "semi": ["warn", "always"],
    },
  }
);
