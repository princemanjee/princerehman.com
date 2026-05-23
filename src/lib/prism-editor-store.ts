/**
 * Prism Editor Store (Phase 2 — point-and-click editor)
 * ---------------------------------------------------------------------------
 * Pure-TS state layer for `src/pages/styleguide/editor.astro`. It owns:
 *
 *   1. The serialised EditorState shape that survives across reloads via
 *      localStorage and round-trips through Export / Import JSON files.
 *   2. The bridge into the existing palette runtime (`prism-runtime.ts`)
 *      so that selecting a mode / hue / mixing model / contrast level
 *      still flows through the canonical OKLCH generator and applies as
 *      inline-style overrides on <html>. The runtime already does the
 *      heavy lifting (palette computation + DOM apply); this module only
 *      adds the editor's extra per-token overrides on top.
 *   3. Per-token overrides keyed by CSS custom-property name. Anything in
 *      `tokenOverrides` is applied AFTER the runtime so the user's manual
 *      pick of, say, `--bg-1` wins over the generator's value.
 *
 * Scope guards:
 *   - Never modifies `tokens.css`, `prism-palette.ts`, `prism-runtime.ts`,
 *     `prismSwatches.ts`, the styleguide index, or BaseLayout.
 *   - Pure module: no DOM access at import time; all DOM calls are guarded
 *     by `typeof document !== "undefined"`.
 *   - Persistence key is `prism-editor-state` — namespaced separately from
 *     the runtime's own `prism-*` keys so the two layers don't fight.
 */

import type {
  ContrastLevel,
  MixingModel,
  ThemeMode,
} from "./prism-palette";
import {
  applyState as runtimeApplyState,
  computePalette,
  DEFAULTS as RUNTIME_DEFAULTS,
  type PrismState,
} from "./prism-runtime";

// ─── Public types ────────────────────────────────────────────────────────

export interface EditorGeneratorState {
  hue: number;          // 0-360 integer
  model: MixingModel;
  contrast: ContrastLevel;
}

export interface EditorState {
  mode: ThemeMode;
  generator: EditorGeneratorState;
  /** CSS custom property name -> raw value (any CSS color / length / time). */
  tokenOverrides: Record<string, string>;
  /** Versioned so future migrations can be detected on import. */
  schemaVersion: 1;
}

// ─── Constants ───────────────────────────────────────────────────────────

export const STORAGE_KEY = "prism-editor-state";
export const EXPORT_FILENAME = "prism-overrides.json";
export const CURRENT_SCHEMA_VERSION = 1 as const;

export const FACTORY_DEFAULT: EditorState = {
  mode: RUNTIME_DEFAULTS.mode,
  generator: {
    hue: RUNTIME_DEFAULTS.hue,
    model: RUNTIME_DEFAULTS.model,
    contrast: RUNTIME_DEFAULTS.contrast,
  },
  tokenOverrides: {},
  schemaVersion: CURRENT_SCHEMA_VERSION,
};

/**
 * Token names the editor may legally override. The set is the union of:
 *   - every palette-emitted custom property (from prism-palette.ts)
 *   - effect tokens (glass blur / saturate, motion duration) that the
 *     palette generator doesn't touch but the editor's Effects panel does.
 * Used by validation on import so a hand-edited file can't smuggle in
 * arbitrary inline-style overrides.
 */
export const EDITABLE_TOKENS: readonly string[] = [
  "--bg-1", "--bg-2", "--bg-3", "--bg-4", "--bg-overlay-1", "--bg-overlay-2",
  "--accent-royal", "--accent-royal-bright", "--accent-royal-deep",
  "--accent-emerald", "--accent-emerald-bright", "--accent-emerald-deep",
  "--color-fg-primary", "--color-fg-secondary", "--color-fg-tertiary", "--color-fg-muted",
  "--brand-color", "--brand-glow",
  "--glass-bg", "--glass-bg-hover", "--glass-border", "--glass-border-strong",
  "--glass-blur", "--glass-saturate",
  "--duration-fast", "--duration-base", "--duration-slow",
] as const;

const EDITABLE_TOKEN_SET = new Set<string>(EDITABLE_TOKENS);

// ─── Validation ──────────────────────────────────────────────────────────

const VALID_MODES: ThemeMode[] = ["dark", "light", "hybrid", "system", "neomorphic"];
const VALID_MODELS: MixingModel[] = ["analogous", "split-complementary", "complementary"];
const VALID_CONTRAST: ContrastLevel[] = ["AA", "AAA"];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Type-safe coercion of an unknown blob into an EditorState. Returns null
 *  if the input is structurally invalid. Unknown fields are dropped; only
 *  recognised CSS custom properties survive into `tokenOverrides`. */
export function parseEditorState(raw: unknown): EditorState | null {
  if (!isPlainObject(raw)) return null;
  const out: EditorState = { ...FACTORY_DEFAULT, tokenOverrides: {} };

  if (typeof raw.mode === "string" && VALID_MODES.includes(raw.mode as ThemeMode)) {
    out.mode = raw.mode as ThemeMode;
  }
  if (isPlainObject(raw.generator)) {
    const g = raw.generator;
    if (typeof g.hue === "number" && Number.isFinite(g.hue) && g.hue >= 0 && g.hue <= 360) {
      out.generator.hue = Math.round(g.hue);
    }
    if (typeof g.model === "string" && VALID_MODELS.includes(g.model as MixingModel)) {
      out.generator.model = g.model as MixingModel;
    }
    if (typeof g.contrast === "string" && VALID_CONTRAST.includes(g.contrast as ContrastLevel)) {
      out.generator.contrast = g.contrast as ContrastLevel;
    }
  }
  if (isPlainObject(raw.tokenOverrides)) {
    for (const [k, v] of Object.entries(raw.tokenOverrides)) {
      if (typeof v !== "string") continue;
      if (!EDITABLE_TOKEN_SET.has(k)) continue;
      out.tokenOverrides[k] = v;
    }
  }
  return out;
}

// ─── localStorage I/O ────────────────────────────────────────────────────

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

function removeLS(key: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
  } catch {
    /* best-effort */
  }
}

export function loadFromLocalStorage(): EditorState | null {
  const raw = readLS(STORAGE_KEY);
  if (!raw) return null;
  try {
    return parseEditorState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveToLocalStorage(state: EditorState): void {
  writeLS(STORAGE_KEY, JSON.stringify(state));
}

// ─── Export / Import ─────────────────────────────────────────────────────

/**
 * Trigger a browser file save of the current state as
 * `prism-overrides.json`. No-ops in non-browser contexts.
 */
export function exportToFile(state: EditorState): void {
  if (typeof document === "undefined" || typeof URL === "undefined") return;
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = EXPORT_FILENAME;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Reason: revoke after the download has been dispatched so the browser
  // can still resolve the blob during the click handler.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Open the OS file picker, read the chosen JSON file, validate, and
 * resolve with a clean EditorState. Rejects on cancel, parse error, or
 * structural validation failure.
 */
export function importFromFile(): Promise<EditorState> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("importFromFile requires a browser environment"));
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.style.display = "none";
    document.body.appendChild(input);

    let settled = false;
    const cleanup = () => {
      if (input.parentNode) input.parentNode.removeChild(input);
    };

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) {
        settled = true;
        cleanup();
        reject(new Error("No file selected"));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => {
        settled = true;
        cleanup();
        reject(new Error("Failed to read file"));
      };
      reader.onload = () => {
        settled = true;
        cleanup();
        try {
          const parsed = JSON.parse(String(reader.result ?? ""));
          const state = parseEditorState(parsed);
          if (!state) {
            reject(new Error("File does not contain a valid Prism editor state"));
            return;
          }
          resolve(state);
        } catch {
          reject(new Error("File is not valid JSON"));
        }
      };
      reader.readAsText(file);
    });

    // Reason: some browsers fire `cancel` (newer Chromium) when the user
    // dismisses the picker; we treat that as a reject for callers that
    // want to clear a spinner state. Older browsers never fire it, so the
    // promise simply stays pending and the input gets garbage collected.
    input.addEventListener("cancel", () => {
      if (settled) return;
      cleanup();
      reject(new Error("Import cancelled"));
    });

    input.click();
  });
}

// ─── Reset & apply ───────────────────────────────────────────────────────

/**
 * Clear persistence and return a fresh factory copy. The caller is
 * responsible for re-applying it (so the page can also trigger a UI
 * sync in the same tick).
 */
export function resetToFactory(): EditorState {
  removeLS(STORAGE_KEY);
  return structuredCloneSafe(FACTORY_DEFAULT);
}

function structuredCloneSafe<T>(value: T): T {
  // Reason: structuredClone is widely available but fall back to JSON
  // round-trip for the worst-case older runtime. EditorState is plain
  // data so JSON is lossless here.
  try {
    if (typeof structuredClone === "function") return structuredClone(value);
  } catch { /* fall through */ }
  return JSON.parse(JSON.stringify(value));
}

/**
 * Build the PrismState that the runtime expects from an EditorState.
 * The editor doesn't model "swatch id" (swatches are quick-select
 * shortcuts that fold into hue + model on click), so we pass through
 * the runtime default swatch id; the runtime's mono path consults
 * `hue` directly and ignores swatch metadata when computing the palette.
 */
function toPrismState(state: EditorState): PrismState {
  return {
    mode: state.mode,
    swatchId: RUNTIME_DEFAULTS.swatchId,
    hue: state.generator.hue,
    model: state.generator.model,
    contrast: state.generator.contrast,
    pickedAt: new Date().toISOString(),
  };
}

/**
 * Apply the editor state to <html>:
 *   1. Run the existing runtime (sets data-theme + every palette token
 *      that flows out of `generatePalette`).
 *   2. Layer the editor's per-token overrides on top so anything the
 *      user explicitly picked beats the generator.
 *
 * Safe to call in non-browser contexts (no-ops).
 */
export function applyState(state: EditorState): void {
  if (typeof document === "undefined") return;

  const prism = toPrismState(state);
  const palette = computePalette(prism);
  runtimeApplyState(prism, palette);

  const root = document.documentElement;

  // Reason: the editor only knows about its own override list, so on every
  // apply we clear ONLY editor-managed tokens that are no longer in the
  // override set. That way the runtime's freshly-applied generator values
  // remain visible when the user removes an override, but tokens like
  // `--glass-blur` that the runtime never touches still revert to the
  // tokens.css default via removeProperty.
  for (const token of EDITABLE_TOKENS) {
    if (!(token in state.tokenOverrides)) {
      // Only clear effect / spacing-style tokens; palette tokens are
      // already overwritten by the runtime above so leaving them set
      // would mask the runtime output.
      if (!isPaletteToken(token)) {
        root.style.removeProperty(token);
      }
    }
  }

  for (const [token, value] of Object.entries(state.tokenOverrides)) {
    if (!EDITABLE_TOKEN_SET.has(token)) continue;
    root.style.setProperty(token, value);
  }
}

/** Tokens the palette generator owns. Editor overrides win at apply time,
 *  but on clear we don't `removeProperty` these — the runtime already wrote
 *  the canonical value into them and we want to keep that as the floor. */
function isPaletteToken(token: string): boolean {
  return (
    token.startsWith("--bg-") ||
    token.startsWith("--accent-") ||
    token.startsWith("--color-fg-") ||
    token.startsWith("--brand-") ||
    token.startsWith("--glass-bg") ||
    token.startsWith("--glass-border")
  );
}

// ─── Convenience update helpers ──────────────────────────────────────────

export function setOverride(
  state: EditorState,
  token: string,
  value: string | null,
): EditorState {
  const next: EditorState = {
    ...state,
    tokenOverrides: { ...state.tokenOverrides },
  };
  if (value === null || value === "") delete next.tokenOverrides[token];
  else if (EDITABLE_TOKEN_SET.has(token)) next.tokenOverrides[token] = value;
  return next;
}

export function setGenerator(
  state: EditorState,
  patch: Partial<EditorGeneratorState>,
): EditorState {
  return {
    ...state,
    generator: { ...state.generator, ...patch },
  };
}

export function setMode(state: EditorState, mode: ThemeMode): EditorState {
  return { ...state, mode };
}
