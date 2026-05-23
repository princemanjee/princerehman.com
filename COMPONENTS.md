# Component & primitive catalog

**Read this before you write any new card / panel / pill / button markup.**

This file is the load-bearing answer to "how do I make this match the brand?" — every primitive is listed below with its purpose, its props, and the cases where it's the right answer. If you find yourself writing a new `.foo-card`, `.foo-pill`, `.foo-button` class with background / border / box-shadow / border-radius rules, stop. There's almost certainly already a primitive for it.

The brand language (gloss + glass in glass themes, dry sandpaper grit in neomorphic) is wired site-wide in `src/styles/global.css` via `::after` overlays attached to the primitive class names. The treatment automatically applies to every instance — but ONLY to elements that wear the primitive class. Bespoke classes get no gloss, no grit, no nothing. That's why composing matters.

---

## Surfaces

### `GlassPanel`
**File:** `src/components/GlassPanel.astro`

The site's universal surface. Thick frosted glass with bevel highlights, inset shadows, outer drop shadow, royal-blue atmospheric glow. Automatic gloss `::after` overlay (declared in `global.css`) in glass themes; dry sandpaper grit in neomorphic.

Use for: every panel-shaped container — section card, hero, drawer, popover surface, role card wrapper, page-level content block.

```astro
<GlassPanel size="md">…</GlassPanel>
<GlassPanel size="lg" framed>…</GlassPanel>  {/* metallic frame + chrome screws */}
```

Sizes: `sm | md | lg | xl`. `framed={true}` adds the silver metallic frame and corner screws (use sparingly, for "feature" panels).

### Panel tinting — when nesting matters
**File:** `src/styles/global.css:329-340` defines four utility classes that set a `--panel-tint` CSS variable to one of four palette colours emitted by the Prism generator (`--panel-c1..c4`).

```
.panel-a → --panel-c1 (palette colour 1)
.panel-b → --panel-c2 (palette colour 2)
.panel-c → --panel-c3 (palette colour 3)
.panel-d → --panel-c4 (palette colour 4)
```

These classes ONLY set the variable. The actual background tint is **applied via scoped per-consumer CSS** — see `CaseStudy.astro:766` for the canonical pattern:

```css
background:
  linear-gradient(0deg,
    color-mix(in oklch, var(--panel-c1, var(--accent-royal)) 20%, transparent),
    color-mix(in oklch, var(--panel-c1, var(--accent-royal)) 20%, transparent)),
  var(--glass-bg);
```

**The rule:** if you have nested panels (page → section panel → inner card), the inner panel MUST tint differently from its parent so the layers read as distinct. Outer = base glass. First nest = `--panel-c1` at 18-22%. Second nest = `--panel-c2` at 30-36%. The CV uses this for its section panels (`cv/index.astro` scoped block).

### `GlassButton`
**File:** `src/components/GlassButton.astro`

The site's button system. Skeuomorphic: lifts on hover, depresses on press. Automatic gloss `::after` overlay.

Variants: `primary` (royal-blue lit, always-on glow), `secondary` (polished glass, default), `emerald` (alternate accent), `oz` (universal alternate that switches to ruby in green-keyed palettes).

Sizes: `sm | md | lg`.

```astro
<GlassButton variant="primary" size="md">Submit</GlassButton>
<GlassButton variant="secondary" size="sm" data-my-attr="x">Toggle</GlassButton>
```

Arbitrary attrs (`data-*`, `aria-*`, etc.) forward to the rendered element automatically via `...rest` props.

**Rule:** every clickable / toggleable / focusable rectangular control on the site is a GlassButton. No exceptions. If the link semantics matter, pass `href` (renders an `<a>`). If button semantics matter, omit `href` (renders a `<button>`).

### Form controls
**Files:** `GlassField.astro`, `GlassInput.astro`, `GlassSelect.astro`, `GlassTextarea.astro`

`GlassField` is the wrapper (label + helper text + slot). The control primitives wear the frosted glass surface (matte in neomorphic) and accept full prop forwarding. Use these for every form input — never write a `<input class="my-input">` with its own styles.

```astro
<GlassField label="Email" hint="Used only for follow-up">
  <GlassInput type="email" name="email" required />
</GlassField>
```

---

## Layout primitives

### `Container`
Centered max-width wrapper. `size="md | lg | xl | full"`.

### `Stack`
Vertical or horizontal flex layout with token-driven gap. Replaces every hand-rolled `<div style="display:flex; gap:1rem">`.

```astro
<Stack gap="md">…</Stack>
<Stack direction="horizontal" gap="sm" wrap>…</Stack>
```

Gaps: `2xs | xs | sm | md | lg | xl | 2xl | 3xl`.

### `Grid`
Auto-fit grid with `min` (minimum cell width) and `gap`.

```astro
<Grid min="280px" gap="md">…</Grid>
```

### `PageHeader`
Page title + meta line. Compose with this at the top of every page below the nav.

---

## Display chips & badges

### `.tech-tag` / `.tech-tag--accent`
**File:** `src/styles/global.css`

The site's universal display chip — non-interactive pill for skills, tech stack, tags, matched-skill markers. Bevel + gloss in glass themes, gritty in neomorphic. Use `.tech-tag--accent` for royal-tinted variant (e.g., a "matched" or "active" state).

```html
<span class="tech-tag"><span>Microsoft 365</span></span>
<li class="tech-tag tech-tag--accent">
  <span aria-hidden="true">✓</span><span>Cloud Migration</span>
</li>
```

**Use this for any display-only pill.** Don't invent `.my-chip` / `.foo-pill` classes — they will not get the gloss treatment.

For interactive chips (toggleable filter chips, audience selector, etc.), use `<GlassButton size="sm">` with `variant="primary"` for the active state and `variant="secondary"` for inactive. Match the active-state to a single prop or `aria-pressed` attr — never invent `.chip--active` styling.

### `.case-study-card-availability`
Status badge used on the case-study card. Two semantic variants: `--open-source` (emerald) and `--commercial-preserved` (amber). Don't reuse outside case-study contexts; create a new variant on `.tech-tag` if you need a different semantic colour.

---

## Higher-order components

### `Nav` / `MobileNav`
Top-level site navigation. Desktop pill bar (`Nav`) + mobile disc + glass-panel overlay (`MobileNav`). Both read pages and case studies from `src/data/caseStudies.ts` + an in-component `styleguideChildren` array. Add a new top-level link in both components when you ship a new page.

### `BrandMark` / `BrandName`
Logo orb (`BrandMark`) and wordmark (`BrandName`). Use both together in the nav header and footer. `size="xs | sm | md | lg"`.

### `Hero`
Hero block for landing pages. Composes Container + display-grade typography. Use only when a page genuinely needs hero treatment (home, about top, primary work case study).

### `FactsPanel`
Stat / metric callout panel. Use sparingly to highlight 2-4 numeric facts in one block.

### `CaseStudy` / `CaseStudyCard`
Full case-study layout (`CaseStudy`) and overview card (`CaseStudyCard`). Each case-study page is data-driven from `src/data/caseStudies.ts`. Don't duplicate this pattern for non-case-study content — use GlassPanel + Stack + Grid instead.

### `PrismPanel`
The floating palette / theme switcher. One per page (rendered by the layout). Don't add a second.

---

## Tokens

**File:** `src/styles/tokens.css`

Single source of truth for colours, spacing, radii, blur, easing, durations, typography metrics. Five theme modes: `dark`, `light`, `hybrid`, `system`, `neomorphic`. Plus palette presets and mono swatches emitted by the Prism generator (`src/lib/prism-palette.ts`).

**Rule:** every colour / spacing / shadow / radius / duration value MUST come from a token. Never write `padding: 16px` — write `padding: var(--space-md)`. Never write `color: #1e90ff` — write `color: var(--accent-royal)`. New numeric values mean a new token in `tokens.css`, not an inline literal.

---

## When to write a new component

Almost never. Before introducing a new `*.astro` component, check:

1. Could `<GlassPanel>` + `<Stack>` + `<Grid>` compose this? (90% of the time: yes.)
2. Is the new visual treatment a NEW BRAND PATTERN (e.g., a different finish, a new shape) that genuinely doesn't exist? If yes, write it as a token / a global class in `global.css`, not as a scoped style.
3. Does it duplicate an existing primitive's surface treatment (background + border + radius + shadow)? If yes, you're inventing — use the primitive instead.

If you decide to create a new component:
- Compose from existing primitives in the markup
- Scoped CSS is only for layout-level positioning (margin, padding, gap, grid placement) — NEVER surface treatment
- Add the new component to this catalog

---

## Common anti-patterns (do not do)

- ❌ `<div class="my-card" style="background: rgba(255,255,255,0.05); border-radius: 12px">` — use `<GlassPanel>`.
- ❌ `<span class="my-chip">` with custom padding/border-radius/background — use `class="tech-tag"`.
- ❌ `<button class="my-btn">` — use `<GlassButton variant="...">`.
- ❌ Inline `<style is:global>` blocks on a page to "override" primitive styles. Fix the primitive, or use the right primitive.
- ❌ Hard-coded colour / size values (`color: #fff`, `padding: 12px`) — use tokens.
- ❌ A new `.cv-foo-card`, `.work-foo-card`, `.about-foo-card` etc. with duplicated surface CSS. The shape varies between sections, the SURFACE does not.

---

## How to verify your work

1. `npm run build` succeeds.
2. Grep the built `dist/**/index.html` for any new bespoke classnames you introduced — there shouldn't be surface treatment in scoped component styles.
3. Open the page in dev (`npm run dev`). Compare it side-by-side to another page (`/work`, `/styleguide`). Does it use the same visual language? Same panels, same buttons, same chips?
4. Switch themes via the PrismPanel (dark / light / hybrid / neomorphic). Does your work track all five correctly?
