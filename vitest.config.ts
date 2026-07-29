import { defineConfig } from "vitest/config";

/*
 * Vitest config for the TypeScript unit suites under src/.
 *
 * The CV suites (cv-state, cv-render, cv-archive-match, cv-claude-fallback,
 * cvData, cvShell) were written against the vitest API but the dependency
 * was never installed, so none of them had ever executed. This config is
 * what makes `npm run test:unit` actually run them.
 *
 * environment: "jsdom" because src/lib/cv-state.test.ts exercises the
 * theme/attribute helpers against a real `document.createElement("html")`.
 * The rest of the suites are pure and run fine under jsdom too, so one
 * environment covers everything rather than per-file docblock overrides.
 *
 * include is scoped to src/ on purpose: scripts/sync-resume.test.mjs is a
 * node:test suite and stays on its own runner via `npm run test:sync`.
 *
 * The two excluded files are not specs. They predate any runner and export
 * plain assertion functions instead of describe/it blocks, so loading them
 * as entry points fails with "No test suite found". They are executed via
 * src/cv-runner-bridge.test.ts, which imports and invokes them. Remove an
 * exclusion here if its file is ever converted to native describe/it.
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "src/data/cvData.test.ts",
      "src/components/cv/cvShell.test.ts",
    ],
  },
});
