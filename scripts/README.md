# scripts/

Build-time tooling for `princerehman.com`. Pure Node, no extra dependencies.

## `sync-resume.mjs` — snapshot the canonical resume

`src/data/resume.json` is a vendored snapshot. The source of truth lives in the sister repo
`JobApplyFramework` at `Assets/resume.json`. This script keeps the snapshot in step.

### When to run

- After editing `Assets/resume.json` in `JobApplyFramework`.
- Automatically on every build (wired into `prebuild` in `package.json`).
- Whenever you want to verify the snapshot is current (use the `:check` variant).

### How to run

```bash
npm run sync:resume         # write the snapshot if needed
npm run sync:resume:check   # dry-run + verbose, no writes
npm run test:sync           # run the test suite (node --test)
```

### CI / build wiring

`package.json` defines:

```json
"prebuild": "npm run sync:resume",
"sync:resume": "node scripts/sync-resume.mjs",
"sync:resume:check": "node scripts/sync-resume.mjs --dry-run --verbose",
"test:sync": "node --test scripts/sync-resume.test.mjs"
```

`npm run build` therefore always refreshes the snapshot first.

### Overriding the source path

Default source is resolved relative to the repo root: `../JobApplyFramework/Assets/resume.json`.

To point at a different path, set `JOBAPPLY_PATH` to the JobApplyFramework root:

```bash
# bash
JOBAPPLY_PATH=/path/to/JobApplyFramework npm run sync:resume

# PowerShell
$env:JOBAPPLY_PATH = "C:\Code\GitHub\JobApplyFramework"; npm run sync:resume
```

### Behavior

| Situation | Result |
|---|---|
| Source file missing | Warn, exit 0. Existing snapshot is kept. Build still proceeds. |
| Source unparseable | Error, exit 1. Build fails. |
| Source unchanged (hash matches `_snapshotMeta.sha256`) | Log "in sync, nothing to do", exit 0. No file write. |
| Source changed | Rewrite `src/data/resume.json` with fresh `_snapshotMeta`. Exit 0. |

The hash is SHA-256 of the canonical (`JSON.stringify`) bytes of the source with any
incoming `_snapshotMeta` stripped, so meta churn never triggers a needless rewrite.

The script is read-only with respect to `JobApplyFramework`. It never modifies the source.

### `_snapshotMeta` shape

```json
{
  "_snapshotMeta": {
    "source": "JobApplyFramework/Assets/resume.json",
    "snapshotDate": "YYYY-MM-DD",
    "sha256": "<64-char hex>",
    "syncedAt": "<ISO-8601 timestamp>"
  },
  "$schema": "...",
  "basics": { ... },
  "...": "..."
}
```

## `build-token-usage.mjs`

See header docstring inside the file. Builds `src/data/tokenUsage.json` by scanning `src/**` for
`var(--token)` references.
