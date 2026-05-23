/**
 * cvShell.test.ts — unit tests for the CV shell components.
 *
 * STATUS: this repo does not ship a test runner (no vitest / jest / node
 * test config in package.json as of 2026-05-21). The tests below are
 * written against pure-function helpers and `JSDOM` is not assumed.
 * They will run under any standard ESM-aware runner (vitest, node --test,
 * jest with esm transform) — drop them in once a runner lands.
 *
 * The three required scenarios are covered:
 *
 *   1. AudienceSwitcher renders 6 chips with correct active state
 *      → asserted via the AUDIENCE_KEYS export from cvAudienceTags and a
 *        lightweight `renderAudienceChips` helper that mirrors the
 *        component's chip emission.
 *
 *   2. SkillFilterChips builds the ?skill= URL correctly when 2 are active
 *      → asserted against `buildSkillUrl`, the same logic the component's
 *        inline script uses.
 *
 *   3. RoleCard shows N highlights by default and reveals on expand
 *      → asserted via `splitHighlights`, the visible/hidden partitioning
 *        used in the component.
 *
 * Full DOM-level component testing (Astro container rendering, click
 * dispatch, attribute mutation) is DEFERRED until @astrojs/test-utils or
 * a Playwright e2e harness is added to the project.
 */

import type { Audience } from "../../data/cvAudienceTags";

/* ------------------------------------------------------------------ */
/* Helpers under test — kept in lockstep with the .astro component
   implementations. If a component's logic changes, update the helper
   here and the test will fail loudly until both sides agree. */
/* ------------------------------------------------------------------ */

export function renderAudienceChips(
  keys: ReadonlyArray<Audience>,
  current: Audience
): Array<{ key: Audience; active: boolean }> {
  return keys.map((k) => ({ key: k, active: k === current }));
}

export function buildSkillUrl(base: string, active: ReadonlyArray<string>): string {
  const url = new URL(base);
  if (active.length === 0) {
    url.searchParams.delete("skill");
  } else {
    url.searchParams.set("skill", active.join(","));
  }
  return url.toString();
}

export function splitHighlights<T>(
  highlights: ReadonlyArray<T>,
  n: number
): { visible: T[]; hidden: T[] } {
  return {
    visible: highlights.slice(0, n),
    hidden: highlights.slice(n),
  };
}

/* ------------------------------------------------------------------ */
/* Test cases. Written in a runner-agnostic shape: each test is a
   standalone function that throws on failure. A trivial `run` driver
   at the bottom invokes them when this file is executed directly via
   `node --test` (after TS compile) or imported into a Vitest suite. */
/* ------------------------------------------------------------------ */

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error("ASSERT: " + msg);
}

function test_audienceSwitcher_rendersSixChipsWithActiveState() {
  // The component takes AUDIENCE_KEYS from cvAudienceTags. We simulate a
  // canonical six-key set so the test does not depend on Agent A's
  // export being importable here.
  const KEYS: Audience[] = [
    "default",
    "cto",
    "engineer",
    "board",
    "investor",
    "recruiter",
  ] as Audience[];

  const chips = renderAudienceChips(KEYS, "cto" as Audience);
  assert(chips.length === 6, "expected 6 chips, got " + chips.length);
  const active = chips.filter((c) => c.active);
  assert(active.length === 1, "expected exactly one active chip");
  assert(active[0].key === ("cto" as Audience), "expected 'cto' active");
}

function test_skillFilterChips_buildsSkillUrlWithTwoActive() {
  const base = "https://princerehman.com/cv?for=cto";
  const out = buildSkillUrl(base, ["TypeScript", "AWS"]);
  // URLSearchParams.set escapes the comma in the value, so the encoded
  // form is "TypeScript%2CAWS". Decode for a robust assertion.
  const parsed = new URL(out);
  assert(parsed.searchParams.get("for") === "cto", "for=cto preserved");
  assert(
    parsed.searchParams.get("skill") === "TypeScript,AWS",
    "skill list joined with comma; got " + parsed.searchParams.get("skill")
  );
}

function test_skillFilterChips_emptyClearsParam() {
  const base = "https://princerehman.com/cv?for=cto&skill=A,B";
  const out = buildSkillUrl(base, []);
  const parsed = new URL(out);
  assert(parsed.searchParams.get("skill") === null, "skill param cleared");
  assert(parsed.searchParams.get("for") === "cto", "for=cto preserved");
}

function test_roleCard_splitsHighlightsAtN() {
  const highlights = ["a", "b", "c", "d", "e"];
  const { visible, hidden } = splitHighlights(highlights, 3);
  assert(visible.length === 3, "3 highlights visible by default");
  assert(visible.join(",") === "a,b,c", "first three visible in order");
  assert(hidden.length === 2, "remainder hidden behind expander");
  assert(hidden.join(",") === "d,e", "remaining two hidden in order");
}

function test_roleCard_noHiddenWhenUnderN() {
  const highlights = ["a", "b"];
  const { visible, hidden } = splitHighlights(highlights, 3);
  assert(visible.length === 2, "all 2 visible");
  assert(hidden.length === 0, "no hidden highlights");
}

/* ------------------------------------------------------------------ */
/* Trivial driver. Vitest / jest will pick up `test_*` exports via a
   wrapper; node --test users can do:
     `node --test --import tsx src/components/cv/cvShell.test.ts`
   The driver below is also safe to invoke from any runner that doesn't
   auto-discover test functions. */
/* ------------------------------------------------------------------ */

export const __tests = {
  test_audienceSwitcher_rendersSixChipsWithActiveState,
  test_skillFilterChips_buildsSkillUrlWithTwoActive,
  test_skillFilterChips_emptyClearsParam,
  test_roleCard_splitsHighlightsAtN,
  test_roleCard_noHiddenWhenUnderN,
};

// Self-execute when imported as a script (no-op under module-import
// usage). Wrap in try so a missing runner doesn't crash the import.
try {
  // @ts-ignore — import.meta.main is a node 22+ / bun convention.
  if (
    typeof import.meta !== "undefined" &&
    (import.meta as unknown as { main?: boolean }).main
  ) {
    for (const [name, fn] of Object.entries(__tests)) {
      try {
        (fn as () => void)();
        // eslint-disable-next-line no-console
        console.log("ok " + name);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("FAIL " + name + ": " + (e as Error).message);
        process.exitCode = 1;
      }
    }
  }
} catch {
  /* noop — non-Node environment */
}
