# Session 2: Prism design system foundation

## What this session delivers

- OKLCH-based design token system applied via CSS custom properties
- Three theme variants: `light`, `dark`, `hybrid`
- Default palette: Analogous mixing model on royal blue (hue 260)
- Typography: Fraunces (display), Inter (body), JetBrains Mono (mono)
- `BrandName` component with protected rendering rules
- `GlassButton` component (primary, secondary, ghost variants)
- Polished `Hero` section
- Redesigned `ThemeToggle` matching the new glass aesthetic

## How to install

1. Extract this zip over your existing princerehman.com folder. The files inside `src/` overwrite their Session 1 counterparts and add new ones.
2. No new npm dependencies are added in this session. Skip `npm install` if you already ran it after Session 1.
3. Run `npm run dev` and open `http://localhost:4321`.
4. When the local preview looks right, commit and push to deploy.

## What to verify locally

Open the dev server and walk this checklist:

1. The page now shows a Hero with "P. R. Manjee" rendered in Fraunces serif at large display size.
2. The hybrid theme (default on first load, no localStorage) shows a deep royal-blue gradient background with cyan-blue at top-left and deep purple at bottom-right.
3. Two action buttons in the hero: primary (filled bright blue) and secondary (frosted glass).
4. Below the buttons, an in-line links row for LinkedIn, GitHub, and CV.
5. Click the floating theme toggle in the bottom-right corner. It cycles `light` → `dark` → `hybrid`. Each mode looks distinct and the brand name keeps its glow on dark/hybrid, gains weight on light.
6. Refresh the page. Your selected theme persists.

## Files in this zip

```
src/
├── styles/
│   ├── tokens.css           NEW   OKLCH palette + spacing/radius/timing tokens
│   ├── typography.css       NEW   Font stacks, type scale, line heights
│   └── global.css           UPDATED
├── components/
│   ├── BrandName.astro      NEW   Protected name rendering
│   ├── GlassButton.astro    NEW   Three variants, three sizes
│   ├── Hero.astro           NEW   Full hero section
│   └── ThemeToggle.astro    UPDATED   Glass pill, sun icon, mono label
├── layouts/
│   └── BaseLayout.astro     UPDATED   Loads fonts, preserves theme init
└── pages/
    └── index.astro          UPDATED   Uses Hero component
SESSION2.md (this file)
```

## Tokens reference

Edit `src/styles/tokens.css` to change colors globally. The token naming pattern is `--color-{role}-{variant}` where role is `bg`, `fg`, `brand`, or `border`, and variant clarifies usage (`primary`, `secondary`, `accent`, etc.).

The analogous palette derivation is documented in the file header. The three theme blocks (`[data-theme="light"]`, `[data-theme="dark"]`, `[data-theme="hybrid"]`) each override the relevant tokens. The hybrid mode additionally applies a gradient background in `global.css`.

## Brand guidelines

The author's name `P. R. Manjee` must be rendered through the `BrandName` component, never as plain text in markup. The component enforces:

- Fraunces display font, weight 500 (or 600 on light theme)
- Optical sizing axis set to 144 for large displays
- Tight letter spacing
- Glow on dark and hybrid themes
- Resistance to override (styles use `!important` to prevent accidental restyling)

This pattern mirrors the SOPHUCKIT brand-mark protection rules and ensures consistent identity across themes.

## What's still ahead

- Session 3: Additional sections (About, Selected Work, Writing, Services, Contact). New components: GlassCard, GlassNav, GlassInput.
- Session 4: Google Sites elimination and `cv.princerehman.com` content migration with redirects.
- Phase 2: Full Prism control panel with dynamic palette generation, hue slider, mixing-model selector, contrast toggle, and neomorphic mode.

## Notes on the typography choice

I picked Fraunces for the display font because it gives the brand a distinctive identity that reads as polymath-scholarly without losing the polished restraint you described (Hugo Boss aesthetic). It is a variable font with optical sizing, which means it scales beautifully from small captions to giant hero headers. It is free via Google Fonts.

If after seeing it rendered you want to swap it for something else, the change is a single line in `src/styles/typography.css` (the `--font-display` variable) plus the corresponding Google Fonts URL in `src/layouts/BaseLayout.astro`. Alternatives worth considering if Fraunces is not your taste: Inter Display (consistent with body, no contrast), Tiempos Headline (premium, paid), or Söhne (paid).
