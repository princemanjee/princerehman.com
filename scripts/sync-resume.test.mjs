#!/usr/bin/env node
/**
 * sync-resume.test.mjs
 *
 * Tests for scripts/sync-resume.mjs using node --test.
 * Pure built-ins. Uses a temp fixture repo so the real src/data/resume.json
 * is never touched.
 */

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT = path.join(__dirname, "sync-resume.mjs");

// Fixture: minimal JSON Resume v1 covering every key the spec calls out.
const SAMPLE_RESUME = {
  $schema: "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json",
  basics: { name: "Sample Person", email: "sample@example.com" },
  work: [{ name: "Acme", position: "Engineer", startDate: "2020-01" }],
  projects: [{ name: "Project X", description: "Did things" }],
  education: [{ institution: "U", area: "CS", studyType: "BS" }],
  skills: [{ name: "TypeScript", level: "Advanced" }],
  certificates: [{ name: "Cert1", issuer: "Org" }],
  publications: [{ name: "Pub1", publisher: "Press" }],
  awards: [{ title: "Award1", awarder: "Body" }],
  volunteer: [{ organization: "NGO", position: "Helper" }],
  languages: [{ language: "English", fluency: "Native" }],
  interests: [{ name: "Cycling" }],
};

let workRoot;            // root temp dir
let fakeRepoRoot;        // simulates princerehman.com repo
let fakeScriptsDir;      // copy of scripts/ inside fakeRepoRoot
let fakeTargetPath;      // <fakeRepoRoot>/src/data/resume.json
let fakeJobApplyDir;     // simulates JobApplyFramework
let fakeSourcePath;      // <fakeJobApplyDir>/Assets/resume.json

before(async () => {
  workRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sync-resume-test-"));
});

after(async () => {
  await fs.rm(workRoot, { recursive: true, force: true });
});

beforeEach(async () => {
  // Fresh fake repos per test, so state from one test never leaks into another.
  const slot = crypto.randomBytes(6).toString("hex");
  fakeRepoRoot = path.join(workRoot, `repo-${slot}`);
  fakeScriptsDir = path.join(fakeRepoRoot, "scripts");
  fakeTargetPath = path.join(fakeRepoRoot, "src", "data", "resume.json");
  fakeJobApplyDir = path.join(workRoot, `jobapply-${slot}`);
  fakeSourcePath = path.join(fakeJobApplyDir, "Assets", "resume.json");

  await fs.mkdir(fakeScriptsDir, { recursive: true });
  await fs.mkdir(path.dirname(fakeTargetPath), { recursive: true });
  await fs.mkdir(path.dirname(fakeSourcePath), { recursive: true });

  // Copy script into the fake repo so __dirname-based resolution targets the fake src/data.
  const scriptSource = await fs.readFile(SCRIPT, "utf8");
  await fs.writeFile(path.join(fakeScriptsDir, "sync-resume.mjs"), scriptSource, "utf8");
});

function runSync(extraArgs = []) {
  const result = spawnSync(
    process.execPath,
    [path.join(fakeScriptsDir, "sync-resume.mjs"), ...extraArgs],
    {
      env: { ...process.env, JOBAPPLY_PATH: fakeJobApplyDir, VERBOSE: "" },
      encoding: "utf8",
    },
  );
  return { code: result.status, stdout: result.stdout || "", stderr: result.stderr || "" };
}

async function writeSource(obj = SAMPLE_RESUME) {
  await fs.writeFile(fakeSourcePath, JSON.stringify(obj, null, 2), "utf8");
}

async function readTargetIfExists() {
  try {
    const raw = await fs.readFile(fakeTargetPath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

test("sync writes the snapshot when target missing", async () => {
  await writeSource();
  const { code } = runSync();
  assert.equal(code, 0);
  const written = await readTargetIfExists();
  assert.ok(written, "target should exist");
  assert.ok(written._snapshotMeta, "_snapshotMeta should exist");
  assert.equal(typeof written._snapshotMeta.sha256, "string");
  assert.equal(written._snapshotMeta.sha256.length, 64);
  assert.equal(written.basics.name, "Sample Person");
});

test("sync no-ops when hashes match", async () => {
  await writeSource();
  // First run creates the target.
  runSync();
  const firstMtime = (await fs.stat(fakeTargetPath)).mtimeMs;

  // Wait long enough that mtime would observably change if file were rewritten.
  await new Promise((r) => setTimeout(r, 25));

  const { code, stdout } = runSync();
  assert.equal(code, 0);
  assert.match(stdout, /in sync, nothing to do/);
  const secondMtime = (await fs.stat(fakeTargetPath)).mtimeMs;
  assert.equal(secondMtime, firstMtime, "target should not be rewritten");
});

test("sync warns and exits 0 when source missing (build must not break)", async () => {
  // Don't write source.
  const { code, stderr } = runSync();
  assert.equal(code, 0);
  assert.match(stderr, /source not found/);
  // Target should remain absent — script must not invent one.
  const written = await readTargetIfExists();
  assert.equal(written, null);
});

test("sync preserves all JSON Resume v1 keys verbatim", async () => {
  await writeSource();
  runSync();
  const written = await readTargetIfExists();
  const required = [
    "basics", "work", "projects", "education", "skills",
    "certificates", "publications", "awards", "volunteer",
    "languages", "interests",
  ];
  for (const key of required) {
    assert.deepEqual(written[key], SAMPLE_RESUME[key], `key ${key} should be preserved verbatim`);
  }
  assert.equal(written.$schema, SAMPLE_RESUME.$schema);
});

test("sync overwrites _snapshotMeta with fresh values", async () => {
  // Seed target with stale meta.
  const stale = {
    _snapshotMeta: {
      source: "old/path",
      snapshotDate: "1999-01-01",
      sha256: "0".repeat(64),
      syncedAt: "1999-01-01T00:00:00.000Z",
    },
    ...SAMPLE_RESUME,
  };
  await fs.writeFile(fakeTargetPath, JSON.stringify(stale, null, 2), "utf8");

  // Source has different content -> hash will differ -> rewrite triggered.
  const modified = { ...SAMPLE_RESUME, basics: { ...SAMPLE_RESUME.basics, name: "Updated Name" } };
  await writeSource(modified);

  const { code } = runSync();
  assert.equal(code, 0);
  const written = await readTargetIfExists();
  assert.equal(written._snapshotMeta.source, "JobApplyFramework/Assets/resume.json");
  assert.notEqual(written._snapshotMeta.sha256, "0".repeat(64));
  assert.notEqual(written._snapshotMeta.snapshotDate, "1999-01-01");
  assert.notEqual(written._snapshotMeta.syncedAt, "1999-01-01T00:00:00.000Z");
  assert.equal(written.basics.name, "Updated Name");
});

test("dry-run does not modify the filesystem", async () => {
  await writeSource();
  const { code, stdout } = runSync(["--dry-run", "--verbose"]);
  assert.equal(code, 0);
  assert.match(stdout, /dry-run: would write/);
  const written = await readTargetIfExists();
  assert.equal(written, null, "target should NOT exist after dry-run");
});

test("source unparseable -> exit 1", async () => {
  await fs.writeFile(fakeSourcePath, "{ this is not json", "utf8");
  const { code, stderr } = runSync();
  assert.equal(code, 1);
  assert.match(stderr, /failed to parse source JSON/);
});
