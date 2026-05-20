/**
 * Prism Phase 2 runtime.
 *
 * Central orchestration layer that ties together:
 *   - prism-palette.ts        the OKLCH palette generator with contrast guardrails
 *   - themeSchedule.ts        admin-elected scheduled defaults (force + soft)
 *   - prismSwatches.ts        the locked 19-swatch starter set
 *
 * Responsibilities:
 *   1. Read and write the visitor's persisted preferences in localStorage.
 *   2. Resolve the active state by reconciling persisted state with the
 *      schedule (force entries override, soft entries fill in defaults,
 *      user picks are sticky once made).
 *   3. Compute the active accent palette from the resolved state (mono
 *      swatches feed the generator; palette presets extract their first
 *      color's hue as the base).
 *   4. Apply the state and palette to the DOM (set data-theme + inline
 *      CSS custom property overrides on document.documentElement).
 *   5. Surface a single setUserSelection() entry point so PrismPanel can
 *      flip controls without knowing the storage or DOM details.
 *
 * Module loads in browser context. It is also pure enough to run in
 * Node for unit tests (DOM calls are guarded by typeof document).
 */

import {
  generatePalette,
  generatePresetPalette,
  generatePridePalette,
  type ContrastLevel,
  type GeneratedPalette,
  type MixingModel,
  type ThemeMode,
} from "./prism-palette";
import {
  getActiveScheduleEntry,
  type ScheduleEntry,
} from "../data/themeSchedule";
import {
  getSwatchById,
  isMono,
  isPalette,
  type Swatch,
} from "../data/prismSwatches";

// ─── State shape ─────────────────────────────────────────────────────

export interface PrismState {
  mode: ThemeMode;
  swatchId: string;
  hue: number;          // 0-360 base hue (kept in sync with active swatch's hue)
  model: MixingModel;
  contrast: ContrastLevel;
  pickedAt: string | null;  // ISO timestamp; null until the visitor actively selects
}

export const DEFAULTS: PrismState = {
  mode: "hybrid",
  swatchId: "royal-default",
  hue: 263,
  model: "analogous",
  contrast: "AA",
  pickedAt: null,
};

export const STORAGE_KEYS = {
  mode: "prism-theme",
  swatchId: "prism-swatch",
  hue: "prism-hue",
  model: "prism-model",
  contrast: "prism-contrast",
  pickedAt: "prism-picked-at",
  palette: "prism-palette",
} as const;

const VALID_MODES: ThemeMode[] = ["dark", "light", "hybrid", "system", "neomorphic"];
const VALID_MODELS: MixingModel[] = ["analogous", "split-complementary", "complementary"];
const VALID_CONTRAST: ContrastLevel[] = ["AA", "AAA"];

// ─── localStorage I/O ────────────────────────────────────────────────

function readLS(key: string): string | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function writeLS(key: string, value: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  } catch {
    /* best-effort */
  }
}

export function loadState(): PrismState {
  const mode = (readLS(STORAGE_KEYS.mode) as ThemeMode) || DEFAULTS.mode;
  const swatchId = readLS(STORAGE_KEYS.swatchId) || DEFAULTS.swatchId;
  const hueRaw = readLS(STORAGE_KEYS.hue);
  const hue = hueRaw !== null && !Number.isNaN(Number(hueRaw)) ? Number(hueRaw) : DEFAULTS.hue;
  const model = (readLS(STORAGE_KEYS.model) as MixingModel) || DEFAULTS.model;
  const contrast = (readLS(STORAGE_KEYS.contrast) as ContrastLevel) || DEFAULTS.contrast;
  const pickedAt = readLS(STORAGE_KEYS.pickedAt);

  return {
    mode: VALID_MODES.includes(mode) ? mode : DEFAULTS.mode,
    swatchId,
    hue: hue >= 0 && hue <= 360 ? hue : DEFAULTS.hue,
    model: VALID_MODELS.includes(model) ? model : DEFAULTS.model,
    contrast: VALID_CONTRAST.includes(contrast) ? contrast : DEFAULTS.contrast,
    pickedAt,
  };
}

export function saveState(state: PrismState, palette: GeneratedPalette): void {
  writeLS(STORAGE_KEYS.mode, state.mode);
  writeLS(STORAGE_KEYS.swatchId, state.swatchId);
  writeLS(STORAGE_KEYS.hue, String(state.hue));
  writeLS(STORAGE_KEYS.model, state.model);
  writeLS(STORAGE_KEYS.contrast, state.contrast);
  if (state.pickedAt) writeLS(STORAGE_KEYS.pickedAt, state.pickedAt);
  writeLS(STORAGE_KEYS.palette, JSON.stringify(palette));
}

// ─── Schedule resolution ─────────────────────────────────────────────

/**
 * Given a schedule entry that is active for `today`, return the date the
 * current force period (or soft window) began. Handles year-wrap entries
 * (e.g. Dec 29 -> Jan 5) by checking whether the start MM-DD has already
 * occurred this calendar year; if not, the period began last year.
 */
function computePeriodStart(entry: ScheduleEntry, today: Date): Date {
  const [m, d] = entry.start.split("-").map(Number);
  let start = new Date(today.getFullYear(), m - 1, d, 0, 0, 0, 0);
  if (start.getTime() > today.getTime()) {
    start = new Date(today.getFullYear() - 1, m - 1, d, 0, 0, 0, 0);
  }
  return start;
}

/**
 * Reconcile persisted state with today's schedule, applying force vs soft
 * vs user-pick stickiness rules.
 *
 *   - No matching entry: stored state wins.
 *   - Soft entry: applies only if pickedAt is null (visitor has never picked).
 *   - Force entry: applies UNLESS pickedAt >= the force period's start
 *     (visitor actively chose during this period; honor their pick).
 */
export function resolveState(stored: PrismState, now: Date): PrismState {
  const { entry, isForce } = getActiveScheduleEntry(now);
  if (!entry) return stored;

  if (isForce) {
    if (stored.pickedAt) {
      const picked = new Date(stored.pickedAt);
      const periodStart = computePeriodStart(entry, now);
      if (!Number.isNaN(picked.getTime()) && picked.getTime() >= periodStart.getTime()) {
        return stored;
      }
    }
    return applyEntryToState(stored, entry);
  }

  // Soft entry
  if (stored.pickedAt) return stored;
  return applyEntryToState(stored, entry);
}

function applyEntryToState(base: PrismState, entry: ScheduleEntry): PrismState {
  const swatch = getSwatchById(entry.swatch);
  const next: PrismState = {
    ...base,
    swatchId: entry.swatch,
  };
  if (entry.mode) next.mode = entry.mode;
  if (swatch && isMono(swatch)) next.hue = swatch.oklch.h;
  else if (swatch) {
    const h = extractHueFromOklch(swatch.groups[0]?.colors[0]?.value);
    if (h !== null) next.hue = h;
  }
  return next;
}

// ─── Palette computation ─────────────────────────────────────────────

function extractHueFromOklch(value: string | undefined): number | null {
  if (!value) return null;
  // Matches "oklch(L C H)" or "oklch(L C H / A)" with whitespace tolerance.
  const m = value.match(/oklch\(\s*[\d.]+\s+[\d.]+\s+([\d.]+)/i);
  if (!m) return null;
  const h = Number(m[1]);
  return Number.isFinite(h) ? h : null;
}

function resolveSystemMode(): "light" | "dark" {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "dark";
}

/**
 * Compute the active palette overrides for a given state.
 *
 * - Mono swatch: pass the swatch hue + the user's selected model and
 *   contrast to generatePalette.
 * - Palette swatch (preset): extract the first color's hue and treat as
 *   a mono base for generation. The preset's other colors remain
 *   visible in the Prism panel swatch row for visual identity, but
 *   accent tokens are derived from the primary. (Future enhancement:
 *   designer-specified per-token mappings on PaletteSwatch.)
 *
 * "system" mode is resolved here to either "light" or "dark" so the
 * generator can pick canonical surface/text constants.
 */
export function computePalette(state: PrismState): GeneratedPalette {
  const resolvedMode: ThemeMode =
    state.mode === "system" ? resolveSystemMode() : state.mode;

  // Palette presets bypass the mixing-model generator and apply their own
  // fixed color scheme directly. Mono swatches use the hue + mixing model.
  const swatch = getSwatchById(state.swatchId);
  if (swatch && isPalette(swatch)) {
    if (state.swatchId === "pride") {
      return generatePridePalette(resolvedMode);
    }
    const colors = swatch.groups.flatMap((g) => g.colors.map((c) => c.value));
    return generatePresetPalette(colors, resolvedMode, swatch.roles);
  }

  // Mono path: state.hue is the single source of truth for the base hue.
  // Selecting a swatch sets state.hue (see setUserSelection /
  // applyEntryToState); the hue slider sets it directly. Do not re-derive
  // from the swatch here, or the slider would be silently overridden.
  return generatePalette({
    mode: resolvedMode,
    model: state.model,
    hue: state.hue,
    contrast: state.contrast,
  });
}

/** Resolve a swatch id to its base hue (mono hue, or first preset color). */
function swatchHue(swatchId: string): number | null {
  const swatch: Swatch | undefined = getSwatchById(swatchId);
  if (!swatch) return null;
  if (isMono(swatch)) return swatch.oklch.h;
  return extractHueFromOklch(swatch.groups[0]?.colors[0]?.value);
}

// ─── DOM application ────────────────────────────────────────────────

/**
 * Every CSS custom property either palette path can set. Cleared before
 * each apply so switching between mono swatches and palette presets (which
 * emit different key sets, e.g. presets add text tokens) never leaves a
 * stale inline override behind.
 */
const CLEARABLE_KEYS: string[] = [
  "--bg-1", "--bg-2", "--bg-3", "--bg-4", "--bg-overlay-1", "--bg-overlay-2",
  "--glass-bg", "--glass-bg-hover", "--glass-border", "--glass-border-strong",
  "--highlight-top", "--highlight-top-soft", "--highlight-bottom",
  "--highlight-bottom-soft", "--shadow-side",
  "--neo-surface", "--neo-shadow-light", "--neo-shadow-dark",
  "--accent-royal", "--accent-royal-bright", "--accent-royal-deep",
  "--accent-emerald", "--accent-emerald-bright", "--accent-emerald-deep",
  "--brand-color", "--brand-glow",
  "--color-fg-primary", "--color-fg-secondary", "--color-fg-tertiary",
  "--color-fg-muted",
  "--prism-active-hue", "--oz-color",
];

export function applyState(state: PrismState, palette: GeneratedPalette): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", state.mode);

  // Clear stale overrides from a previous palette/mode before applying.
  for (const key of CLEARABLE_KEYS) root.style.removeProperty(key);

  for (const key of Object.keys(palette) as Array<keyof GeneratedPalette>) {
    const v = palette[key];
    if (v !== undefined) root.style.setProperty(key, v);
  }

  // Expose the active base hue so the .oz alternate accent can switch to
  // ruby when the hue lands in the green band. See global.css.
  root.style.setProperty("--prism-active-hue", String(Math.round(state.hue)));
  const inGreenBand = state.hue >= 100 && state.hue <= 180;
  root.style.setProperty(
    "--oz-color",
    inGreenBand ? "oklch(0.45 0.20 15)" : "var(--accent-emerald)",
  );

  // Flag palette presets via a data attribute so special renders (the
  // Pride ROYGBIV gradient background) can key off it in global.css. Mono
  // swatches clear the attribute.
  const swatch = getSwatchById(state.swatchId);
  if (swatch && isPalette(swatch)) {
    root.setAttribute("data-prism-palette", state.swatchId);
  } else {
    root.removeAttribute("data-prism-palette");
  }
}

// ─── Entry points ────────────────────────────────────────────────────

/**
 * Boot the runtime: load persisted state, reconcile with today's
 * schedule, compute the palette, apply to DOM, and write the resolved
 * state + palette back to localStorage. Called once on every page load
 * by the bundled bootstrap script in BaseLayout.astro.
 */
export function init(now: Date = new Date()): {
  state: PrismState;
  palette: GeneratedPalette;
} {
  const stored = loadState();
  const resolved = resolveState(stored, now);
  const palette = computePalette(resolved);
  applyState(resolved, palette);
  saveState(resolved, palette);
  return { state: resolved, palette };
}

/**
 * PrismPanel calls this when the visitor changes any control. Stamps
 * pickedAt with the current time (making the choice sticky against
 * future force-schedule overrides), persists, and applies.
 */
export function setUserSelection(partial: Partial<PrismState>): {
  state: PrismState;
  palette: GeneratedPalette;
} {
  const current = loadState();
  const merged: PrismState = {
    ...current,
    ...partial,
    pickedAt: new Date().toISOString(),
  };
  // Selecting a swatch without an explicit hue sets the base hue from that
  // swatch. An explicit hue (from the slider) always wins.
  if (partial.swatchId !== undefined && partial.hue === undefined) {
    const h = swatchHue(partial.swatchId);
    if (h !== null) merged.hue = h;
  }
  const palette = computePalette(merged);
  applyState(merged, palette);
  saveState(merged, palette);
  return { state: merged, palette };
}

/**
 * Clear all persisted preferences and reapply defaults. Used by the
 * "Reset to defaults" affordance in the Prism panel.
 */
export function resetToDefault(): {
  state: PrismState;
  palette: GeneratedPalette;
} {
  try {
    for (const key of Object.values(STORAGE_KEYS)) {
      if (typeof localStorage !== "undefined") localStorage.removeItem(key);
    }
  } catch {
    /* best-effort */
  }
  const state = { ...DEFAULTS };
  const palette = computePalette(state);
  applyState(state, palette);
  return { state, palette };
}
