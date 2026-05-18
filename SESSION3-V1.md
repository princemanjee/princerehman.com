# Session 3 v1 — Brand Mark + Favicons + Social Card

Locked Sunday, May 17, 2026. Delivers the brand mark system, complete favicon set, social card image, and Open Graph meta tags.

## What's in this batch

Four deliverables, nine new files, two updated files.

### NEW — `src/components/BrandMark.astro`

The polished orb containing the embossed rounded chevron. Reusable across the site with five size variants.

- `sm` (32px) — inline use, nav
- `md` (48px) — cards, secondary placements
- `lg` (96px) — about page sidebar
- `xl` (140px) — hero lockup primary placement
- `hero` (280px) — standalone hero panels, rarely used

Scoped CSS handles the orb frame (backdrop blur, layered inset bevel highlights, atmospheric royal-blue glow), the chevron path with round caps and joins applying the embossed filter, and a subtle lift transform when the BrandMark is nested inside an interactive parent (anchor or button). Respects `prefers-reduced-motion` for accessibility. The `sm` size has a reduced shadow stack to prevent visual mud at small dimensions.

### UPDATED — `src/layouts/BaseLayout.astro`

Three additions to the existing layout.

1. **New SVG filter `prism-embossed-pronounced`** added alongside the existing `prism-polished` in the global filter defs. Used by BrandMark to render the chevron as physically raised from the orb surface. Doubled surface scale versus the wordmark filter, plus a secondary cool fill light for dimensional form.

2. **Complete favicon link tags** in `<head>`. SVG favicon for modern browsers, PNG favicons at 16 and 32 for browser tabs, Apple touch icon at 180px for iOS home screen, PWA manifest reference, and a theme-color meta tag matching the dark navy gradient.

3. **Full Open Graph and Twitter Card meta tags** pointing to the new social card image. When the URL is shared on LinkedIn, Slack, Discord, iMessage, Twitter/X, or similar platforms, the rendered preview shows the brand mark plus wordmark plus tagline on the dark navy gradient. Also includes Person schema JSON-LD structured data telling search engines you're a Senior Technology Consultant in Chicago, IL with LinkedIn and GitHub profiles linked.

### UPDATED — `src/components/Hero.astro`

Wraps the BrandMark and BrandName in a `.hero-lockup` div. The mark sits above the wordmark in a left-aligned vertical lockup with 28px gap, so the two read as one composed identity unit. BrandMark uses the `xl` (140px) size. Mobile responsive: gap tightens to 20px on screens under 768px.

### NEW — favicon set in `public/`

- `favicon.svg` — vector version for modern browsers, self-contained with embedded gradients (no backdrop-filter dependency)
- `favicon-16.png` — 16×16 PNG
- `favicon-32.png` — 32×32 PNG
- `favicon-48.png` — 48×48 PNG for legacy IE
- `favicon-96.png` — 96×96 PNG for older Android
- `apple-touch-icon.png` — 180×180 PNG for iOS home screen
- `android-chrome-192.png` — 192×192 PNG for Android home screen
- `android-chrome-512.png` — 512×512 PNG for Android splash screen
- `site.webmanifest` — PWA manifest enabling install-to-home-screen behavior with proper icons and theme colors

### NEW — `public/social-card.png`

The 1200×630 Open Graph image displayed when princerehman.com is shared on social platforms. Polished orb mark on the left, "P. R. Manjee" wordmark in Cormorant Garamond SemiBold with the polished glass SVG filter, tagline "Senior Technology Consultant · AI Adoption · Digital Transformation" in Inter, and the URL "princerehman.com" in royal blue. Dark navy gradient background with atmospheric royal-blue and purple radial glows.

## Installation

Drop the contents of this archive over the existing project preserving the directory structure. Existing files that get replaced.

```
src/components/Hero.astro          (REPLACED)
src/layouts/BaseLayout.astro       (REPLACED)
src/components/BrandMark.astro     (NEW)
public/favicon.svg                 (NEW)
public/favicon-16.png              (NEW)
public/favicon-32.png              (NEW)
public/favicon-48.png              (NEW)
public/favicon-96.png              (NEW)
public/apple-touch-icon.png        (NEW)
public/android-chrome-192.png      (NEW)
public/android-chrome-512.png      (NEW)
public/site.webmanifest            (NEW)
public/social-card.png             (NEW)
SESSION3-V1.md                     (NEW, this file)
```

From the project root, run `npm run dev` and open http://localhost:4321. The hero should now show the polished orb mark above the "P. R. Manjee" wordmark. Open a browser dev tools tab and look at the favicon in the tab — it should be the orb with the chevron, not the default Astro icon.

## Verification checklist

- [ ] Hero displays the polished orb (140px) above the wordmark, both left-aligned
- [ ] Browser tab favicon shows the orb with chevron, not the Astro default
- [ ] Bookmark the page, check that the bookmark icon is the orb
- [ ] View page source, confirm `<meta property="og:image">` points to `/social-card.png`
- [ ] Use https://www.opengraph.xyz/ or similar to preview the social card — paste princerehman.com once deployed
- [ ] On iOS, "Add to Home Screen" should produce an icon showing the orb
- [ ] Lighthouse score in Chrome DevTools should show PWA manifest detected

## Commit message template

```
Add brand mark, favicons, and social card

- New BrandMark.astro component (polished orb + embossed chevron, 5 size variants)
- Updated BaseLayout.astro with embossed SVG filter, favicon links, OG meta tags, Person schema JSON-LD
- Updated Hero.astro to display brand mark above wordmark in left-aligned lockup
- Complete favicon set: SVG + PNG at 16, 32, 48, 96, 180, 192, 512
- 1200x630 social card image for LinkedIn/Slack/Discord previews
- PWA manifest for mobile install-to-home-screen support
```

## What's next

After this lands, queued in priority order.

1. **About page** — longer form bio with the orb at large size in the page header. Two-column layout, narrative on left, key facts on right.
2. **Selected Work section** — case studies for AIOrchBuilder, ClaudeMCP. FieldForce decision still pending.
3. **HTTPS check** — confirm https://princerehman.com resolves with a valid cert and no mixed-content warnings on the social card image after deploy.
4. **FieldForce positioning decision** — open source case study vs commercial product marketing site vs hybrid.
5. **Cloudflare fiber gig** added to resume.json and LinkedIn.
6. **References list** — five professional references compiled.

After website work stabilizes: **Outreach phase** — 30 targets across 15 boutique MSPs, 10 mid-market companies, 5 dream targets including OpenAI and Anthropic.
