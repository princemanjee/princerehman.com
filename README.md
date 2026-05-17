# princerehman.com

Personal-brand portal for P. R. Manjee. Built on Astro, deployed to GitHub Pages, styled with the Prism design system.

## Local development

Requires Node.js 20 or later (Node 22 recommended).

```bash
npm install
npm run dev
```

Site is then available at http://localhost:4321. Hot module replacement reloads on save.

## Build

```bash
npm run build
```

Output goes to `dist/`. Preview with `npm run preview`.

## Deploy

Auto-deploys to GitHub Pages on every push to `main` via the workflow in `.github/workflows/deploy.yml`. No manual deploy step required after the first-time setup.

First-time setup is documented in `SETUP.md`.

## Project status

- **Session 1 (this version):** infrastructure, deploy pipeline, placeholder page with theme toggle plumbing. Site loads and serves; styling is minimal.
- **Session 2:** Prism design system foundations (OKLCH token system, glass components, full theme switching).
- **Session 3:** Landing page content sections (hero, about, selected work, writing, services, contact).
- **Session 4:** Google Sites elimination and content consolidation.

See the Notion task board for the full plan.

## Stack

- [Astro 5](https://astro.build) for static site generation
- TypeScript for type-checked component code
- CSS custom properties for theming
- GitHub Actions for deploy automation
- GitHub Pages for hosting
- Squarespace for domain registration
