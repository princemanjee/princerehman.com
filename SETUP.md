# Setup Guide: princerehman.com on GitHub Pages

This walks you through the first-time setup. Approximate time: 30 minutes including DNS propagation waits.

The result: princerehman.com loads in a browser and serves the placeholder Astro site. HTTPS works. Pushing changes to `main` triggers an auto-build and deploy.

You will only do this once. After that, your workflow is: edit, commit, push, done.

---

## Step 0: Prerequisites

Confirm you have Node.js 20 or later.

```bash
node --version
```

Should print v20.x.x, v22.x.x, or higher. If not, install from https://nodejs.org (LTS release).

You also need:

- A GitHub account (you have one: `princemanjee`)
- Access to your Squarespace account (manages the princerehman.com DNS)

---

## Step 1: Test the project locally

Before pushing anything to GitHub, verify the project runs.

```bash
cd princerehman.com
npm install
npm run dev
```

Open http://localhost:4321 in your browser. You should see:

- The text "P. R. Manjee"
- A positioning line
- A "Theme" toggle button in the bottom-right corner
- A muted background (the `hybrid` theme default)

Click the theme toggle. It should cycle through `light`, `dark`, `hybrid`. Each cycle should change the background and persist in localStorage so reloads remember your choice.

If this works, the project is healthy. Stop the dev server with Ctrl+C.

---

## Step 2: Create the GitHub repo

1. Go to https://github.com/new
2. Repository name: `princerehman.com`
3. Description: `Personal-brand portal. Astro + GitHub Pages + Prism design system.`
4. Visibility: **Public** (required for free GitHub Pages on a custom domain)
5. Do NOT initialize with a README, .gitignore, or license. The project already has those.
6. Click "Create repository"

GitHub will show you a page with setup instructions. Use the "push an existing repository" section.

In your terminal, inside the `princerehman.com` folder:

```bash
git init
git add .
git commit -m "Initial commit: Session 1 infrastructure and pipeline"
git branch -M main
git remote add origin https://github.com/princemanjee/princerehman.com.git
git push -u origin main
```

After the push completes, refresh your repo page on GitHub. You should see all the files.

---

## Step 3: Enable GitHub Pages

GitHub will not auto-build the site until Pages is configured.

1. Go to your repo on GitHub
2. Click **Settings** (top nav)
3. In the left sidebar, click **Pages**
4. Under "Build and deployment", change "Source" from `Deploy from a branch` to **GitHub Actions**
5. (No save button needed; it auto-saves)

Now go to the **Actions** tab in your repo. You should see one workflow run from your initial push, and it may have failed (because Pages was not configured yet). That is expected.

Trigger a new run:

1. Go to Actions tab
2. Click "Deploy to GitHub Pages" in the left sidebar
3. Click "Run workflow" button (top right of workflow list)
4. Confirm by clicking the green "Run workflow" button

Wait 1-2 minutes. The workflow should now complete successfully (both Build and Deploy jobs green).

---

## Step 4: Configure the custom domain in GitHub Pages

While still in Settings > Pages:

1. Under "Custom domain", type `princerehman.com`
2. Click **Save**
3. You will see a warning about DNS configuration. This is expected because DNS is not pointing at GitHub yet. We will fix that in the next step.
4. Leave the "Enforce HTTPS" checkbox UNCHECKED for now. GitHub needs to provision a TLS certificate, which it cannot do until DNS resolves. We will check this box after DNS is set up.

---

## Step 5: Update DNS at Squarespace

This is the step that makes princerehman.com point at your new GitHub Pages site instead of the old Google Sites redirect.

1. Log in to your Squarespace account
2. Navigate to your domain (Settings > Domains > princerehman.com)
3. Click **DNS Settings** (or "Advanced DNS", depending on Squarespace's current UI)

### Records to REMOVE

Look for any existing A, AAAA, or ALIAS records on the apex (`@` or root) that currently point at Google Sites. Remove those records. Common patterns to look for:

- ALIAS or A record for `@` pointing to Google IPs
- TXT records related to Google Sites verification (these can stay or be removed; they do not affect GitHub Pages)

Also look for any URL redirect rules that send princerehman.com to resume.princerehman.com. Remove those.

**Important:** Do NOT remove records for the `cv` subdomain (`cv.princerehman.com`). Those keep your existing CV site working during the transition. Leave them alone.

### Records to ADD

Add the following four A records to the apex domain. In Squarespace's UI, the host field is usually labeled `Host` or `Name`. Use `@` to indicate the apex.

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A | @ | 185.199.108.153 | (default, usually 3600) |
| A | @ | 185.199.109.153 | (default) |
| A | @ | 185.199.110.153 | (default) |
| A | @ | 185.199.111.153 | (default) |

Optionally also add the IPv6 records (recommended for better global performance):

| Type | Host | Value |
|------|------|-------|
| AAAA | @ | 2606:50c0:8000::153 |
| AAAA | @ | 2606:50c0:8001::153 |
| AAAA | @ | 2606:50c0:8002::153 |
| AAAA | @ | 2606:50c0:8003::153 |

And add the CNAME record for the www subdomain:

| Type | Host | Value |
|------|------|-------|
| CNAME | www | princemanjee.github.io |

Save the DNS changes.

---

## Step 6: Wait for DNS propagation

DNS changes typically propagate in 5 to 30 minutes, occasionally longer. You can check progress at https://dnschecker.org/#A/princerehman.com. You want to see GitHub's IPs (185.199.x.x) showing up in most or all checker locations before proceeding.

While waiting, go back to GitHub Settings > Pages. The custom domain section may still show a warning. Refresh occasionally. Once DNS resolves correctly, GitHub will automatically detect it and begin provisioning HTTPS.

---

## Step 7: Enable HTTPS

Once DNS resolves and GitHub has provisioned a TLS certificate (usually 10 to 60 minutes after DNS propagation completes):

1. Go to Settings > Pages
2. Check the "Enforce HTTPS" checkbox

Visit https://princerehman.com. You should see your placeholder Astro site with a valid HTTPS certificate.

If you see a TLS error or "GitHub Pages" 404 page, wait 30 more minutes and try again. The TLS provisioning is async on GitHub's side.

---

## Step 8: Verify everything

Final checklist:

- [ ] https://princerehman.com loads
- [ ] Shows "P. R. Manjee" and the positioning line
- [ ] Theme toggle button works (cycles through three modes)
- [ ] HTTPS lock icon shows in browser
- [ ] https://www.princerehman.com also loads (redirects to apex or serves the same content)
- [ ] http://princerehman.com auto-upgrades to https
- [ ] cv.princerehman.com still works (the existing CV is unaffected)

Once all of those check out, Session 1 is complete. Push to `main` any time to redeploy. The GitHub Action runs automatically and the site updates in about 1 minute.

---

## Troubleshooting

**The workflow shows "Pages site failed to update":**
Likely Pages was not enabled when the first push happened. Go to Settings > Pages and confirm Source is set to "GitHub Actions". Then go to Actions > Deploy to GitHub Pages > Run workflow.

**DNS checker shows old Google IPs:**
The old records were not fully removed, or browsers/resolvers are caching them. Wait longer (up to 24 hours in worst cases), or flush your local DNS cache:
- macOS: `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`
- Windows: `ipconfig /flushdns`

**HTTPS shows certificate error:**
Wait. GitHub provisions Let's Encrypt certificates asynchronously after DNS resolves. This can take up to a few hours in slow cases. If it has been more than 24 hours, uncheck and re-check "Enforce HTTPS" in Pages settings to trigger a retry.

**Site shows the Astro placeholder but content looks unstyled:**
Hard refresh (Ctrl+Shift+R or Cmd+Shift+R) to bypass browser cache. If the issue persists, check that the workflow's most recent run completed successfully in the Actions tab.

---

## After Session 1

You now have working infrastructure. From here on, edits are simple:

```bash
git pull                       # in case of any GitHub UI edits
# ... edit files ...
npm run dev                    # preview locally
git add .
git commit -m "your message"
git push
```

Site updates in about a minute.

Session 2 builds the Prism design system on top of this foundation.
