#!/usr/bin/env node
/**
 * sync-resume.mjs
 *
 * Synchronizes the vendored resume snapshot at `src/data/resume.json` with the
 * canonical source-of-truth at `<JOBAPPLY_PATH>/Assets/resume.json`
 * (default JOBAPPLY_PATH = `../JobApplyFramework`).
 *
 * Pure Node built-ins (fs, path, crypto, process, url). No external deps.
 *
 * Behavior:
 *   - Source missing: warn + exit 0 (build proceeds with existing snapshot).
 *   - Source unparseable: error + exit 1 (genuine failure).
 *   - Source unchanged (hash matches existing _snapshotMeta.sha256): exit 0, no write.
 *   - Source changed: rewrite `src/data/resume.json` with fresh `_snapshotMeta`.
 *
 * Flags:
 *   --verbose, VERBOSE=1   Print paths, sizes, hashes.
 *   --dry-run              Compute and report but do not write.
 *
 * Read-only access to JobApplyFramework. Idempotent.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const TARGET_PATH = path.join(REPO_ROOT, "src", "data", "resume.json");

const args = new Set(process.argv.slice(2));
const VERBOSE = args.has("--verbose") || process.env.VERBOSE === "1";
const DRY_RUN = args.has("--dry-run");

function log(...parts) {
  // Reason: keep a single prefix so prebuild logs are easy to grep.
  console.log("[sync-resume]", ...parts);
}

function vlog(...parts) {
  if (VERBOSE) log(...parts);
}

function warn(...parts) {
  console.warn("[sync-resume] WARN:", ...parts);
}

function fail(message, code = 1) {
  console.error("[sync-resume] ERROR:", message);
  process.exit(code);
}

function resolveSourcePath() {
  const envPath = process.env.JOBAPPLY_PATH;
  const base = envPath && envPath.trim().length > 0
    ? path.resolve(envPath)
    : path.resolve(REPO_ROOT, "..", "JobApplyFramework");
  return path.join(base, "Assets", "resume.json");
}

function sha256OfCanonical(obj) {
  // Reason: hash canonical (un-pretty) JSON so spacing differences don't churn the snapshot.
  // _snapshotMeta is excluded so hash reflects content only.
  const { _snapshotMeta: _ignored, ...rest } = obj;
  const canonical = JSON.stringify(rest);
  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
}

async function readJsonIfExists(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    try {
      return { exists: true, parsed: JSON.parse(raw), raw };
    } catch (err) {
      return { exists: true, parsed: null, raw, parseError: err };
    }
  } catch (err) {
    if (err && err.code === "ENOENT") return { exists: false };
    throw err;
  }
}

async function main() {
  const sourcePath = resolveSourcePath();
  vlog("repo root:", REPO_ROOT);
  vlog("source path:", sourcePath);
  vlog("target path:", TARGET_PATH);
  vlog("dry-run:", DRY_RUN ? "yes" : "no");

  const source = await readJsonIfExists(sourcePath);

  if (!source.exists) {
    // Reason: missing source on CI should not break the build. The existing
    // snapshot in src/data/resume.json is used as-is.
    warn(`source not found at ${sourcePath} — using existing snapshot as-is.`);
    process.exit(0);
  }

  if (source.parsed === null) {
    fail(`failed to parse source JSON at ${sourcePath}: ${source.parseError && source.parseError.message}`);
  }

  vlog("source bytes:", source.raw.length);

  const newHash = sha256OfCanonical(source.parsed);
  vlog("computed hash:", newHash);

  const target = await readJsonIfExists(TARGET_PATH);
  const currentHash = target.exists && target.parsed && target.parsed._snapshotMeta
    ? target.parsed._snapshotMeta.sha256
    : null;
  vlog("current hash:", currentHash || "(none)");

  if (currentHash && currentHash === newHash) {
    log("in sync, nothing to do");
    process.exit(0);
  }

  const now = new Date().toISOString();
  const snapshotDate = now.slice(0, 10);

  // Reason: preserve all JSON Resume v1 keys verbatim. Strip incoming _snapshotMeta
  // (if any) and replace with fresh meta computed from current sync.
  const { _snapshotMeta: _drop, ...sourceBody } = source.parsed;
  const next = {
    _snapshotMeta: {
      source: "JobApplyFramework/Assets/resume.json",
      snapshotDate,
      sha256: newHash,
      syncedAt: now,
    },
    ...sourceBody,
  };

  const pretty = JSON.stringify(next, null, 2) + "\n";

  if (DRY_RUN) {
    log(`dry-run: would write ${TARGET_PATH} (${pretty.length} bytes, hash ${newHash})`);
    if (currentHash) {
      log(`dry-run: hash changing ${currentHash} -> ${newHash}`);
    } else {
      log(`dry-run: writing fresh snapshot (no prior _snapshotMeta)`);
    }
    process.exit(0);
  }

  await fs.mkdir(path.dirname(TARGET_PATH), { recursive: true });
  await fs.writeFile(TARGET_PATH, pretty, "utf8");
  log(`wrote ${TARGET_PATH} (${pretty.length} bytes, hash ${newHash})`);
}

main().catch((err) => {
  fail(err && err.stack ? err.stack : String(err));
});
