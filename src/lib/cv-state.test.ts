/**
 * Unit tests for the cv-state client-side state machine.
 *
 * No test runner is configured in this repo (no jest/vitest installed).
 * Tests follow the same pattern as cv-render.test.ts: written for
 * vitest's describe/it/expect API, will be picked up automatically once
 * a runner is wired in. The DOM-touching helpers are exercised via the
 * pure parser/serializer entrypoints so node can run these without
 * jsdom.
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_STATE,
  stateFromSearchParams,
  searchParamsFromState,
  isDefaultState,
  type CvState,
} from "./cv-state";

describe("cv-state pure helpers", () => {
  it("DEFAULT_STATE has neutral values", () => {
    expect(DEFAULT_STATE.audience).toBe("default");
    expect(DEFAULT_STATE.skills).toEqual([]);
    expect(DEFAULT_STATE.since).toBeNull();
    expect(DEFAULT_STATE.hide).toEqual([]);
  });

  it("isDefaultState recognises the baseline", () => {
    expect(isDefaultState({ ...DEFAULT_STATE })).toBe(true);
    expect(
      isDefaultState({ audience: "cto", skills: [], since: null, hide: [] }),
    ).toBe(false);
    expect(
      isDefaultState({
        audience: "default",
        skills: ["microsoft-365"],
        since: null,
        hide: [],
      }),
    ).toBe(false);
  });

  it("stateFromSearchParams parses every owned key", () => {
    const params = new URLSearchParams(
      "for=cto&skill=microsoft-365,sharepoint&since=2019&hide=awards,publications",
    );
    const s = stateFromSearchParams(params);
    expect(s.audience).toBe("cto");
    expect(s.skills).toEqual(["microsoft-365", "sharepoint"]);
    expect(s.since).toBe(2019);
    expect(s.hide).toEqual(["awards", "publications"]);
  });

  it("stateFromSearchParams falls back to default when keys absent", () => {
    const s = stateFromSearchParams(new URLSearchParams(""));
    expect(s).toEqual(DEFAULT_STATE);
  });

  it("stateFromSearchParams dedupes and trims list values", () => {
    const params = new URLSearchParams(
      "skill=microsoft-365, sharepoint ,microsoft-365",
    );
    const s = stateFromSearchParams(params);
    expect(s.skills).toEqual(["microsoft-365", "sharepoint"]);
  });

  it("searchParamsFromState omits default-valued fields", () => {
    const params = searchParamsFromState({ ...DEFAULT_STATE });
    expect(params.toString()).toBe("");
  });

  it("searchParamsFromState emits only non-default fields", () => {
    const params = searchParamsFromState({
      audience: "engineer",
      skills: ["sharepoint"],
      since: null,
      hide: [],
    });
    expect(params.get("for")).toBe("engineer");
    expect(params.get("skill")).toBe("sharepoint");
    expect(params.get("since")).toBeNull();
    expect(params.get("hide")).toBeNull();
  });

  it("URL → state → URL round-trip is idempotent", () => {
    const initial = new URLSearchParams(
      "for=cto&skill=microsoft-365,sharepoint&since=2019&hide=awards",
    );
    const s = stateFromSearchParams(initial);
    const back = searchParamsFromState(s);
    // Param set must match exactly (order-agnostic compare).
    expect(new Set(back.keys())).toEqual(new Set(initial.keys()));
    for (const k of initial.keys()) {
      expect(back.get(k)).toBe(initial.get(k));
    }
  });

  it("invalid since values become null", () => {
    const s = stateFromSearchParams(new URLSearchParams("since=not-a-number"));
    expect(s.since).toBeNull();
  });
});

describe("cv-state DOM helpers (smoke under jsdom only)", () => {
  // These tests are gated on a DOM being available; run them under
  // happy-dom / jsdom-equipped runners only.
  const hasDom =
    typeof document !== "undefined" && typeof window !== "undefined";

  it.skipIf?.(!hasDom)(
    "applyStateToRoot writes data-attributes",
    async () => {
      const { applyStateToRoot } = await import("./cv-state");
      const el = document.createElement("html") as HTMLElement;
      const next: CvState = {
        audience: "cto",
        skills: ["microsoft-365", "sharepoint"],
        since: 2019,
        hide: ["awards"],
      };
      applyStateToRoot(next, el);
      expect(el.getAttribute("data-cv-audience")).toBe("cto");
      expect(el.getAttribute("data-cv-skills")).toBe("microsoft-365 sharepoint");
      expect(el.getAttribute("data-cv-since")).toBe("2019");
      expect(el.getAttribute("data-cv-hide")).toBe("awards");
    },
  );

  it.skipIf?.(!hasDom)(
    "applyStateToRoot removes attributes when state empties",
    async () => {
      const { applyStateToRoot } = await import("./cv-state");
      const el = document.createElement("html") as HTMLElement;
      el.setAttribute("data-cv-skills", "stale");
      applyStateToRoot({ ...DEFAULT_STATE }, el);
      expect(el.getAttribute("data-cv-skills")).toBeNull();
      expect(el.getAttribute("data-cv-since")).toBeNull();
      expect(el.getAttribute("data-cv-hide")).toBeNull();
      expect(el.getAttribute("data-cv-audience")).toBe("default");
    },
  );
});
