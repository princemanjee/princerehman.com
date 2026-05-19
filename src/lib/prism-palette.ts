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
  "--bg-1": string;
  "--bg-2": string;
  "--bg-3": string;
  "--bg-4": string;
  "--bg-overlay-1": string;
  "--bg-overlay-2": string;
  "--accent-royal": string;
  "--accent-royal-bright": string;
  "--accent-royal-deep": string;
  "--accent-emerald": string;
  "--accent-emerald-bright": string;
  "--accent-emerald-deep": string;
  "--brand-color": string;
  "--brand-glow": string;
}

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
    rotate: true,
    stops: [
      { l: 0.400, c: 0.030, h: 260 },
      { l: 0.450, c: 0.028, h: 250 },
      { l: 0.420, c: 0.040, h: 270 },
      { l: 0.435, c: 0.035, h: 280 },
    ],
    overlays: [
      { l: 0.70, c: 0.18, h: 263, a: 0.10 },
      { l: 0.57, c: 0.15, h: 305, a: 0.08 },
    ],
  },
  neomorphic: {
    rotate: false,
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
      return {
        kind: "hybrid",
        surfaceL: 0.42,
        textL: 0.97,
        chroma: 0.22,
        L: { base: 0.6, bright: 0.69, deep: 0.49 },
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

function altHueFor(model: MixingModel, baseHue: number): number {
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

export function generatePalette(request: PaletteRequest): GeneratedPalette {
  const resolved = resolveMode(request.mode);
  const baseHue = wrapHue(request.hue);
  const altHue = altHueFor(request.model, baseHue);

  // Background regeneration: rotate the mode's template stop hues by the
  // delta from the reference hue so the default hue reproduces Phase 1
  // exactly and other hues tint the whole page. Neomorphic is exempt.
  const bgConfig = MODE_BACKGROUNDS[resolved.kind];
  const rotation = bgConfig.rotate ? baseHue - REFERENCE_HUE : 0;
  const bg = bgConfig.stops.map((s) =>
    formatOklch(s.l, s.c, wrapHue(s.h + rotation)),
  );
  // overlay-1 follows the base hue (rotated); overlay-2 follows the
  // mixing-model alt hue so the secondary atmospheric glow visibly
  // reflects the chosen model (analogous / split-comp / complementary).
  const overlays = bgConfig.overlays.map((o, i) => {
    if (o.a <= 0) return "transparent";
    const oHue = i === 1 && bgConfig.rotate ? altHue : wrapHue(o.h + rotation);
    return formatOklch(o.l, o.c, oHue, o.a);
  });

  // Initial L values for primary accent triad.
  const Lbase = resolved.L.base;
  const Lbright = resolved.L.bright;
  const Ldeep = resolved.L.deep;
  const C = resolved.chroma;

  // Contrast guardrail: shift the primary accent away from the surface L if
  // the candidate accent fails the 3:1 floor. Apply the same delta to bright
  // and deep so the triad stays coherent.
  const delta = adjustForSurfaceContrast(Lbase, C, baseHue, resolved.surfaceL);
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
    const surface = oklchToSrgb(resolved.surfaceL, 0, baseHue);
    const accent = oklchToSrgb(LbasePrim, C, baseHue);
    const ratio = wcagContrast(accent, surface);
    if (ratio < 4.5) {
      const direction = resolved.surfaceL < 0.5 ? +1 : -1;
      LbasePrim = clamp01(LbasePrim + direction * 0.02);
      LbrightPrim = clamp01(LbrightPrim + direction * 0.02);
      LdeepPrim = clamp01(LdeepPrim + direction * 0.02);
    }
  }

  return {
    "--bg-1": bg[0],
    "--bg-2": bg[1],
    "--bg-3": bg[2],
    "--bg-4": bg[3],
    "--bg-overlay-1": overlays[0],
    "--bg-overlay-2": overlays[1],
    "--accent-royal": formatOklch(LbasePrim, C, baseHue),
    "--accent-royal-bright": formatOklch(LbrightPrim, C, baseHue),
    "--accent-royal-deep": formatOklch(LdeepPrim, C, baseHue),
    "--accent-emerald": formatOklch(LbaseAlt, C, altHue),
    "--accent-emerald-bright": formatOklch(LbrightAlt, C, altHue),
    "--accent-emerald-deep": formatOklch(LdeepAlt, C, altHue),
    "--brand-color": brandColorFor(resolved.kind, baseHue),
    "--brand-glow": brandGlowFor(resolved.kind, baseHue),
  };
}
