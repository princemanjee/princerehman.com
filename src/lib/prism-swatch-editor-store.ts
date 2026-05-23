/**
 * Prism Swatch Editor — persistence + intensity helpers (Phase 2).
 *
 * Backing store for /styleguide/swatches/editor: a four-slider playground
 * that exercises (hueA, hueB, intensityA, intensityB) across the 9
 * combinations of {analogous | split-complementary | complementary} ×
 * {light | dark | hybrid}.
 *
 * Responsibilities:
 *   - Define `SwatchEditorState` + factory defaults.
 *   - Round-trip the state through `localStorage` (key
 *     `prism-swatch-editor-state`).
 *   - Round-trip the state through user-initiated file export / import.
 *   - Provide a small `applyIntensityToOklch` helper that the page uses
 *     to scale chroma on generated OKLCH strings (0 = grayscale,
 *     100 = full chroma). Kept here so the page module stays focused on
 *     rendering and the math has a single home.
 *
 * No DOM imports at module load: every browser-dependent call is gated
 * behind `typeof window !== "undefined"` so Astro can statically analyse
 * the module on the server. The page imports this from a
 * `<script type="module">` block which only runs client-side.
 *
 * IMPORTANT: This module owns NO state itself. It is a pure serializer
 * + pure-math helper. Callers (the editor page) hold the live state and
 * call into here to read/write.
 */

export interface SwatchEditorState {
  hueA: number;          // 0..360, base hue for accent A (royal track)
  hueB: number;          // 0..360, base hue for accent B (emerald track)
  intensityA: number;    // 0..100, percent of full chroma applied to A's accents
  intensityB: number;    // 0..100, percent of full chroma applied to B's accents
  schemaVersion: 1;
}

/**
 * Royal (263°) + Emerald (152°) at full intensity matches the Phase 1
 * shipping defaults in tokens.css, so first-load shows the canonical
 * baseline.
 */
export const FACTORY_DEFAULT: SwatchEditorState = {
  hueA: 263,
  hueB: 152,
  intensityA: 100,
  intensityB: 100,
  schemaVersion: 1,
};

const STORAGE_KEY = "prism-swatch-editor-state";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function clampHue(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  // Wrap into [0, 360). Keep negative inputs sensible.
  const wrapped = ((v % 360) + 360) % 360;
  return wrapped;
}

function clampPct(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

/**
 * Coerce an arbitrary parsed-JSON blob into a valid SwatchEditorState.
 * Returns `null` if the blob is too damaged to recover. We accept partial
 * states by filling missing fields from FACTORY_DEFAULT so old saves keep
 * working as the schema grows.
 */
function coerceState(raw: unknown): SwatchEditorState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  // Reason: a save without any numeric field at all is almost certainly
  // corrupted or from an unrelated key collision. Reject instead of
  // silently returning factory defaults, so the page knows to fall back.
  const hasAnyField =
    "hueA" in r || "hueB" in r || "intensityA" in r || "intensityB" in r;
  if (!hasAnyField) return null;
  return {
    hueA: clampHue(r.hueA ?? FACTORY_DEFAULT.hueA),
    hueB: clampHue(r.hueB ?? FACTORY_DEFAULT.hueB),
    intensityA: clampPct(r.intensityA ?? FACTORY_DEFAULT.intensityA),
    intensityB: clampPct(r.intensityB ?? FACTORY_DEFAULT.intensityB),
    schemaVersion: 1,
  };
}

// ---------------------------------------------------------------------------
// localStorage round-trip
// ---------------------------------------------------------------------------

export function loadFromLocalStorage(): SwatchEditorState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return coerceState(JSON.parse(raw));
  } catch {
    // Reason: localStorage can throw (Safari private mode, quota,
    // SecurityError on file://). Failing closed lets the page boot at
    // factory defaults instead of crashing.
    return null;
  }
}

export function saveToLocalStorage(s: SwatchEditorState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Quota / private mode: silently ignore. The in-memory state in the
    // page is still authoritative for the session.
  }
}

// ---------------------------------------------------------------------------
// File export / import
// ---------------------------------------------------------------------------

/**
 * Pop a download dialog for the current state as pretty-printed JSON.
 * Filename is timestamped so the operator can keep multiple snapshots.
 */
export function exportToFile(s: SwatchEditorState): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `prism-swatch-editor-${stamp}.json`;
  const blob = new Blob([JSON.stringify(s, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Reason: revoke after a tick so the browser has time to actually
  // start the download in Firefox/Safari.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Open a file picker and resolve with the imported state. Rejects if the
 * user cancels, picks a non-JSON file, or the JSON does not contain a
 * recognisable SwatchEditorState shape.
 */
export function importFromFile(): Promise<SwatchEditorState> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      reject(new Error("importFromFile is browser-only"));
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.style.display = "none";
    document.body.appendChild(input);

    let resolved = false;
    const cleanup = () => {
      if (input.parentNode) input.parentNode.removeChild(input);
    };

    // Reason: 'change' fires when user picks a file. Cancel fires no
    // event in some browsers; we use a window-focus fallback to detect
    // the dialog being closed without a selection.
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) {
        cleanup();
        if (!resolved) reject(new Error("No file selected"));
        return;
      }
      try {
        const text = await file.text();
        const parsed = coerceState(JSON.parse(text));
        if (!parsed) {
          throw new Error("File does not contain a Prism swatch editor state");
        }
        resolved = true;
        cleanup();
        resolve(parsed);
      } catch (err) {
        cleanup();
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });

    window.addEventListener(
      "focus",
      () => {
        // Give the change event a chance to fire first.
        setTimeout(() => {
          if (!resolved && input.files && input.files.length === 0) {
            cleanup();
            reject(new Error("Import cancelled"));
          }
        }, 300);
      },
      { once: true },
    );

    input.click();
  });
}

// ---------------------------------------------------------------------------
// Factory reset
// ---------------------------------------------------------------------------

export function resetToFactory(): SwatchEditorState {
  // Return a fresh clone so callers can mutate without poisoning the const.
  return { ...FACTORY_DEFAULT };
}

// ---------------------------------------------------------------------------
// Intensity math
// ---------------------------------------------------------------------------

/**
 * Parse an OKLCH string of the form
 *   "oklch(L C H)"  or  "oklch(L C H / A)"
 * and return the components, or `null` if the string is not parseable.
 * Mirrors the parser in prism-palette.ts so the editor stays self-contained.
 */
function parseOklch(
  value: string,
): { l: number; c: number; h: number; a: number } | null {
  const m = value.match(
    /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/i,
  );
  if (!m) return null;
  return {
    l: Number(m[1]),
    c: Number(m[2]),
    h: Number(m[3]),
    a: m[4] !== undefined ? Number(m[4]) : 1,
  };
}

function roundTo(n: number, digits: number): number {
  const k = Math.pow(10, digits);
  return Math.round(n * k) / k;
}

function formatOklch(l: number, c: number, h: number, a: number): string {
  const Lr = roundTo(l, 3);
  const Cr = roundTo(c, 3);
  const hr = roundTo(h, 1);
  if (a >= 1) return `oklch(${Lr} ${Cr} ${hr})`;
  const ar = roundTo(a, 2);
  return `oklch(${Lr} ${Cr} ${hr} / ${ar})`;
}

/**
 * Multiply the chroma of an OKLCH color by `intensityPct / 100`.
 *
 * intensityPct = 0   -> chroma becomes 0 (the color collapses to a
 *                      neutral grey at the same L; hue becomes
 *                      perceptually irrelevant but is preserved so a
 *                      subsequent "intensity up" recovers the original
 *                      hue exactly).
 * intensityPct = 100 -> chroma is unchanged (identity transform).
 * intensityPct > 100 -> not supported by the slider, but the math
 *                      handles it gracefully (chroma can exceed the sRGB
 *                      gamut; downstream conversions clamp).
 *
 * Non-OKLCH strings, gradients, and the literal "transparent" are passed
 * through unchanged so callers can safely run every generated palette
 * value through here without filtering.
 */
export function applyIntensityToOklch(
  value: string | undefined,
  intensityPct: number,
): string | undefined {
  if (value === undefined) return undefined;
  if (value === "transparent") return value;
  // Gradients contain commas + multiple oklch() calls; rewrite each one.
  if (value.includes("gradient(")) {
    return value.replace(/oklch\([^)]+\)/gi, (m) => {
      const p = parseOklch(m);
      if (!p) return m;
      return formatOklch(p.l, p.c * (intensityPct / 100), p.h, p.a);
    });
  }
  const p = parseOklch(value);
  if (!p) return value;
  return formatOklch(p.l, p.c * (intensityPct / 100), p.h, p.a);
}
