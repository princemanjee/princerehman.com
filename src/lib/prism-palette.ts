/**
 * Prism Palette Generator (Phase 2)
 * ---------------------------------------------------------------------------
 * Pure TypeScript module that produces a generated OKLCH palette for the
 * Prism design system on princerehman.com. The runtime in BaseLayout.astro
 * applies the returned values directly to `<html>` as inline style overrides
 * on the CSS custom properties already defined in src/styles/tokens.css.
 *
 * Algorithm summary
 * -----------------
 * 1. Pick a base lightness (L) and chroma (C) for the primary accent based on
 *    the active theme mode. Dark / hybrid / system-dark themes use a slightly
 *    higher L so the accent reads against deep surfaces; light / neomorphic /
 *    system-light themes use a slightly lower L so the accent stands out
 *    against a pale surface.
 * 2. Compute the alt accent hue from the requested mixing model:
 *      - analogous           -> base + 30 deg
 *      - split-complementary -> base + 150 deg
 *      - complementary       -> base + 180 deg
 *    Hue is wrapped modulo 360.
 * 3. Reuse the same L / C scale for the alt accent (the legacy "emerald"
 *    triad of base, bright, deep variants).
 * 4. Brand color and brand glow are derived directly from the base hue with
 *    canonical L / C values for "pale luminous tint on dark surfaces" or
 *    "deep saturated tint on light surfaces".
 * 5. Contrast guardrail: convert the candidate accent and the canonical
 *    surface color for the active mode through OKLCH -> OKLab -> linear sRGB
 *    -> gamma sRGB, then compute the WCAG relative luminance and the WCAG
 *    contrast ratio (Lmax+0.05)/(Lmin+0.05). If the accent's contrast against
 *    the surface drops below 3:1 (a perceptible color block, not body text),
 *    push the accent's L away from the surface L in 0.02 increments (up to
 *    20 iterations), then apply the same delta to the -bright and -deep
 *    variants so the triad stays coherent.
 *
 * OKLCH -> sRGB conversion
 * ------------------------
 * Standard pipeline:
 *   OKLCH (L, C, h)
 *     -> OKLab  (L, a = C*cos(h), b = C*sin(h))
 *     -> non-linear LMS' (cube the linear combinations from Bjorn Ottosson's
 *        published OKLab matrix)
 *     -> linear LMS (cube)
 *     -> linear sRGB (apply Ottosson's LMS -> linear sRGB matrix)
 *     -> sRGB gamma (clamp to 0..1, then apply the standard sRGB transfer
 *        function: 12.92*x for x <= 0.0031308, else 1.055*x^(1/2.4) - 0.055)
 *
 * WCAG relative luminance is computed from the gamma-corrected sRGB by
 * inverting the transfer (using the piecewise sRGB -> linear formula) and
 * then taking Y = 0.2126*R + 0.7152*G + 0.0722*B.
 *
 * This module has no DOM access and no third-party color library imports.
 */

export type MixingModel = "analogous" | "split-complementary" | "complementary";
export type ContrastLevel = "AA" | "AAA";
export type ThemeMode = "dark" | "light" | "hybrid" | "system" | "neomorphic";

export interface PaletteRequest {
  mode: ThemeMode;
  model: MixingModel;
  hue: number; // 0-360 base hue
  contrast: ContrastLevel;
}

/**
 * The generated overrides. These names match CSS custom properties in
 * src/styles/tokens.css that the runtime will overwrite for the active theme.
 */
export interface GeneratedPalette {
  // Optional full-page gradient string (palette presets set this to a
  // multi-stop gradient flowing through all the palette colors). When set,
  // global.css body uses it instead of the bg-1..4 stops. Mono swatches
  // leave it undefined.
  "--bg-gradient"?: string;
  "--bg-1": string;
  "--bg-2": string;
  "--bg-3": string;
  "--bg-4": string;
  "--bg-overlay-1": string;
  "--bg-overlay-2": string;
  "--glass-bg": string;
  "--glass-bg-hover": string;
  "--glass-border": string;
  "--glass-border-strong": string;
  "--highlight-top": string;
  "--highlight-top-soft": string;
  "--highlight-bottom": string;
  "--highlight-bottom-soft": string;
  "--shadow-side": string;
  "--neo-surface": string;
  "--neo-shadow-light": string;
  "--neo-shadow-dark": string;
  "--accent-royal": string;
  "--accent-royal-bright": string;
  "--accent-royal-deep": string;
  "--accent-emerald": string;
  "--accent-emerald-bright": string;
  "--accent-emerald-deep": string;
  "--brand-color": string;
  "--brand-glow": string;
  // Text tokens are only emitted by the preset path (palettes define their
  // own text color). Mono swatches leave these undefined so the static
  // theme text tokens apply. applyState clears them on mode/palette switch.
  "--color-fg-primary"?: string;
  "--color-fg-secondary"?: string;
  "--color-fg-tertiary"?: string;
  "--color-fg-muted"?: string;
  // Four distinct vivid tint colors for panel differentiation. Presets draw
  // them from the palette's own colors; mono swatches derive them from hue
  // rotations of the base. Consumed by the .panel-* tint classes in global.css.
  "--panel-c1"?: string;
  "--panel-c2"?: string;
  "--panel-c3"?: string;
  "--panel-c4"?: string;
}

/**
 * Per-mode surface templates (glass surfaces, bevel highlights, neomorphic
 * elevation), sampled from tokens.css. Hues are rotated by the same
 * (baseHue - REFERENCE_HUE) delta as the backgrounds so the whole surface
 * family follows the slider. On dark/light/hybrid most of these are
 * white/black alpha (chroma ~0) so rotation is imperceptible; on
 * neomorphic they carry real warm chroma and rotate visibly with the hue.
 *
 * Always emitted for every mode so switching modes cleanly overwrites any
 * inline overrides left from a previous mode.
 */
interface SurfaceToken { l: number; c: number; h: number; a: number; }
type SurfaceKey =
  | "--glass-bg" | "--glass-bg-hover" | "--glass-border" | "--glass-border-strong"
  | "--highlight-top" | "--highlight-top-soft" | "--highlight-bottom"
  | "--highlight-bottom-soft" | "--shadow-side"
  | "--neo-surface" | "--neo-shadow-light" | "--neo-shadow-dark";

const TRANSPARENT: SurfaceToken = { l: 0, c: 0, h: 0, a: 0 };

const MODE_SURFACES: Record<ResolvedMode["kind"], Record<SurfaceKey, SurfaceToken>> = {
  dark: {
    "--glass-bg": { l: 1, c: 0, h: 0, a: 0.04 },
    "--glass-bg-hover": { l: 1, c: 0, h: 0, a: 0.08 },
    "--glass-border": { l: 1, c: 0, h: 0, a: 0.10 },
    "--glass-border-strong": { l: 1, c: 0, h: 0, a: 0.20 },
    "--highlight-top": { l: 1, c: 0, h: 0, a: 0.95 },
    "--highlight-top-soft": { l: 1, c: 0, h: 0, a: 0.25 },
    "--highlight-bottom": { l: 1, c: 0, h: 0, a: 0.55 },
    "--highlight-bottom-soft": { l: 1, c: 0, h: 0, a: 0.12 },
    "--shadow-side": { l: 0, c: 0, h: 0, a: 0.10 },
    "--neo-surface": { l: 1, c: 0, h: 0, a: 0.04 },
    "--neo-shadow-light": TRANSPARENT,
    "--neo-shadow-dark": TRANSPARENT,
  },
  light: {
    "--glass-bg": { l: 1, c: 0, h: 0, a: 0.55 },
    "--glass-bg-hover": { l: 1, c: 0, h: 0, a: 0.75 },
    "--glass-border": { l: 0.20, c: 0.02, h: 270, a: 0.12 },
    "--glass-border-strong": { l: 0.20, c: 0.02, h: 270, a: 0.22 },
    "--highlight-top": { l: 1, c: 0, h: 0, a: 0.95 },
    "--highlight-top-soft": { l: 1, c: 0, h: 0, a: 0.55 },
    "--highlight-bottom": { l: 0.95, c: 0, h: 0, a: 0.30 },
    "--highlight-bottom-soft": { l: 0.95, c: 0, h: 0, a: 0.10 },
    "--shadow-side": { l: 0.20, c: 0.02, h: 270, a: 0.08 },
    "--neo-surface": { l: 1, c: 0, h: 0, a: 0.55 },
    "--neo-shadow-light": TRANSPARENT,
    "--neo-shadow-dark": TRANSPARENT,
  },
  hybrid: {
    "--glass-bg": { l: 1, c: 0, h: 0, a: 0.08 },
    "--glass-bg-hover": { l: 1, c: 0, h: 0, a: 0.14 },
    // Stronger borders so secondary / ghost buttons keep a defined edge
    // against the saturated mid-tone hybrid surface (they have a subtle fill
    // and rely on the border to separate from the same-hue background).
    "--glass-border": { l: 1, c: 0, h: 0, a: 0.32 },
    "--glass-border-strong": { l: 1, c: 0, h: 0, a: 0.46 },
    "--highlight-top": { l: 1, c: 0, h: 0, a: 0.90 },
    "--highlight-top-soft": { l: 1, c: 0, h: 0, a: 0.35 },
    "--highlight-bottom": { l: 1, c: 0, h: 0, a: 0.50 },
    "--highlight-bottom-soft": { l: 1, c: 0, h: 0, a: 0.14 },
    "--shadow-side": { l: 0, c: 0, h: 0, a: 0.12 },
    "--neo-surface": { l: 1, c: 0, h: 0, a: 0.08 },
    "--neo-shadow-light": TRANSPARENT,
    "--neo-shadow-dark": TRANSPARENT,
  },
  neomorphic: {
    "--glass-bg": { l: 0.92, c: 0.020, h: 70, a: 1 },
    "--glass-bg-hover": { l: 0.94, c: 0.018, h: 70, a: 1 },
    "--glass-border": { l: 0.55, c: 0.060, h: 75, a: 0.22 },
    "--glass-border-strong": { l: 0.40, c: 0.050, h: 72, a: 0.30 },
    "--highlight-top": { l: 0.94, c: 0.080, h: 90, a: 0.85 },
    "--highlight-top-soft": { l: 0.94, c: 0.080, h: 90, a: 0.50 },
    "--highlight-bottom": { l: 0.40, c: 0.050, h: 72, a: 0.15 },
    "--highlight-bottom-soft": { l: 0.40, c: 0.050, h: 72, a: 0.08 },
    "--shadow-side": { l: 0.40, c: 0.050, h: 72, a: 0.22 },
    "--neo-surface": { l: 0.83, c: 0.070, h: 82, a: 1 },
    "--neo-shadow-light": { l: 0.94, c: 0.080, h: 90, a: 0.90 },
    "--neo-shadow-dark": { l: 0.40, c: 0.050, h: 72, a: 0.25 },
  },
};

/**
 * Per-mode background templates, sampled from the locked Phase 1 values in
 * src/styles/tokens.css. The generator rotates these stop hues by
 * (baseHue - REFERENCE_HUE) so that at the default hue (263, royal) the
 * output reproduces the Phase 1 baseline exactly, and moving the hue
 * slider tints the entire page background toward the new hue while
 * preserving each mode's lightness/chroma structure.
 *
 * Neomorphic is rotate:false — its sand surface is locked and does not
 * follow the hue slider (only its accents do). The user explicitly tuned
 * and locked the sand palette.
 */
const REFERENCE_HUE = 263;

interface BgStop { l: number; c: number; h: number; }
interface OverlayStop { l: number; c: number; h: number; a: number; }

const MODE_BACKGROUNDS: Record<
  ResolvedMode["kind"],
  { rotate: boolean; stops: BgStop[]; overlays: OverlayStop[] }
> = {
  dark: {
    rotate: true,
    stops: [
      { l: 0.135, c: 0.052, h: 271 },
      { l: 0.210, c: 0.052, h: 263 },
      { l: 0.190, c: 0.067, h: 265 },
      { l: 0.165, c: 0.066, h: 285 },
    ],
    overlays: [
      { l: 0.70, c: 0.18, h: 263, a: 0.12 },
      { l: 0.55, c: 0.16, h: 305, a: 0.10 },
    ],
  },
  light: {
    rotate: true,
    stops: [
      { l: 0.985, c: 0.005, h: 250 },
      { l: 0.955, c: 0.015, h: 250 },
      { l: 0.970, c: 0.010, h: 220 },
      { l: 0.960, c: 0.012, h: 280 },
    ],
    overlays: [
      { l: 0.65, c: 0.18, h: 263, a: 0.10 },
      { l: 0.68, c: 0.14, h: 305, a: 0.07 },
    ],
  },
  hybrid: {
    // Richer dusk mid-tone. Earlier low-chroma stops read as washed-out grey;
    // these carry real chroma so hybrid is clearly a saturated mid-tone of the
    // selected hue, distinct from both the deep dark and the pale light modes.
    rotate: true,
    stops: [
      { l: 0.360, c: 0.090, h: 260 },
      { l: 0.420, c: 0.085, h: 250 },
      { l: 0.380, c: 0.100, h: 270 },
      { l: 0.400, c: 0.092, h: 280 },
    ],
    overlays: [
      { l: 0.70, c: 0.18, h: 263, a: 0.12 },
      { l: 0.57, c: 0.16, h: 305, a: 0.10 },
    ],
  },
  neomorphic: {
    // Follows the hue slider like the other modes. At the default hue
    // (263) the rotation is zero, so the locked warm-sand surface is
    // preserved as the default; dragging the hue rotates the sand toward
    // the selected hue family.
    rotate: true,
    stops: [
      { l: 0.91, c: 0.06, h: 85 },
      { l: 0.83, c: 0.07, h: 82 },
      { l: 0.83, c: 0.07, h: 82 },
      { l: 0.91, c: 0.06, h: 85 },
    ],
    overlays: [
      { l: 0, c: 0, h: 0, a: 0 },
      { l: 0, c: 0, h: 0, a: 0 },
    ],
  },
};

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface ResolvedMode {
  /** Mode actually used for L / C lookup ("dark" or "light" equivalent). */
  kind: "dark" | "light" | "hybrid" | "neomorphic";
  /** Surface L for contrast check. */
  surfaceL: number;
  /** Text-on-surface L (kept for AA / AAA reference, not used in guardrail). */
  textL: number;
  /** Primary chroma. */
  chroma: number;
  /** L for accent base / bright / deep. */
  L: { base: number; bright: number; deep: number };
}

interface OkLab {
  L: number;
  a: number;
  b: number;
}

interface LinearRgb {
  r: number;
  g: number;
  b: number;
}

// ---------------------------------------------------------------------------
// Mode resolution
// ---------------------------------------------------------------------------

function resolveMode(mode: ThemeMode): ResolvedMode {
  // "system" is supposed to be resolved before reaching this function. If it
  // sneaks through, default to dark, which matches the current site shipping
  // theme.
  const effective: Exclude<ThemeMode, "system"> =
    mode === "system" ? "dark" : mode;

  switch (effective) {
    case "dark":
      return {
        kind: "dark",
        surfaceL: 0.2,
        textL: 0.96,
        chroma: 0.2,
        L: { base: 0.6, bright: 0.69, deep: 0.49 },
      };
    case "hybrid":
      // Accent runs distinctly brighter than the mid-tone hybrid surface
      // (panel ≈ L0.43). Earlier the deep stop (0.49) sat right on top of the
      // panel, so accent buttons melted into the same-hue background under the
      // analogous and complementary models. Lifting the whole triad makes the
      // button read as a clearly raised, lit element regardless of hue match.
      return {
        kind: "hybrid",
        surfaceL: 0.50,
        textL: 0.97,
        chroma: 0.22,
        L: { base: 0.68, bright: 0.78, deep: 0.60 },
      };
    case "light":
      return {
        kind: "light",
        surfaceL: 0.95,
        textL: 0.22,
        chroma: 0.215,
        L: { base: 0.5, bright: 0.58, deep: 0.42 },
      };
    case "neomorphic":
      return {
        kind: "neomorphic",
        surfaceL: 0.88,
        textL: 0.32,
        chroma: 0.18,
        L: { base: 0.5, bright: 0.58, deep: 0.42 },
      };
  }
}

// ---------------------------------------------------------------------------
// Hue mixing
// ---------------------------------------------------------------------------

function wrapHue(h: number): number {
  const wrapped = h % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/**
 * Primary accent hue: rotated away from the base by the mixing-model
 * angle. The background sits at the base hue; the accent sits at this
 * derived hue so it reads as a deliberate contrasting accent.
 *   analogous           -> base + 30  (subtle, harmonious)
 *   split-complementary -> base + 150 (strong)
 *   complementary       -> base + 180 (maximum contrast)
 */
function accentHueFor(model: MixingModel, baseHue: number): number {
  switch (model) {
    case "analogous":
      return wrapHue(baseHue + 30);
    case "split-complementary":
      return wrapHue(baseHue + 150);
    case "complementary":
      return wrapHue(baseHue + 180);
  }
}

// ---------------------------------------------------------------------------
// OKLCH -> OKLab -> linear sRGB -> gamma sRGB -> WCAG luminance
// ---------------------------------------------------------------------------

function oklchToLab(L: number, C: number, hDeg: number): OkLab {
  const hRad = (hDeg * Math.PI) / 180;
  return {
    L,
    a: C * Math.cos(hRad),
    b: C * Math.sin(hRad),
  };
}

/**
 * Bjorn Ottosson's OKLab -> linear sRGB conversion.
 * Reference: https://bottosson.github.io/posts/oklab/
 */
function oklabToLinearRgb(lab: OkLab): LinearRgb {
  const l_ = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const m_ = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const s_ = lab.L - 0.0894841775 * lab.a - 1.291485548 * lab.b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/**
 * Linear sRGB component -> gamma-encoded sRGB component (0..1).
 */
function linearToSrgb(x: number): number {
  const c = clamp01(x);
  if (c <= 0.0031308) return 12.92 * c;
  return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/**
 * Gamma-encoded sRGB component (0..1) -> linear sRGB component (0..1).
 * Used by the WCAG relative luminance formula.
 */
function srgbToLinear(x: number): number {
  const c = clamp01(x);
  if (c <= 0.04045) return c / 12.92;
  return Math.pow((c + 0.055) / 1.055, 2.4);
}

interface SrgbTriplet {
  r: number;
  g: number;
  b: number;
}

function oklchToSrgb(L: number, C: number, hDeg: number): SrgbTriplet {
  const lab = oklchToLab(L, C, hDeg);
  const lin = oklabToLinearRgb(lab);
  return {
    r: linearToSrgb(lin.r),
    g: linearToSrgb(lin.g),
    b: linearToSrgb(lin.b),
  };
}

function relativeLuminance(rgb: SrgbTriplet): number {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function wcagContrast(a: SrgbTriplet, b: SrgbTriplet): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const Lmax = Math.max(la, lb);
  const Lmin = Math.min(la, lb);
  return (Lmax + 0.05) / (Lmin + 0.05);
}

/**
 * Public helper: contrast ratio between two OKLCH triples (chroma + hue are
 * embedded in the inputs). Kept as a named utility per the spec note about
 * `oklchToContrast` for callers that want to introspect the math.
 */
export function oklchToContrast(
  a: { L: number; C: number; h: number },
  b: { L: number; C: number; h: number },
): number {
  return wcagContrast(
    oklchToSrgb(a.L, a.C, a.h),
    oklchToSrgb(b.L, b.C, b.h),
  );
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function round(n: number, digits: number): number {
  const k = Math.pow(10, digits);
  return Math.round(n * k) / k;
}

function formatOklch(
  L: number,
  C: number,
  h: number,
  alpha?: number,
): string {
  const Lr = round(L, 3);
  const Cr = round(C, 3);
  const hr = round(h, 1);
  if (alpha === undefined || alpha >= 1) {
    return `oklch(${Lr} ${Cr} ${hr})`;
  }
  const ar = round(alpha, 2);
  return `oklch(${Lr} ${Cr} ${hr} / ${ar})`;
}

/**
 * Four distinct, vivid tint colours used to differentiate stacked/nested
 * panels. Built from a list of source hues (a palette's own colours, or hue
 * rotations of a mono base) and normalized to a consistent vivid L/C so they
 * read clearly as tints over any surface in any mode. Pads to four by rotating
 * the supplied hues when fewer than four are available.
 */
function panelTintColors(hues: number[]): [string, string, string, string] {
  const seed = hues.filter((h) => Number.isFinite(h));
  const base = seed.length > 0 ? seed : [263, 153, 320, 85];
  const picked: number[] = [];
  let rot = 0;
  while (picked.length < 4) {
    for (const h of base) {
      picked.push(wrapHue(h + rot));
      if (picked.length >= 4) break;
    }
    rot += 45;
  }
  return [
    formatOklch(0.62, 0.17, picked[0]),
    formatOklch(0.62, 0.17, picked[1]),
    formatOklch(0.62, 0.17, picked[2]),
    formatOklch(0.62, 0.17, picked[3]),
  ];
}

// ---------------------------------------------------------------------------
// Contrast guardrail
// ---------------------------------------------------------------------------

/**
 * Adjust the base accent L away from the surface L until the contrast against
 * the surface reaches 3:1. Returns the delta applied (signed). Cap 20 steps.
 */
function adjustForSurfaceContrast(
  baseL: number,
  C: number,
  hue: number,
  surfaceL: number,
): number {
  const surface = oklchToSrgb(surfaceL, 0, hue);
  let candidateL = baseL;
  // Push lighter if surface is dark, darker if surface is light.
  const direction = surfaceL < 0.5 ? +1 : -1;

  let iterations = 0;
  while (iterations < 20) {
    const accent = oklchToSrgb(candidateL, C, hue);
    const ratio = wcagContrast(accent, surface);
    if (ratio >= 3.0) break;
    candidateL = clamp01(candidateL + direction * 0.02);
    iterations += 1;
    if (candidateL === 0 || candidateL === 1) break;
  }
  return candidateL - baseL;
}

// ---------------------------------------------------------------------------
// Brand color + brand glow
// ---------------------------------------------------------------------------

function brandColorFor(kind: ResolvedMode["kind"], baseHue: number): string {
  // Dark / hybrid: pale luminous tint. Light / neomorphic: deep saturated tint.
  if (kind === "dark" || kind === "hybrid") {
    return formatOklch(0.945, 0.02, baseHue, 0.92);
  }
  return formatOklch(0.32, 0.18, baseHue, 0.95);
}

function brandGlowFor(kind: ResolvedMode["kind"], baseHue: number): string {
  if (kind === "dark" || kind === "hybrid") {
    return formatOklch(0.87, 0.06, baseHue, 0.55);
  }
  return formatOklch(0.55, 0.18, baseHue, 0.2);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Palette preset path (multi-color schemes, bypass the mixing model)
// ---------------------------------------------------------------------------

interface ParsedOklch { l: number; c: number; h: number; a: number; }

function parseOklch(value: string): ParsedOklch | null {
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

// ---------------------------------------------------------------------------
// WCAG text-readability guarantee (HARD RULE)
//
// Body text must always meet WCAG contrast against every surface it can sit
// on (panels AND the page background). If the authored text color fails, we
// fail over to black or white — whichever maximizes the minimum contrast
// across all surfaces. Translucent text tokens (secondary/tertiary/muted)
// then have their alpha raised until their composited contrast also passes.
// AA = 4.5:1 (default); AAA = 7:1. On mid-tone surfaces 7:1 is sometimes
// mathematically unreachable for any color, so AAA is best-effort while AA
// is guaranteed.
// ---------------------------------------------------------------------------

const FAILOVER_BLACK: ParsedOklch = { l: 0.16, c: 0.006, h: 270, a: 1 };
const FAILOVER_WHITE: ParsedOklch = { l: 0.985, c: 0.001, h: 240, a: 1 };

function textThreshold(contrast: ContrastLevel | undefined): number {
  return contrast === "AAA" ? 7 : 4.5;
}

function srgbOf(p: ParsedOklch): SrgbTriplet {
  return oklchToSrgb(p.l, p.c, p.h);
}

function minContrastAcross(text: SrgbTriplet, surfaces: SrgbTriplet[]): number {
  let lowest = Infinity;
  for (const s of surfaces) lowest = Math.min(lowest, wcagContrast(text, s));
  return lowest === Infinity ? 21 : lowest;
}

/**
 * Return a guaranteed-readable text color. Keeps the authored color if it
 * already clears the threshold against every surface; otherwise fails over
 * to black or white, picking whichever yields the higher minimum contrast.
 */
function guaranteeTextColor(
  text: ParsedOklch,
  surfaces: ParsedOklch[],
  threshold: number,
): ParsedOklch {
  if (surfaces.length === 0) return text;
  const surfRgbs = surfaces.map(srgbOf);
  if (minContrastAcross(srgbOf(text), surfRgbs) >= threshold) return text;
  const blackMin = minContrastAcross(srgbOf(FAILOVER_BLACK), surfRgbs);
  const whiteMin = minContrastAcross(srgbOf(FAILOVER_WHITE), surfRgbs);
  return whiteMin >= blackMin ? FAILOVER_WHITE : FAILOVER_BLACK;
}

/** The surface (among the set) that contrasts least with the given text. */
function worstSurfaceFor(text: ParsedOklch, surfaces: ParsedOklch[]): ParsedOklch {
  const t = srgbOf(text);
  let worst = surfaces[0];
  let worstRatio = Infinity;
  for (const s of surfaces) {
    const r = wcagContrast(t, srgbOf(s));
    if (r < worstRatio) { worstRatio = r; worst = s; }
  }
  return worst;
}

/** Gamma-sRGB composite of translucent text painted over a surface. */
function blendOver(text: SrgbTriplet, surf: SrgbTriplet, alpha: number): SrgbTriplet {
  return {
    r: text.r * alpha + surf.r * (1 - alpha),
    g: text.g * alpha + surf.g * (1 - alpha),
    b: text.b * alpha + surf.b * (1 - alpha),
  };
}

/**
 * Lowest alpha >= desired whose composited text meets the threshold against
 * the worst surface. Caps at 1. Because the base text color is guaranteed to
 * pass at full opacity, this always terminates with a passing alpha.
 */
function alphaForContrast(
  text: ParsedOklch,
  worstSurf: ParsedOklch,
  desired: number,
  threshold: number,
): number {
  const t = srgbOf(text);
  const s = srgbOf(worstSurf);
  let a = desired;
  for (let i = 0; i < 50 && a < 1; i++) {
    if (wcagContrast(blendOver(t, s, a), s) >= threshold) return round(a, 2);
    a += 0.02;
  }
  return 1;
}

/**
 * Each palette specifies EXACT colors per mode (no auto-transform). A scheme
 * assigns the palette's colors to surfaces: bg (background gradient), panel,
 * text (body text), accents. dark and light are authored explicitly so the
 * designer controls e.g. "Patriotic light = white bg, navy text, red accent."
 * hybrid and neomorphic are derived to stay distinct: hybrid lifts the dark
 * scheme to a mid-tone dusk; neomorphic mutes the light scheme to a flat,
 * sandy, soft-shadow surface.
 */
export interface PaletteScheme {
  bg: string[];      // background colors (1 = flat, 2+ = gradient)
  panel: string[];   // panel surface colors
  text: string;      // body text color
  accents: string[]; // [0] primary accent, [1] secondary
}

export interface PresetRoles {
  dark: PaletteScheme;
  light: PaletteScheme;
}

type ModeKind = "dark" | "light" | "hybrid" | "neomorphic";

function modeKind(mode: ThemeMode): ModeKind {
  return mode === "system" ? "dark" : mode;
}

/** Hybrid = mid-tone dusk between dark and light. Lifts the dark scheme's
 *  bg/panel into the low-mid range: clearly lighter than dark, but still dark
 *  enough that the (white) text keeps AA contrast. Keeps the palette hues, so
 *  the theme identity carries through. */
function deriveHybrid(dark: PaletteScheme): PaletteScheme {
  const lift = (s: string) => {
    const p = parseOklch(s);
    if (!p) return s;
    return formatOklch(clamp01(0.26 + p.l * 0.24), p.c * 0.95, p.h, p.a);
  };
  return { bg: dark.bg.map(lift), panel: dark.panel.map(lift), text: dark.text, accents: dark.accents };
}

/** Neomorphic = soft monochrome surface in the palette's hue. bg and panel
 *  share one light, low-chroma tone, separated only by the soft-shadow tokens
 *  applied downstream (classic neomorphism). A faint hue tint plus the vivid
 *  accents keep the theme identity, while the single-tone surface makes it
 *  clearly distinct from light's gradient bg + colored panels. */
function deriveNeo(light: PaletteScheme): PaletteScheme {
  const firstBg = parseOklch(light.bg[0]) ?? { l: 0.9, c: 0.02, h: 80, a: 1 };
  const tone = formatOklch(0.91, Math.min(firstBg.c * 0.5, 0.045), firstBg.h);
  return { bg: [tone], panel: [tone], text: light.text, accents: light.accents };
}

export function generatePresetPalette(
  colors: string[],
  mode: ThemeMode,
  roles?: PresetRoles,
  contrast?: ContrastLevel,
): GeneratedPalette {
  const kind = modeKind(mode);
  const isNeo = kind === "neomorphic";
  const textDark = kind === "light" || kind === "neomorphic";

  // Fallback scheme if a palette has no explicit roles.
  const fallback: PresetRoles = (() => {
    const ps = colors.map(parseOklch).filter((x): x is ParsedOklch => x !== null);
    const byC = [...ps].sort((a, b) => b.c - a.c);
    const acc = byC.slice(0, 2).map((p) => formatOklch(p.l, p.c, p.h));
    return {
      dark: { bg: [colors[0]], panel: [colors[Math.min(1, colors.length - 1)]], text: "oklch(0.98 0.002 240)", accents: acc },
      light: { bg: [colors[colors.length - 1]], panel: ["oklch(0.97 0.005 270)"], text: "oklch(0.18 0.01 270)", accents: acc },
    };
  })();
  const rr = roles ?? fallback;

  // Pick the scheme for the active mode (hybrid/neo derived for distinctness).
  let scheme: PaletteScheme;
  switch (kind) {
    case "dark":       scheme = rr.dark; break;
    case "light":      scheme = rr.light; break;
    case "hybrid":     scheme = deriveHybrid(rr.dark); break;
    case "neomorphic": scheme = deriveNeo(rr.light); break;
  }

  const parse = (s: string) => parseOklch(s) ?? { l: 0.5, c: 0.1, h: 263, a: 1 };
  const f = (p: ParsedOklch, a?: number) => formatOklch(p.l, p.c, p.h, a ?? p.a);
  const sh = (p: ParsedOklch, dl: number) => formatOklch(clamp01(p.l + dl), p.c, p.h);

  // Panel tint set: drawn from the palette's own chromatic colours (most
  // palettes have 4+), so stacked panels each pick a distinct real colour.
  const paletteHues = colors
    .map(parseOklch)
    .filter((x): x is ParsedOklch => x !== null && x.c > 0.045)
    .map((x) => x.h);
  const presetTints = panelTintColors(paletteHues);

  // Background gradient: exact scheme colors (no transform).
  const bgStops = scheme.bg.map((c) => f(parse(c), 1));
  const bgFull = bgStops.length >= 2 ? bgStops : [bgStops[0], bgStops[0]];
  const bgGradient = `linear-gradient(135deg, ${bgFull.join(", ")})`;

  // Panels: exact scheme colors. Solid for neomorphic, near-opaque otherwise.
  const panelAlpha = isNeo ? 1 : 0.92;
  const panelStops = scheme.panel.map((c) => {
    const p = parse(c);
    return formatOklch(p.l, p.c, p.h, panelAlpha);
  });
  const panelBg = panelStops.length >= 2 ? `linear-gradient(135deg, ${panelStops.join(", ")})` : panelStops[0];
  const panelHoverStops = scheme.panel.map((c) => {
    const p = parse(c);
    return formatOklch(clamp01(p.l + (textDark ? -0.04 : 0.05)), p.c, p.h, panelAlpha);
  });
  const panelHover = panelHoverStops.length >= 2 ? `linear-gradient(135deg, ${panelHoverStops.join(", ")})` : panelHoverStops[0];

  // WCAG text guarantee. The text must read against every surface it can sit
  // on: the panel(s) AND the page background gradient stops. If the authored
  // text fails, fail over to black/white; then raise each token's alpha until
  // its composited contrast also clears the threshold.
  const threshold = textThreshold(contrast);
  const textSurfaces = [...scheme.bg, ...scheme.panel].map(parse);
  const textP = guaranteeTextColor(parse(scheme.text), textSurfaces, threshold);
  const worstSurf = worstSurfaceFor(textP, textSurfaces);
  const aPrimary = alphaForContrast(textP, worstSurf, 0.97, threshold);
  const aSecondary = alphaForContrast(textP, worstSurf, 0.86, threshold);
  const aTertiary = alphaForContrast(textP, worstSurf, 0.70, threshold);
  const aMuted = alphaForContrast(textP, worstSurf, 0.54, threshold);
  const ta = (a: number) => formatOklch(textP.l, textP.c, textP.h, a);

  const aP = parse(scheme.accents[0] ?? "oklch(0.6 0.18 263)");
  const a2P = parse(scheme.accents[Math.min(1, scheme.accents.length - 1)] ?? scheme.accents[0] ?? "oklch(0.6 0.18 263)");

  return {
    "--bg-gradient": bgGradient,
    "--bg-1": bgFull[0],
    "--bg-2": bgFull[Math.min(1, bgFull.length - 1)],
    "--bg-3": bgFull[Math.floor(bgFull.length / 2)],
    "--bg-4": bgFull[bgFull.length - 1],
    "--bg-overlay-1": "transparent",
    "--bg-overlay-2": "transparent",
    "--glass-bg": panelBg,
    "--glass-bg-hover": panelHover,
    "--glass-border": ta(0.20),
    "--glass-border-strong": ta(0.34),
    "--highlight-top": textDark ? "oklch(1 0 0 / 0.85)" : "oklch(1 0 0 / 0.5)",
    "--highlight-top-soft": "oklch(1 0 0 / 0.28)",
    "--highlight-bottom": textDark ? "oklch(0.95 0 0 / 0.3)" : "oklch(1 0 0 / 0.35)",
    "--highlight-bottom-soft": "oklch(1 0 0 / 0.1)",
    "--shadow-side": isNeo ? "oklch(0.35 0.04 80 / 0.20)" : "oklch(0 0 0 / 0.14)",
    "--neo-surface": panelStops[0] ?? bgFull[0],
    "--neo-shadow-light": isNeo ? "oklch(1 0 0 / 0.85)" : "oklch(1 0 0 / 0.7)",
    "--neo-shadow-dark": isNeo ? "oklch(0.40 0.04 80 / 0.18)" : "oklch(0 0 0 / 0.18)",
    "--accent-royal": f(aP),
    "--accent-royal-bright": sh(aP, +0.08),
    "--accent-royal-deep": sh(aP, -0.10),
    "--accent-emerald": f(a2P),
    "--accent-emerald-bright": sh(a2P, +0.08),
    "--accent-emerald-deep": sh(a2P, -0.10),
    "--brand-color": ta(Math.max(0.95, aPrimary)),
    "--brand-glow": f(aP, 0.4),
    "--color-fg-primary": ta(aPrimary),
    "--color-fg-secondary": ta(aSecondary),
    "--color-fg-tertiary": ta(aTertiary),
    "--color-fg-muted": ta(aMuted),
    "--panel-c1": presetTints[0],
    "--panel-c2": presetTints[1],
    "--panel-c3": presetTints[2],
    "--panel-c4": presetTints[3],
  };
}

export function generatePalette(request: PaletteRequest): GeneratedPalette {
  const resolved = resolveMode(request.mode);
  const baseHue = wrapHue(request.hue);
  // The selected hue IS the primary, dominant theme color. The background AND
  // the primary accent both sit at the base hue, so picking red gives a
  // red-dominant site. The mixing model only derives the SECONDARY accent
  // (and the atmospheric glow), so it still visibly changes the palette
  // without ever flipping the dominant color (red must never read as green).
  const primaryHue = baseHue;
  const secondaryHue = accentHueFor(request.model, baseHue);

  // Background regeneration. For glass modes the gradient TRAVELS from the
  // base hue (leading, dominant stop) toward the mixing-model's secondary
  // hue at the trailing stop — back-loaded (exponent 1.4) so the base hue
  // occupies most of the gradient. This makes the mixing-model choice clearly
  // visible across the whole page background while the base hue stays
  // dominant. Neomorphic keeps its sand template (rotated by the slider) so
  // the locked warm-sand default is preserved.
  const bgConfig = MODE_BACKGROUNDS[resolved.kind];
  const isNeoMode = resolved.kind === "neomorphic";
  const rotation = bgConfig.rotate ? baseHue - REFERENCE_HUE : 0;
  // Each mixing model paints a structurally DIFFERENT gradient, all leading
  // with the base hue (dominant). The four numbers are per-stop hue offsets
  // from the base hue:
  //   analogous           — a tight single-family sweep (calm, harmonious)
  //   split-complementary — base + the TWO hues flanking the complement
  //                         (±30° around 180°): a colourful 3-hue gradient
  //   complementary       — a clean base↔complement two-tone (bold duotone)
  // The escalating spread (≈36° → ≈210° span → 180° hard split) makes the
  // three models read as clearly distinct styles.
  const stopOffsets =
    request.model === "analogous" ? [0, 12, 24, 36]
    : request.model === "split-complementary" ? [0, 150, 210, 150]
    : [0, 0, 180, 180];
  const bg = bgConfig.stops.map((s, i) => {
    if (isNeoMode) return formatOklch(s.l, s.c, wrapHue(s.h + rotation));
    const off = stopOffsets[Math.min(i, stopOffsets.length - 1)];
    return formatOklch(s.l, s.c, wrapHue(baseHue + off));
  });
  // overlay-1 follows the base hue; overlay-2 echoes the secondary
  // (mixing-model) accent so the model choice also shows in the page glow.
  // overlay-2 alpha is boosted so the secondary hue reads even in pale modes.
  const overlays = bgConfig.overlays.map((o, i) => {
    if (o.a <= 0) return "transparent";
    const oHue = i === 1 ? secondaryHue : wrapHue(o.h + rotation);
    const oAlpha = i === 1 ? Math.min(o.a * 1.9, 0.32) : o.a;
    return formatOklch(o.l, o.c, oHue, oAlpha);
  });

  // Surfaces (glass + highlights + neomorphic elevation): rotate each
  // token's hue by the same delta so the whole surface family follows the
  // slider. Neutral (chroma 0) tokens are unaffected; neomorphic's warm
  // surfaces rotate visibly so its panels track the hue instead of staying
  // locked to sand.
  const surfaceTemplate = MODE_SURFACES[resolved.kind];
  const surfaces = {} as Record<SurfaceKey, string>;
  for (const key of Object.keys(surfaceTemplate) as SurfaceKey[]) {
    const t = surfaceTemplate[key];
    if (t.a <= 0) {
      surfaces[key] = "transparent";
    } else {
      surfaces[key] = formatOklch(t.l, t.c, wrapHue(t.h + rotation), t.a);
    }
  }

  // Initial L values for primary accent triad.
  const Lbase = resolved.L.base;
  const Lbright = resolved.L.bright;
  const Ldeep = resolved.L.deep;
  const C = resolved.chroma;

  // Contrast guardrail: shift the primary accent away from the surface L if
  // the candidate accent fails the 3:1 floor. Apply the same delta to bright
  // and deep so the triad stays coherent.
  const delta = adjustForSurfaceContrast(Lbase, C, primaryHue, resolved.surfaceL);
  const LbaseAdj = clamp01(Lbase + delta);
  const LbrightAdj = clamp01(Lbright + delta);
  const LdeepAdj = clamp01(Ldeep + delta);

  // Apply the same delta to the alt accent so the two triads stay visually
  // balanced under the same surface conditions.
  const LbaseAlt = clamp01(Lbase + delta);
  const LbrightAlt = clamp01(Lbright + delta);
  const LdeepAlt = clamp01(Ldeep + delta);

  // Optional AAA nudge: if AAA contrast was requested and the accent still
  // sits below 4.5:1 against the surface after the 3:1 guardrail, push one
  // more step (cap one extra to avoid runaway). This keeps the request.contrast
  // parameter meaningful without overpowering the visual identity.
  let LbasePrim = LbaseAdj;
  let LbrightPrim = LbrightAdj;
  let LdeepPrim = LdeepAdj;
  if (request.contrast === "AAA") {
    const surface = oklchToSrgb(resolved.surfaceL, 0, primaryHue);
    const accent = oklchToSrgb(LbasePrim, C, primaryHue);
    const ratio = wcagContrast(accent, surface);
    if (ratio < 4.5) {
      const direction = resolved.surfaceL < 0.5 ? +1 : -1;
      LbasePrim = clamp01(LbasePrim + direction * 0.02);
      LbrightPrim = clamp01(LbrightPrim + direction * 0.02);
      LdeepPrim = clamp01(LdeepPrim + direction * 0.02);
    }
  }

  // Panel tint set: four hue rotations of the base (using the mixing-model
  // relationships) so stacked panels read as distinct colours.
  const monoTints = panelTintColors([
    baseHue,
    wrapHue(baseHue + 30),
    wrapHue(baseHue + 150),
    wrapHue(baseHue + 210),
  ]);

  return {
    "--panel-c1": monoTints[0],
    "--panel-c2": monoTints[1],
    "--panel-c3": monoTints[2],
    "--panel-c4": monoTints[3],
    "--bg-1": bg[0],
    "--bg-2": bg[1],
    "--bg-3": bg[2],
    "--bg-4": bg[3],
    "--bg-overlay-1": overlays[0],
    "--bg-overlay-2": overlays[1],
    "--glass-bg": surfaces["--glass-bg"],
    "--glass-bg-hover": surfaces["--glass-bg-hover"],
    "--glass-border": surfaces["--glass-border"],
    "--glass-border-strong": surfaces["--glass-border-strong"],
    "--highlight-top": surfaces["--highlight-top"],
    "--highlight-top-soft": surfaces["--highlight-top-soft"],
    "--highlight-bottom": surfaces["--highlight-bottom"],
    "--highlight-bottom-soft": surfaces["--highlight-bottom-soft"],
    "--shadow-side": surfaces["--shadow-side"],
    "--neo-surface": surfaces["--neo-surface"],
    "--neo-shadow-light": surfaces["--neo-shadow-light"],
    "--neo-shadow-dark": surfaces["--neo-shadow-dark"],
    "--accent-royal": formatOklch(LbasePrim, C, primaryHue),
    "--accent-royal-bright": formatOklch(LbrightPrim, C, primaryHue),
    "--accent-royal-deep": formatOklch(LdeepPrim, C, primaryHue),
    "--accent-emerald": formatOklch(LbaseAlt, C, secondaryHue),
    "--accent-emerald-bright": formatOklch(LbrightAlt, C, secondaryHue),
    "--accent-emerald-deep": formatOklch(LdeepAlt, C, secondaryHue),
    "--brand-color": brandColorFor(resolved.kind, baseHue),
    "--brand-glow": brandGlowFor(resolved.kind, baseHue),
  };
}
