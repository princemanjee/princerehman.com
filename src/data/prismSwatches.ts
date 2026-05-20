/**
 * Prism starter swatches — canonical source.
 *
 * This module is the single source of truth for the Phase 2 starter swatch
 * set. It is consumed by:
 *
 *   - src/pages/styleguide/swatches.astro
 *       The curation/exploration page. Currently defines its swatch data
 *       inline; a follow-up commit will switch it to import from here.
 *   - src/components/PrismPanel.astro (Phase 2)
 *       The Prism control surface renders quick-select swatch buttons from
 *       this list so the panel and the styleguide never drift.
 *   - The scheduled-default config (Phase 2)
 *       Date-driven defaults reference swatches by `id` (e.g. switch to
 *       "halloween" in October, "christmas" in December). Stable ids here
 *       are the contract that schedule depends on.
 *
 * Two swatch types:
 *   - mono: a single OKLCH base hue. The generator renders it with two
 *     analogous neighbors (±30°) by default. Optional `extras` hold fixed
 *     accent colors that ride alongside the generated triplet (used by
 *     "royal-default" to keep White + Gold next to Royal Blue).
 *   - palette: a fixed multi-color preset (Halloween, Christmas, Pride,
 *     etc.) that bypasses the mixing-model generator entirely. Groups
 *     support sub-labels for layered palettes like Pride.
 *
 * Pure TypeScript. No DOM, no Astro, no runtime dependencies.
 *
 * IMPORTANT: Do not mutate ids, reorder entries, or alter OKLCH values
 * without coordinating with the schedule config and the styleguide. The
 * locked starter set is canonical.
 */

export interface MonoSwatch {
  id: string;
  name: string;
  vibe: string[];
  type: "mono";
  oklch: { l: number; c: number; h: number };
  extras?: { name: string; value: string }[];
  note?: string;
}

/**
 * Explicit role mapping for a palette (option B). Each role carries a
 * dark-mode and light-mode value so the same palette flips arrangement by
 * theme mode (e.g. Patriotic: navy bg + white text on dark, white bg +
 * navy text on light). Accents are mode-independent (already chosen to
 * read on both). Values are OKLCH strings; they may be the palette's own
 * colors or tuned variants for contrast. When present, the preset
 * generator uses these instead of auto-deriving roles by lightness.
 */
export interface PaletteRoles {
  bg: { dark: string; light: string };
  surface: { dark: string; light: string };
  text: { dark: string; light: string };
  accent: string;
  accent2: string;
}

export interface PaletteSwatch {
  id: string;
  name: string;
  vibe: string[];
  type: "palette";
  groups: { label?: string; colors: { name: string; value: string }[] }[];
  roles?: PaletteRoles;
  note?: string;
}

export type Swatch = MonoSwatch | PaletteSwatch;

export const swatches: Swatch[] = [
  { id: "royal-default", name: "Royal Default", type: "mono",
    oklch: { l: 0.50, c: 0.18, h: 263 },
    vibe: ["professional", "brand"], note: "Current launch default" },
  { id: "royal-gold", name: "Royal & Gold", type: "palette",
    groups: [{ colors: [
      { name: "Royal Blue", value: "oklch(0.50 0.18 263)" },
      { name: "White",      value: "oklch(0.98 0.002 240)" },
      { name: "Gold",       value: "oklch(0.75 0.16 85)" },
      { name: "Navy",       value: "oklch(0.25 0.12 250)" },
      { name: "Emerald",    value: "oklch(0.55 0.13 153)" },
      { name: "Ruby",       value: "oklch(0.42 0.20 15)" },
    ]}],
    vibe: ["professional", "brand", "regal"],
    roles: {
      // Royal blue IS the background/panels so royal is unmistakably present;
      // gold is the primary accent, brighter royal the secondary.
      bg:      { dark: "oklch(0.30 0.16 263)", light: "oklch(0.98 0.002 250)" },
      surface: { dark: "oklch(0.40 0.17 263)", light: "oklch(0.93 0.06 263)" },
      text:    { dark: "oklch(0.98 0.002 240)", light: "oklch(0.30 0.16 263)" },
      accent:  "oklch(0.74 0.15 85)",
      accent2: "oklch(0.60 0.17 263)",
    } },
  { id: "navy-blue", name: "Navy Blue", type: "mono",
    oklch: { l: 0.25, c: 0.12, h: 250 }, vibe: ["professional", "deep"] },
  { id: "charcoal-noir", name: "Charcoal Noir", type: "palette",
    groups: [{ colors: [
      { name: "Jet",      value: "oklch(0.12 0.005 270)" },
      { name: "Charcoal", value: "oklch(0.28 0.020 270)" },
      { name: "Smoke",    value: "oklch(0.45 0.015 270)" },
      { name: "Ash",      value: "oklch(0.62 0.010 270)" },
      { name: "Crimson",  value: "oklch(0.45 0.180 25)" },
    ]}],
    vibe: ["noir", "professional", "moody"],
    roles: {
      bg:      { dark: "oklch(0.12 0.005 270)", light: "oklch(0.90 0.004 270)" },
      surface: { dark: "oklch(0.28 0.020 270)", light: "oklch(0.80 0.006 270)" },
      text:    { dark: "oklch(0.85 0.006 270)", light: "oklch(0.18 0.010 270)" },
      accent:  "oklch(0.50 0.190 25)",
      accent2: "oklch(0.45 0.015 270)",
    } },
  { id: "plum-noir", name: "Plum Noir", type: "mono",
    oklch: { l: 0.38, c: 0.16, h: 320 }, vibe: ["neon noir", "moody"] },
  { id: "cyber-cyan", name: "Cyber Cyan", type: "mono",
    oklch: { l: 0.72, c: 0.20, h: 195 }, vibe: ["cyberpunk", "neon noir"] },
  { id: "cyber-magenta", name: "Cyber Magenta", type: "mono",
    oklch: { l: 0.62, c: 0.30, h: 350 }, vibe: ["cyberpunk", "flashy"] },
  { id: "acid-lime", name: "Acid Lime", type: "mono",
    oklch: { l: 0.82, c: 0.22, h: 130 }, vibe: ["edgy", "flashy"] },
  { id: "hot-coral", name: "Hot Coral", type: "mono",
    oklch: { l: 0.68, c: 0.22, h: 25 }, vibe: ["flashy", "warm"] },

  { id: "pride", name: "Pride", type: "palette",
    groups: [
      { label: "Rainbow", colors: [
        { name: "Red",    value: "oklch(0.62 0.22 25)" },
        { name: "Orange", value: "oklch(0.72 0.18 55)" },
        { name: "Yellow", value: "oklch(0.85 0.18 95)" },
        { name: "Green",  value: "oklch(0.65 0.18 142)" },
        { name: "Blue",   value: "oklch(0.55 0.18 247)" },
        { name: "Purple", value: "oklch(0.50 0.20 305)" },
      ]},
      { label: "Trans flag", colors: [
        { name: "Light Blue", value: "oklch(0.78 0.06 230)" },
        { name: "Light Pink", value: "oklch(0.83 0.06 0)" },
        { name: "White",      value: "oklch(0.98 0.002 240)" },
      ]},
      { label: "Base", colors: [
        { name: "Black", value: "oklch(0.15 0.010 270)" },
      ]},
    ],
    vibe: ["rainbow", "LGBTQ+", "trans"],
    note: "Preset, bypasses mixing model" },

  { id: "halloween", name: "Halloween", type: "palette",
    groups: [{ colors: [
      { name: "Black",       value: "oklch(0.15 0.010 270)" },
      { name: "Brown",       value: "oklch(0.35 0.070 55)" },
      { name: "Pumpkin",     value: "oklch(0.60 0.13 52)" },
      { name: "Dark Purple", value: "oklch(0.30 0.18 295)" },
      { name: "White",       value: "oklch(0.98 0.002 240)" },
      { name: "Burgundy",    value: "oklch(0.35 0.12 15)" },
    ]}],
    vibe: ["seasonal", "halloween"],
    roles: {
      // True black background, dark-purple panels, pumpkin accent. Light
      // mode: pale warm cream bg, black text, pumpkin + purple accents.
      bg:      { dark: "oklch(0.13 0.008 290)", light: "oklch(0.95 0.020 60)" },
      surface: { dark: "oklch(0.26 0.130 295)", light: "oklch(0.90 0.050 55)" },
      text:    { dark: "oklch(0.97 0.010 60)", light: "oklch(0.18 0.020 290)" },
      accent:  "oklch(0.62 0.150 52)",
      accent2: "oklch(0.40 0.160 295)",
    } },

  { id: "christmas", name: "Christmas", type: "palette",
    groups: [{ colors: [
      { name: "Holly", value: "oklch(0.42 0.16 145)" },
      { name: "Red",   value: "oklch(0.55 0.22 25)" },
      { name: "White", value: "oklch(0.98 0.002 240)" },
      { name: "Gold",  value: "oklch(0.75 0.16 85)" },
    ]}],
    vibe: ["seasonal", "christmas"],
    roles: {
      bg:      { dark: "oklch(0.28 0.130 145)", light: "oklch(0.97 0.010 145)" },
      surface: { dark: "oklch(0.36 0.140 145)", light: "oklch(0.92 0.050 145)" },
      text:    { dark: "oklch(0.97 0.010 145)", light: "oklch(0.26 0.130 145)" },
      accent:  "oklch(0.53 0.210 25)",
      accent2: "oklch(0.74 0.150 85)",
    } },

  { id: "patriotic", name: "Patriotic", type: "palette",
    groups: [{ colors: [
      { name: "Red",   value: "oklch(0.50 0.22 25)" },
      { name: "White", value: "oklch(0.98 0.002 240)" },
      { name: "Blue",  value: "oklch(0.30 0.18 250)" },
      { name: "Navy",  value: "oklch(0.22 0.10 250)" },
    ]}],
    vibe: ["patriotic", "july 4th"],
    roles: {
      // American flag: white field, navy text, red accent on light; navy
      // field, white text, red accent on dark. Panels stay near-white on
      // light so it doesn't read as a blue (British/Chinese) flag.
      bg:      { dark: "oklch(0.22 0.100 250)", light: "oklch(0.98 0.002 240)" },
      surface: { dark: "oklch(0.29 0.130 252)", light: "oklch(0.985 0.003 250)" },
      text:    { dark: "oklch(0.98 0.002 240)", light: "oklch(0.22 0.100 250)" },
      accent:  "oklch(0.50 0.220 25)",
      accent2: "oklch(0.34 0.160 250)",
    } },

  { id: "sage-pastel", name: "Sage Pastel", type: "mono",
    oklch: { l: 0.78, c: 0.06, h: 150 }, vibe: ["spring", "subtle"] },

  { id: "lavender-spring", name: "Lavender Spring", type: "palette",
    groups: [{ colors: [
      { name: "Pale Lavender", value: "oklch(0.88 0.06 295)" },
      { name: "Lavender",      value: "oklch(0.82 0.08 295)" },
      { name: "Pink Pastel",   value: "oklch(0.86 0.07 5)" },
      { name: "Green Pastel",  value: "oklch(0.85 0.08 145)" },
      { name: "Yellow Pastel", value: "oklch(0.92 0.08 95)" },
      { name: "Black",         value: "oklch(0.15 0.010 270)" },
    ]}],
    vibe: ["spring", "pastel", "lavender", "floral"],
    roles: {
      bg:      { dark: "oklch(0.26 0.060 295)", light: "oklch(0.93 0.040 295)" },
      surface: { dark: "oklch(0.33 0.070 295)", light: "oklch(0.88 0.060 295)" },
      text:    { dark: "oklch(0.92 0.040 295)", light: "oklch(0.28 0.060 295)" },
      accent:  "oklch(0.62 0.130 5)",
      accent2: "oklch(0.66 0.110 145)",
    } },

  { id: "desert-adobe", name: "Desert Adobe", type: "mono",
    oklch: { l: 0.62, c: 0.08, h: 55 }, vibe: ["earth", "warm"] },

  { id: "forest-moss", name: "Forest Moss", type: "mono",
    oklch: { l: 0.50, c: 0.07, h: 142 }, vibe: ["earth", "green"] },

  { id: "purple-magenta", name: "Purple & Magenta", type: "mono",
    oklch: { l: 0.45, c: 0.22, h: 320 },
    vibe: ["moody", "vampy", "analogous"] },

  { id: "emerald-gold", name: "Emerald & Gold", type: "mono",
    oklch: { l: 0.60, c: 0.16, h: 117 },
    vibe: ["regal", "academic", "oz"] },
];

/** Type guard: narrows a Swatch to MonoSwatch. */
export function isMono(s: Swatch): s is MonoSwatch {
  return s.type === "mono";
}

/** Type guard: narrows a Swatch to PaletteSwatch. */
export function isPalette(s: Swatch): s is PaletteSwatch {
  return s.type === "palette";
}

/** Look a swatch up by its stable id. Used by the schedule config. */
export function getSwatchById(id: string): Swatch | undefined {
  return swatches.find((s) => s.id === id);
}

/** Render a mono swatch's base hue as an "oklch(L C H)" CSS color string. */
export function formatMonoOklch(s: MonoSwatch): string {
  return `oklch(${s.oklch.l.toFixed(2)} ${s.oklch.c.toFixed(2)} ${s.oklch.h})`;
}

/**
 * Render an analogous neighbor of a mono swatch by shifting hue by `deltaH`
 * degrees. Lightness and chroma are held constant. Matches the Notion-spec
 * default Analogous mixing model used by the swatches preview.
 */
export function neighborOklch(s: MonoSwatch, deltaH: number): string {
  const h = (s.oklch.h + deltaH + 360) % 360;
  return `oklch(${s.oklch.l.toFixed(2)} ${s.oklch.c.toFixed(2)} ${h.toFixed(0)})`;
}
