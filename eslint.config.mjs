import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "**/*.config.{js,cjs,mjs,ts}",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      // Domain/application code intentionally uses `unknown`/error-narrowing
      // patterns (§37) rather than `any` - the recommended preset already
      // flags real `any` usage, this just avoids over-strict unused-arg
      // noise on interface implementations.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Phase 8 accessibility audit: added eslint-plugin-jsx-a11y's
    // recommended rules - this codebase's own accessibility findings
    // this phase (a failing contrast ratio) weren't something linting
    // could have caught, but a missing alt text, an interactive div, or
    // a form input without a label are exactly what this catches
    // automatically as real JSX gets built in later phases, rather than
    // relying on someone remembering to check by hand each time.
    //
    // Also fixes a real pre-existing bug found while verifying this
    // block actually applies at all: "**/*.{tsx}" is a single-item
    // brace group, which several glob matchers (including this
    // project's) do not expand into an alternation - it only matches a
    // file literally ending in the four characters ".{tsx}", which no
    // real file does. That meant this entire block - react's and
    // react-hooks' recommended rules included, not just the new
    // jsx-a11y rules - was silently never applying to any .tsx file.
    // Confirmed by adding a deliberate react/jsx-key violation and a
    // missing-alt <img>, running lint, seeing neither one flagged with
    // the old glob, and both correctly flagged with this one.
    files: ["**/*.tsx"],
    plugins: { react, "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      "react/react-in-jsx-scope": "off", // Next.js's automatic JSX runtime
      "react/prop-types": "off", // TypeScript covers this
    },
    settings: { react: { version: "18.3" } },
  },
);
