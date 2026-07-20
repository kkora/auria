// ESLint flat config. Goal: catch real mistakes (undefined vars, unreachable code,
// bad regex) without fighting the codebase's intentional terse, comment-the-why style.
// Node + browser globals are both enabled because analyze/report modules embed
// in-browser code inside `page.evaluate(() => { document... })` alongside Node code.
import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/**", "a11y-audits/**", "audits/**", "docs/_source-monolith.mjs.txt"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser, // document, window, getComputedStyle, matchMedia, etc. (in page.evaluate)
        axe: "readonly",     // axe-core global injected via addScriptTag
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-empty": ["error", { allowEmptyCatch: true }], // `try {...} catch {}` best-effort is deliberate
      "no-constant-condition": ["error", { checkLoops: false }],
    },
  },
];
