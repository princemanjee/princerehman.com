/**
 * cv-runner-bridge.test.ts
 *
 * Adapter that lets vitest execute the two hand-rolled CV suites.
 *
 * `src/data/cvData.test.ts` and `src/components/cv/cvShell.test.ts` were
 * written before a test runner existed in this repo, so instead of
 * `describe`/`it` blocks they export plain assertion functions that throw
 * on failure. cvData.test.ts documents the two sanctioned ways to wire
 * them up; this file is the second one ("import the runner from a small
 * wrapper and assert it doesn't throw"), chosen so neither original file
 * has to be restructured.
 *
 * Both files are excluded from vitest's `include` glob in vitest.config.ts
 * (they are runner modules, not specs, so loading them directly yields
 * "No test suite found"). They are reached only through this bridge.
 *
 * When either file is eventually converted to native describe/it blocks,
 * drop its entry here and its exclusion from the config.
 */

import { describe, it, expect } from "vitest";

import { runCvDataTests } from "./data/cvData.test";
import { __tests as cvShellTests } from "./components/cv/cvShell.test";

/*
 * cvData aggregates internally: runCvDataTests() collects every failure and
 * throws one combined error listing them, so it maps to a single it() whose
 * failure message already names each broken assertion.
 */
describe("cvData suite (bridged)", () => {
  it("passes every data-layer assertion", () => {
    expect(() => runCvDataTests()).not.toThrow();
  });
});

/*
 * cvShell exposes its assertions individually via the `__tests` map, so each
 * one becomes its own it() and reports separately.
 */
describe("cvShell suite (bridged)", () => {
  for (const [name, fn] of Object.entries(cvShellTests)) {
    it(name, () => {
      expect(() => (fn as () => void)()).not.toThrow();
    });
  }
});
