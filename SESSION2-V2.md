# Session 2 v2 — Prism Design System Phase 1

This package ships the final landing page for princerehman.com with the locked Phase 1 design system.

## What's in this zip

```
src/
├── styles/
│   ├── tokens.css          (updated — dark navy + royal blue + emerald palette)
│   ├── typography.css      (updated — Cormorant Garamond + Inter + Geist)
│   └── global.css          (updated — dark navy gradient body, base styles)
├── layouts/
│   └── BaseLayout.astro    (updated — new fonts, embedded SVG filter)
├── components/
│   ├── GlassPanel.astro    (new — thick glass with crisp bevel)
│   ├── BrandName.astro     (updated — Cormorant Garamond + polished glass)
│   ├── GlassButton.astro   (updated — primary/secondary/emerald, skeuomorphic press)
│   └── Hero.astro          (updated — composed from new components)
└── pages/
    └── index.astro         (updated — removed ThemeToggle)
```

## How to install

1. Close any running `npm run dev` process in your project.
2. Back up your current `src/` directory (just in case):
   ```
   xcopy /E /I /Y src src.before-session2-v2
   ```
3. Extract this zip over your `princerehman.com/` project directory. The `src/` files will overwrite their counterparts.
4. The old `src/components/ThemeToggle.astro` from Session 2 v1 stays in your project but is no longer imported. It can be deleted, or kept dormant for Phase 2 reuse.
5. Run `npm run dev` and open `http://localhost:4321` in your browser.

You should see the landing page rendered in the locked design: dark navy gradient background, thick glass hero panel with crisp curved bevel highlights, "P. R. Manjee" in Cormorant Garamond with polished glass treatment, royal blue primary CTA, polished secondary button.

## Locked design decisions (Phase 1)

| Element | Locked treatment |
|---|---|
| Background | Dark navy gradient with atmospheric radial royal-blue and purple tints |
| Panel | Thick glass with crisp curved bevel via inset shadow (v8 technique) |
| Brand name typeface | Cormorant Garamond, weight 600, optical sizing tightened |
| Brand name finish | Polished glass via SVG filter (clear, royal blue glow halo) |
| Primary CTA | Royal blue lit |
| Secondary CTA | Polished glass default, lit on hover |
| Alternate CTA | Emerald lit (use sparingly for high-stakes actions) |
| Accent color | Royal blue primary, Emerald secondary accent |
| Display typeface | Cormorant Garamond |
| Body typeface | Inter |
| UI typeface | Geist (button labels, controls) |
| Mono typeface | JetBrains Mono |

## Skeuomorphic interaction principle

A new design principle applied throughout. Elements should feel physically real where possible.

In Phase 1, this shows up as:
- Buttons rise on hover (translateY -3px) with growing shadow, conveying tactile lift
- Buttons depress on active (translateY -1px) with 100ms snap, conveying physical press
- Hover transitions use easing-out timing curves matching natural inertia
- Glass panels look like solid slabs you could pick up off the screen
- Brand name reads as polished glass material, not flat text

In Phase 2, this principle extends to:
- Prism control panel with a real-feeling rotary dial for hue selection
- Theme toggle as a physical switch with audible-feeling action
- Cards that lift on hover with parallax depth
- Inputs that depress on focus
- Toggles that animate as physical switches

## What Phase 2 will add (not in this zip)

- Full Prism control panel (the brand-system console)
- Theme switching (light, dark, plus dynamically generated hue variants)
- Real-feeling hue rotary dial for accent color manipulation
- Skeuomorphic theme toggle (physical switch metaphor)
- Adaptive CV system with URL-driven audience targeting
- Selected Work case studies (FieldForce Tool Tracker, AIOrchBuilder, etc.)
- Content subdirectory migration from Google Sites with permanent redirects

## Notes

- The SVG filter `#prism-polished` is defined globally in BaseLayout. Any element on the page can reference it via `filter: url(#prism-polished)`. This is how BrandName gets its rounded specular bevel.
- The `!important` rules in BrandName are intentional. They protect the brand identity styles from accidental override by ancestor styles or future changes.
- A `prefers-reduced-motion` media query in GlassButton respects accessibility preferences by disabling the hover and press transforms when requested.
- The hero panel is sized via the `xl` GlassPanel preset (radius 56px). Smaller surfaces (cards, badges) can use `lg`, `md`, or `sm` presets.
- All component CSS is scoped to its `.astro` file. Tokens and typography are global. The gradient body background is global. No CSS leaks across components.

## If something doesn't render right

The most likely issues:

- **Cormorant Garamond not loading.** Check that the Google Fonts URL in BaseLayout.astro loaded successfully (network tab in browser dev tools). Italic and weight 600 should both be available.
- **SVG filter not applying.** Inspect the brand name element. Its `filter` should include `url(#prism-polished)`. If it's blank, BaseLayout did not render the SVG `<defs>` correctly.
- **Body background wrong.** Check that `src/styles/global.css` was overwritten. The fixed gradient depends on `--bg-1` through `--bg-4` from tokens.css.
- **Buttons feel flat.** They should have a clearly raised glass appearance with curved top/bottom highlights. If they look flat, the `:hover` and `:active` rules may not be applying. Hard refresh (Ctrl+Shift+R) to clear cached CSS.

Once the page renders correctly, commit and push. GitHub Pages will deploy the updated site to princerehman.com within a few minutes.

— Session 2 v2 closed. Outreach phase next.
