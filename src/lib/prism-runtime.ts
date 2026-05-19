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
  const swatch: Swatch | undefined = getSwatchById(state.swatchId);
  let hue = state.hue;
  if (swatch && isMono(swatch)) {
    hue = swatch.oklch.h;
  } else if (swatch) {
    const h = extractHueFromOklch(swatch.groups[0]?.colors[0]?.value);
    if (h !== null) hue = h;
  }

  const resolvedMode: ThemeMode =
    state.mode === "system" ? resolveSystemMode() : state.mode;

  return generatePalette({
    mode: resolvedMode,
    model: state.model,
    hue,
    contrast: state.contrast,
  });
}

// ─── DOM application ────────────────────────────────────────────────

export function applyState(state: PrismState, palette: GeneratedPalette): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", state.mode);
  for (const key of Object.keys(palette) as Array<keyof GeneratedPalette>) {
    root.style.setProperty(key, palette[key]);
  }
  // Expose the active base hue as a CSS custom property so the .oz
  // alternate accent can switch to ruby when the hue lands in the green
  // band. See global.css for the .oz rule.
  root.style.setProperty("--prism-active-hue", String(Math.round(state.hue)));

  // .oz alternate accent: defaults to emerald, switches to ruby when
  // the active base hue is in the green band (100-180 degrees) so the
  // CTA still reads as distinct against a green-keyed palette.
  // Dorothy's ruby slippers when the world is the Emerald City.
  const inGreenBand = state.hue >= 100 && state.hue <= 180;
  root.style.setProperty(
    "--oz-color",
    inGreenBand ? "oklch(0.45 0.20 15)" : "var(--accent-emerald)",
  );
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
