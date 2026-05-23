/**
 * cv-state.ts — pure-TS client-side state machine for the /cv page.
 *
 * Implements the "data baked, state in HTML attributes" pattern from
 * Claire's/index.html and SOPHUCKIT_V2/hosts_unified.html: every role
 * and section ships in the static HTML, then a tiny URL/DOM state
 * machine drives visibility via attribute selectors on <html>.
 *
 * State sources (highest priority wins on boot):
 *   1. URL query params (?for, ?skill, ?since, ?hide)        ← shareable
 *   2. localStorage    (mirrors most-recent state)            ← fallback
 *   3. Module DEFAULT_STATE                                   ← else
 *
 * State sinks (always written together on every change):
 *   - history.pushState → URL stays in lockstep with view
 *   - localStorage      → next session boot still feels personal
 *   - <html> data-attrs → CSS adaptation hooks fire instantly
 *
 * No reloads. No SSR round-trips. Subscribers receive a CustomEvent
 * dispatched on `window` so multiple control surfaces (audience chips,
 * skill chips, time slider, section drawer) can stay in sync without
 * holding direct references to each other.
 *
 * Reason: keeping the module DOM-free above the few `applyStateToRoot`
 * mutations means the unit tests can run in node without jsdom — only
 * the small DOM-touching helpers fail at module import time, which the
 * tests guard with feature checks.
 */

export interface CvState {
  audience: string;
  skills: string[];
  since: number | null;
  hide: string[];
}

/**
 * Empty / inert baseline. The page treats `audience: "default"` as the
 * neutral view; an empty skills/hide list and `since: null` mean no
 * filters active. Reason: kept exported so consumers can compare
 * "is this the default?" without re-constructing the object literal.
 */
export const DEFAULT_STATE: Readonly<CvState> = Object.freeze({
  audience: "default",
  skills: [],
  since: null,
  hide: [],
});

/** Custom-event name used by dispatch/subscribe. Stable string token. */
export const STATE_EVENT = "cv-state-change";

/** localStorage key for the boot fallback path. */
export const STORAGE_KEY = "princerehman.cv.state.v1";

/* ────────────────────────────────────────────────────────────────────
 * Pure parsing / serialization (no DOM, no window)
 * ──────────────────────────────────────────────────────────────────── */

/** Parse a comma-separated URL param into a deduped, trimmed list. */
function parseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of String(raw).split(",")) {
    const t = part.trim();
    if (t.length === 0) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Parse an integer from a URL param, returning null on bad input. */
function parseSince(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number.parseInt(String(raw), 10);
  return Number.isInteger(n) ? n : null;
}

/**
 * Build a CvState from a URLSearchParams-like object. Exported as a
 * standalone helper so the unit tests can round-trip without touching
 * window.location.
 */
export function stateFromSearchParams(params: URLSearchParams): CvState {
  return {
    audience: params.get("for") ?? DEFAULT_STATE.audience,
    skills: parseList(params.get("skill")),
    since: parseSince(params.get("since")),
    hide: parseList(params.get("hide")),
  };
}

/**
 * Inverse of stateFromSearchParams: produce a URLSearchParams instance
 * carrying ONLY the params that differ from default. Default-valued
 * fields are omitted so shared URLs stay short.
 */
export function searchParamsFromState(state: CvState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.audience && state.audience !== DEFAULT_STATE.audience) {
    params.set("for", state.audience);
  }
  if (state.skills.length > 0) params.set("skill", state.skills.join(","));
  if (state.since != null) params.set("since", String(state.since));
  if (state.hide.length > 0) params.set("hide", state.hide.join(","));
  return params;
}

/**
 * True if the state is identical to DEFAULT_STATE — used by the boot
 * path to decide whether URL params actually set anything.
 */
export function isDefaultState(state: CvState): boolean {
  return (
    state.audience === DEFAULT_STATE.audience &&
    state.skills.length === 0 &&
    state.since == null &&
    state.hide.length === 0
  );
}

/* ────────────────────────────────────────────────────────────────────
 * DOM-touching helpers
 * Each guarded so the module can be imported in a node test env.
 * ──────────────────────────────────────────────────────────────────── */

export function readStateFromUrl(): CvState {
  if (typeof window === "undefined") return { ...DEFAULT_STATE };
  return stateFromSearchParams(new URL(window.location.href).searchParams);
}

export function readStateFromLocalStorage(): CvState | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CvState>;
    return {
      audience:
        typeof parsed.audience === "string"
          ? parsed.audience
          : DEFAULT_STATE.audience,
      skills: Array.isArray(parsed.skills)
        ? parsed.skills.filter((s) => typeof s === "string")
        : [],
      since:
        typeof parsed.since === "number" && Number.isInteger(parsed.since)
          ? parsed.since
          : null,
      hide: Array.isArray(parsed.hide)
        ? parsed.hide.filter((s) => typeof s === "string")
        : [],
    };
  } catch {
    return null;
  }
}

/**
 * Write the URL. `push` controls history mode: true = pushState (new
 * back-button entry), false = replaceState (no entry — boot path).
 * Preserves any query params not owned by the state machine (analytics
 * utm_*, debug flags, etc).
 */
export function writeStateToUrl(state: CvState, push: boolean = true): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  // Reason: only touch our owned keys so co-existing params survive.
  const owned = ["for", "skill", "since", "hide"];
  for (const k of owned) url.searchParams.delete(k);
  const ours = searchParamsFromState(state);
  for (const [k, v] of ours.entries()) url.searchParams.set(k, v);
  const next = url.toString();
  // Same URL? No-op. Reason: avoids piling pointless history entries
  // when a subscriber re-dispatches the same state.
  if (next === window.location.href) return;
  const method = push ? "pushState" : "replaceState";
  window.history[method]({}, "", next);
}

export function writeStateToLocalStorage(state: CvState): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode — non-fatal */
  }
}

/**
 * Project state onto data-attributes of the root element (default
 * <html>). CSS selectors keyed on these attributes drive visibility,
 * dimming, and ordering. Reason: mirrors the Claire's pattern exactly —
 * the static markup is invariant, only the attribute set changes.
 *
 * Attributes set:
 *   data-cv-audience  — single audience id ("default" | "cto" | ...)
 *   data-cv-skills    — space-separated active skill slugs (or absent)
 *   data-cv-since     — integer year (or absent)
 *   data-cv-hide      — space-separated hidden-section ids (or absent)
 *
 * Per-role data-cv-skills-match / data-cv-older / data-cv-has-older
 * attributes are computed by a separate root-level pass that uses
 * `applyStateToRoles` below (the page wires both).
 */
export function applyStateToRoot(
  state: CvState,
  root?: HTMLElement,
): void {
  if (typeof document === "undefined") return;
  const el = root ?? document.documentElement;
  el.setAttribute("data-cv-audience", state.audience || DEFAULT_STATE.audience);
  if (state.skills.length > 0) {
    el.setAttribute("data-cv-skills", state.skills.join(" "));
  } else {
    el.removeAttribute("data-cv-skills");
  }
  if (state.since != null) {
    el.setAttribute("data-cv-since", String(state.since));
  } else {
    el.removeAttribute("data-cv-since");
  }
  if (state.hide.length > 0) {
    el.setAttribute("data-cv-hide", state.hide.join(" "));
  } else {
    el.removeAttribute("data-cv-hide");
  }
}

/**
 * Per-card pass: for each `.cv-role-card` element, set:
 *   data-cv-skills-match = "true" | "false"
 *     true when activeSkills is empty OR the role has every active skill
 *     (intersection-equals-active). false otherwise. CSS dims false cards.
 *   data-cv-older = "true" | "false"
 *     true when state.since is non-null AND the role's data-cv-year-end
 *     is strictly less than state.since. CSS hides those (or rolls them
 *     into the Earlier Experience block).
 *
 * Also flips data-cv-has-older on the root so the "Earlier Experience"
 * summary block can reveal itself via CSS when any roles got rolled up.
 *
 * Reason: CSS attribute selectors can't do "contains any of these
 * tokens" cleanly, so we precompute the boolean per card in JS. Cheap
 * even on the full role list — single linear pass, no layout thrash.
 */
export function applyStateToRoles(
  state: CvState,
  root?: ParentNode,
): void {
  if (typeof document === "undefined") return;
  const scope = root ?? document;
  const cards = scope.querySelectorAll<HTMLElement>("[data-cv-role-card]");
  const activeSet = new Set(state.skills);
  let anyOlder = false;
  cards.forEach((card) => {
    // Skill match: tokens on the card live in data-cv-skills (space sep).
    if (activeSet.size === 0) {
      card.setAttribute("data-cv-skills-match", "true");
    } else {
      const raw = card.getAttribute("data-cv-skills") ?? "";
      const tokens = new Set(raw.split(/\s+/).filter(Boolean));
      // Every active skill must appear on the card. Reason: matches the
      // server engine's matchesAllActiveSkills semantics.
      let allMatch = true;
      for (const s of activeSet) {
        if (!tokens.has(s)) {
          allMatch = false;
          break;
        }
      }
      card.setAttribute("data-cv-skills-match", allMatch ? "true" : "false");
    }
    // Time axis: data-cv-year-end is an integer baked at render time.
    const yearEnd = parseInt(
      card.getAttribute("data-cv-year-end") ?? "",
      10,
    );
    if (state.since != null && Number.isFinite(yearEnd) && yearEnd < state.since) {
      card.setAttribute("data-cv-older", "true");
      anyOlder = true;
    } else {
      card.setAttribute("data-cv-older", "false");
    }
  });
  const docEl = (scope as Document).documentElement ?? document.documentElement;
  if (docEl) {
    if (anyOlder) docEl.setAttribute("data-cv-has-older", "true");
    else docEl.removeAttribute("data-cv-has-older");
  }
}

/* ────────────────────────────────────────────────────────────────────
 * Pub/sub
 *
 * Subscribers receive the dispatched state via CustomEvent.detail.
 * Reason: zero coupling between control surfaces — each chip group can
 * import this module, dispatch on click, and ignore the others.
 * ──────────────────────────────────────────────────────────────────── */

export function dispatchStateChange(state: CvState): void {
  if (typeof window === "undefined") return;
  const evt = new CustomEvent<CvState>(STATE_EVENT, { detail: { ...state } });
  window.dispatchEvent(evt);
}

export function onStateChange(fn: (state: CvState) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<CvState>).detail;
    if (detail) fn(detail);
  };
  window.addEventListener(STATE_EVENT, handler as EventListener);
  return () => window.removeEventListener(STATE_EVENT, handler as EventListener);
}

/* ────────────────────────────────────────────────────────────────────
 * Convenience: merge a partial patch into the current state and
 * dispatch. Reason: every control surface follows the same "read URL,
 * mutate one slice, dispatch" pattern; bundling it here keeps the
 * component scripts tiny.
 * ──────────────────────────────────────────────────────────────────── */

export function patchState(patch: Partial<CvState>): CvState {
  const current = readStateFromUrl();
  const next: CvState = {
    audience: patch.audience ?? current.audience,
    skills: patch.skills ?? current.skills,
    since: patch.since !== undefined ? patch.since : current.since,
    hide: patch.hide ?? current.hide,
  };
  dispatchStateChange(next);
  return next;
}
