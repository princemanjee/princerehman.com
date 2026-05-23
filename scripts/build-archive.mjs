#!/usr/bin/env node
/**
 * build-archive.mjs
 *
 * Scans the sister repo (JobApplyFramework) for past tailored standalone
 * resumes and emits a structured, indexed archive at
 * `src/data/resumeArchive.json`. The archive feeds the Adaptive CV's
 * archive-matching layer (`src/lib/cv-archive-match.ts`) which ranks past
 * tailored resumes against the visitor's audience + optionally pasted JD.
 *
 * Pure Node built-ins (node:fs, node:path, node:crypto, node:process,
 * node:url). No external dependencies. Cross-platform paths.
 *
 * Source layout (read-only, from JobApplyFramework):
 *   <root>/[Workspace]/[JobTitle]/output/<Variant>/Manjee_*_Resume_*.md
 *   <root>/Applied/[Workspace]/[JobTitle]/output/<Variant>/...
 * Excludes:
 *   - `_v.md` red-team companion files
 *   - any path containing a `_files` segment (extracted asset folders)
 *
 * Behavior:
 *   - JOBAPPLY_PATH env var overrides the default `../JobApplyFramework`
 *     resolution.
 *   - If the source path is missing, exit 0 with a warning so CI doesn't
 *     break (mirrors the sync-resume.mjs pattern).
 *   - Files that don't parse cleanly are skipped with a stderr warning.
 *
 * Flags:
 *   --verbose, VERBOSE=1   Verbose logging
 *   --dry-run              Compute but don't write
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const TARGET_PATH = path.join(REPO_ROOT, "src", "data", "resumeArchive.json");

const args = new Set(process.argv.slice(2));
const VERBOSE = args.has("--verbose") || process.env.VERBOSE === "1";
const DRY_RUN = args.has("--dry-run");

function log(...parts) {
  console.log("[build-archive]", ...parts);
}
function vlog(...parts) {
  if (VERBOSE) log(...parts);
}
function warn(...parts) {
  console.warn("[build-archive] WARN:", ...parts);
}

function resolveSourceRoot() {
  const envPath = process.env.JOBAPPLY_PATH;
  return envPath && envPath.trim().length > 0
    ? path.resolve(envPath)
    : path.resolve(REPO_ROOT, "..", "JobApplyFramework");
}

// ---------------------------------------------------------------------------
// Filesystem walk
// ---------------------------------------------------------------------------

/**
 * Recursively walk `root`, yielding every regular file path. Skips any path
 * segment named exactly "node_modules", ".git", or ending in "_files".
 *
 * Reason: this is the only walker we need — a single full traversal is cheap
 * given that JobApplyFramework's tree is a few thousand files at most.
 */
async function* walk(root) {
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch (err) {
    if (err && err.code === "ENOENT") return;
    throw err;
  }
  for (const entry of entries) {
    const name = entry.name;
    if (name === "node_modules" || name === ".git") continue;
    if (name.endsWith("_files")) continue;
    const full = path.join(root, name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

/**
 * Returns true if the absolute path looks like a standalone tailored-resume
 * markdown file we want to ingest. Rejects `_v.md` red-team companions and
 * combined Resume-CoverLetter / CoverLetter-Resume artifacts (we want just
 * the standalone Resume document per the brief).
 */
function isStandaloneTailoredResume(absPath) {
  const ext = path.extname(absPath).toLowerCase();
  if (ext !== ".md") return false;
  const base = path.basename(absPath);
  if (!base.startsWith("Manjee_")) return false;
  if (base.endsWith("_v.md")) return false;
  // Standalone resume basenames contain "_Resume_" followed by a date; reject
  // combined documents like "_Resume-CoverLetter_..." or "_CoverLetter_..."
  if (!/_Resume_\d{4}-\d{2}-\d{2}\.md$/.test(base)) return false;
  // Path must include an /output/ segment so we ignore one-off MD scratch
  // files anywhere else in the tree.
  const norm = absPath.split(path.sep).join("/");
  if (!norm.includes("/output/")) return false;
  return true;
}

/**
 * Extract { company, jobTitle, variant, generatedDate } from a path of the
 * shape <root>/[Applied/][Company]/[JobTitle]/output/[Variant]/Manjee_..._Resume_YYYY-MM-DD.md
 *
 * Returns null if the path doesn't match the expected layout.
 */
function deriveWorkspace(absPath, sourceRoot) {
  const rel = path.relative(sourceRoot, absPath).split(path.sep);
  // We need at least: [Company, JobTitle, "output", Variant, filename]
  const outputIdx = rel.indexOf("output");
  if (outputIdx < 2) return null;
  if (outputIdx + 2 >= rel.length) return null;
  const variant = rel[outputIdx + 1];
  const filename = rel[rel.length - 1];

  // Walk backward from "output" to find Company + JobTitle. Some workspaces
  // are nested under "Applied/", so we look at the two segments immediately
  // before "output".
  const jobTitle = rel[outputIdx - 1];
  const company = rel[outputIdx - 2];

  // Date from filename: ..._Resume_YYYY-MM-DD.md
  const m = filename.match(/_Resume_(\d{4}-\d{2}-\d{2})\.md$/);
  const generatedDate = m ? m[1] : "";

  // Reason: workspace folder names use underscores for spaces. Restore them
  // to spaces for human-readable display. Strip a trailing slash, leftover
  // bracketed encodings (the â€“ mojibake -> en-dash), and underscore->space.
  function humanize(s) {
    return s
      .replace(/_/g, " ")
      .replace(/â/g, "-") // mojibaked en-dash
      .replace(/\s+/g, " ")
      .trim();
  }

  return {
    company: humanize(company),
    jobTitle: humanize(jobTitle),
    variant,
    generatedDate,
    sourceFile: rel.join("/"),
  };
}

// ---------------------------------------------------------------------------
// Markdown parsing
// ---------------------------------------------------------------------------

/**
 * Strip surrounding inline-Markdown formatting (bold/italic/links) from a
 * single line so downstream consumers see plain text. Preserves the visible
 * label of links: `[label](url)` -> `label`.
 */
function stripInlineMd(s) {
  let out = s;
  // Links: [text](url) -> text
  out = out.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  // Bold/italic markers
  out = out.replace(/\*\*([^*]+)\*\*/g, "$1");
  out = out.replace(/\*([^*]+)\*/g, "$1");
  out = out.replace(/__([^_]+)__/g, "$1");
  // Inline code backticks
  out = out.replace(/`([^`]+)`/g, "$1");
  return out.trim();
}

/**
 * Position-side keyword set used to disambiguate "Left, Right" headings
 * where either side might be the company. If the LEFT side starts with one
 * of these words, treat the heading as "Position, Company". Otherwise we
 * default to "Company, Position" (the more common form across the corpus).
 *
 * Reason: the workspaces in JobApplyFramework use inconsistent ordering.
 * ROADRUNNER: "Position, Company". Trustmark: "Company, Position".
 * Saragossa / Phaxis: "Company - Position" (em-dash unambiguous).
 */
const POSITION_LEADING_WORDS = new Set([
  "senior", "director", "manager", "vice", "vp", "head", "chief", "principal",
  "lead", "leader", "consultant", "architect", "engineer", "developer",
  "administrator", "specialist", "analyst", "ai", "ux", "ui", "it",
  "cybersecurity", "security", "data", "cloud", "software", "solutions",
  "technology", "technical", "information", "systems", "executive", "contract",
  "interim", "founder", "founding", "co-founder", "owner", "member", "advisor",
  "board", "associate", "assistant", "regional", "global", "enterprise",
  "platform", "product", "digital", "modern", "workplace",
]);

function splitCompanyPosition(heading) {
  // Em-dash / en-dash split: unambiguous "Company - Position".
  const dashMatch = heading.match(/^(.+?)\s+[-]\s+(.+)$/u);
  if (dashMatch) {
    return { company: dashMatch[1].trim(), position: dashMatch[2].trim() };
  }
  // Bracket / hyphen with surrounding spaces - already handled above; check
  // also for ASCII " - " (a single hyphen with spaces).
  const ascDashMatch = heading.match(/^(.+?)\s+-\s+(.+)$/);
  if (ascDashMatch) {
    return { company: ascDashMatch[1].trim(), position: ascDashMatch[2].trim() };
  }
  // Comma split: ambiguous - use the position-keyword heuristic.
  const commaIdx = heading.indexOf(",");
  if (commaIdx > 0) {
    const left = heading.slice(0, commaIdx).trim();
    const right = heading.slice(commaIdx + 1).trim();
    const leftFirstWord = (left.split(/\s+/)[0] || "").toLowerCase();
    if (POSITION_LEADING_WORDS.has(leftFirstWord)) {
      // Heading is "Position, Company".
      return { company: right, position: left };
    }
    // Default: "Company, Position".
    return { company: left, position: right };
  }
  // No separator we can recognize - treat the whole heading as position.
  return { company: "", position: heading };
}

/**
 * Parse the canonical tailored-resume Markdown into a structured object.
 *
 * The parser is deliberately tolerant: missing sections produce empty
 * arrays/strings; section order doesn't matter as long as headings use
 * `## SectionName`. Two experience shapes are recognized:
 *
 *   FullCV shape:   ### Position, Company / *dates*   then bullets
 *   Default_1pg:    **Position, Company** dates / bullets
 *
 * Inline "Earlier Experience" paragraph-style entries are flattened into
 * a single bullet per line so the entry remains addressable.
 */
function parseResumeMd(md) {
  const lines = md.split(/\r?\n/);

  // Find each top-level `## Heading` line and the range of body lines that
  // belongs to it. The body extends until the next `## Heading` or EOF.
  const sectionRanges = [];
  let currentName = null;
  let currentStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^##\s+(.+?)\s*$/);
    if (m) {
      if (currentName !== null) {
        sectionRanges.push({ name: currentName, start: currentStart, end: i });
      }
      currentName = m[1].trim();
      currentStart = i + 1;
    }
  }
  if (currentName !== null) {
    sectionRanges.push({ name: currentName, start: currentStart, end: lines.length });
  }

  function sectionLines(predicateName) {
    const r = sectionRanges.find(
      (sr) => sr.name.toLowerCase() === predicateName.toLowerCase(),
    );
    if (!r) return [];
    return lines.slice(r.start, r.end);
  }

  // ---- Summary: first non-empty paragraph ----
  function paragraphText(secLines) {
    const collected = [];
    for (const ln of secLines) {
      const t = ln.trim();
      if (t === "" && collected.length > 0) break;
      if (t === "") continue;
      collected.push(t);
    }
    return stripInlineMd(collected.join(" "));
  }

  const summary = paragraphText(sectionLines("Summary"));

  // ---- Skills: collapse everything (paragraph or bullet) into one string ----
  function flattenSkills(secLines) {
    const pieces = [];
    for (const ln of secLines) {
      const t = ln.trim();
      if (t === "") continue;
      if (t.startsWith("- ")) {
        pieces.push(stripInlineMd(t.slice(2)));
      } else if (t.startsWith("**") || t.startsWith("###")) {
        pieces.push(stripInlineMd(t));
      } else {
        pieces.push(stripInlineMd(t));
      }
    }
    return pieces.join(" ");
  }

  const skills = flattenSkills(sectionLines("Skills"));

  // ---- Bulleted list section: every "- " line becomes one string entry ----
  function bulletList(name) {
    const secLines = sectionLines(name);
    const out = [];
    for (const ln of secLines) {
      const t = ln.trim();
      if (t.startsWith("- ")) {
        out.push(stripInlineMd(t.slice(2)));
      }
    }
    return out;
  }

  const education = bulletList("Education");
  const certifications = bulletList("Certifications");
  const publications = bulletList("Publications");
  const awards = bulletList("Awards");
  const volunteer = bulletList("Volunteer");
  const languages = bulletList("Languages");

  // If "Education" came across as a single paragraph (the Default_1pg variant
  // does this), fall back to splitting on ". " so each degree still surfaces.
  let educationOut = education;
  if (educationOut.length === 0) {
    const edSec = sectionLines("Education");
    const paragraph = paragraphText(edSec);
    if (paragraph) {
      educationOut = paragraph
        .split(/\.\s+(?=[A-Z*])/)
        .map((s) => stripInlineMd(s.replace(/\.$/, "").trim()))
        .filter(Boolean);
    }
  }

  // ---- Experience parsing (FullCV `### ...` shape + Default_1pg inline) ----
  function parseExperience() {
    const secLines = sectionLines("Experience");
    if (secLines.length === 0) return [];
    const roles = [];

    // First pass: FullCV `### Company, Position` or `### Position, Company`
    // or `### Company — Position` (em-dash) followed by `*dates*` and bullets.
    let current = null;
    let inEarlierBlock = false;
    for (let i = 0; i < secLines.length; i++) {
      const raw = secLines[i];
      const t = raw.trim();
      const headingMatch = t.match(/^###\s+(.+?)\s*$/);
      if (headingMatch) {
        if (current) roles.push(current);
        const heading = stripInlineMd(headingMatch[1]);
        const { company, position } = splitCompanyPosition(heading);
        current = {
          position,
          company,
          dateRange: "",
          bullets: [],
        };
        inEarlierBlock = false;
        continue;
      }
      // The "Earlier Experience" sub-block appears as `### Earlier Experience`
      // followed by inline paragraph entries.
      if (/^###\s+Earlier Experience\s*$/i.test(t)) {
        if (current) roles.push(current);
        current = null;
        inEarlierBlock = true;
        continue;
      }
      if (inEarlierBlock) {
        if (t.length === 0) continue;
        // Each non-empty line is a one-line role record.
        const cleaned = stripInlineMd(t);
        // Try to split on first ", " (company, rest) and pull a date range.
        const cMatch = cleaned.match(/^([^,]+),\s*([^()]+?)\s*\(([^)]+)\)\s*:?\s*(.*)$/);
        if (cMatch) {
          roles.push({
            company: cMatch[1].trim(),
            position: cMatch[2].trim(),
            dateRange: cMatch[3].trim(),
            bullets: cMatch[4] ? [cMatch[4].trim()] : [],
          });
        } else {
          roles.push({
            company: "",
            position: cleaned,
            dateRange: "",
            bullets: [],
          });
        }
        continue;
      }
      if (current) {
        // Date line is sometimes `*dates*` (italic) and sometimes `**dates**`
        // (bold). Either is one-line, surrounded by markers, no bullet prefix.
        const italicDate = t.match(/^\*([^*]+)\*\s*$/);
        const boldDate = t.match(/^\*\*([^*]+)\*\*\s*$/);
        const dateText = boldDate ? boldDate[1] : italicDate ? italicDate[1] : "";
        if (dateText && !current.dateRange) {
          current.dateRange = dateText.trim();
          continue;
        }
        if (t.startsWith("- ")) {
          current.bullets.push(stripInlineMd(t.slice(2)));
          continue;
        }
      }
    }
    if (current) roles.push(current);

    // Second pass: if pass-1 found nothing, this is probably a Default_1pg
    // variant where each role is `**Company, Position**` on a single line
    // followed by bullets. Parse that shape.
    if (roles.length === 0) {
      let current2 = null;
      for (const raw of secLines) {
        const t = raw.trim();
        if (t.length === 0) continue;
        // Heading-ish line that begins with `**`
        const boldHeading = t.match(/^\*\*([^*]+)\*\*\s*(.*)$/);
        if (boldHeading) {
          if (current2) roles.push(current2);
          const heading = stripInlineMd(boldHeading[1]);
          const tail = stripInlineMd(boldHeading[2] || "");
          const { company, position } = splitCompanyPosition(heading);
          // Extract date range from the tail (looks like ". May 2021 to Dec 2024.")
          let dateRange = "";
          const dateMatch = tail.match(
            /([A-Z][a-z]+ \d{4}(?:\s+to\s+(?:[A-Z][a-z]+ \d{4}|Present))?)/,
          );
          if (dateMatch) dateRange = dateMatch[1];
          current2 = { position, company, dateRange, bullets: [] };
          // The remainder of the tail (after date / period) can be a bullet.
          continue;
        }
        if (t.startsWith("- ") && current2) {
          current2.bullets.push(stripInlineMd(t.slice(2)));
          continue;
        }
      }
      if (current2) roles.push(current2);
    }

    return roles;
  }

  function parseProjects() {
    const secLines = sectionLines("Projects");
    if (secLines.length === 0) return [];
    const projects = [];

    let current = null;
    for (let i = 0; i < secLines.length; i++) {
      const t = secLines[i].trim();
      if (t === "") continue;
      // FullCV shape: "- **Name** (date): body..."
      const projBullet = t.match(/^-\s+\*\*([^*]+)\*\*\s*(?:\(([^)]+)\))?\s*:?\s*(.*)$/);
      if (projBullet) {
        if (current) projects.push(current);
        const name = stripInlineMd(projBullet[1]);
        const dateRange = (projBullet[2] || "").trim();
        const body = stripInlineMd(projBullet[3] || "");
        current = {
          name,
          dateRange,
          bullets: body ? [body] : [],
        };
        continue;
      }
      // FullCV alternate shape: "### Project Name\n*dates*\n- bullets"
      const heading = t.match(/^###\s+(.+?)\s*$/);
      if (heading) {
        if (current) projects.push(current);
        current = { name: stripInlineMd(heading[1]), dateRange: "", bullets: [] };
        continue;
      }
      if (current) {
        const italic = t.match(/^\*([^*]+)\*\s*$/);
        if (italic && !current.dateRange) {
          current.dateRange = italic[1].trim();
          continue;
        }
        if (t.startsWith("- ")) {
          current.bullets.push(stripInlineMd(t.slice(2)));
          continue;
        }
      }
    }
    if (current) projects.push(current);
    return projects;
  }

  const experience = parseExperience();
  const projects = parseProjects();

  // ---- Keyword extraction (simple stopword + length filter) ----
  const keywords = extractKeywords(summary, skills, experience);

  return {
    summary,
    skills,
    experience,
    projects,
    education: educationOut,
    certifications,
    publications,
    awards,
    volunteer,
    languages,
    keywords,
  };
}

// ---------------------------------------------------------------------------
// Keyword extraction
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "have", "has", "had",
  "been", "into", "over", "across", "through", "their", "they", "them", "than",
  "then", "also", "more", "most", "some", "such", "each", "very", "just", "into",
  "about", "after", "before", "between", "among", "during", "while", "when",
  "where", "what", "which", "whose", "who", "whom", "your", "yours", "ours",
  "mine", "his", "hers", "its", "any", "all", "but", "not", "nor", "yet",
  "are", "was", "were", "will", "would", "could", "should", "may", "might",
  "shall", "must", "can", "did", "does", "doing", "done", "made", "make",
  "make", "made", "use", "used", "using", "uses", "via", "per", "out",
  "under", "above", "below", "off", "out", "own", "only", "many", "much",
  "few", "lot", "lots", "etc", "ie", "eg", "ex", "vs", "etc.", "etc",
  "high", "low", "new", "old", "big", "small", "well", "good", "great",
  "best", "better", "worse", "worst", "less", "least", "more", "most",
  "based", "include", "includes", "including", "included", "ensure",
  "ensures", "ensuring", "ensured", "drive", "drove", "driven", "driving",
  "drives", "lead", "leads", "leading", "led", "led.", "build", "builds",
  "building", "built", "deliver", "delivers", "delivered", "delivering",
  "delivery", "across", "within", "without", "between", "around",
  "above", "below", "into", "onto", "upon", "while", "until", "since",
  "year", "years", "month", "months", "day", "days", "week", "weeks",
  "team", "teams", "work", "works", "working", "worked", "role", "roles",
  "company", "companies", "client", "clients", "stakeholder", "stakeholders",
  "responsible", "responsibility", "responsibilities",
]);

function extractKeywords(summary, skills, experience) {
  const corpus = [summary, skills];
  for (const role of experience || []) {
    for (const bullet of role.bullets || []) corpus.push(bullet);
  }
  const joined = corpus.join(" ").toLowerCase();

  // Token boundary: anything that isn't a letter/digit/+/-/./# splits.
  // Reason: we want to keep "c++", "ci/cd", "azure-active-directory", and
  // ".net" intact where present.
  const rawTokens = joined.split(/[^a-z0-9+#./-]+/);

  const freq = new Map();
  for (let tok of rawTokens) {
    if (!tok) continue;
    // Strip leading/trailing punctuation we still allow inside.
    tok = tok.replace(/^[-./#]+|[-./#]+$/g, "");
    if (tok.length < 4) continue;
    if (STOPWORDS.has(tok)) continue;
    // Drop pure-number tokens like "2025" or "1.2".
    if (/^[0-9.]+$/.test(tok)) continue;
    freq.set(tok, (freq.get(tok) || 0) + 1);
  }

  const sorted = Array.from(freq.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  return sorted.slice(0, 20).map(([term]) => term);
}

// ---------------------------------------------------------------------------
// Top-level scan
// ---------------------------------------------------------------------------

async function main() {
  const sourceRoot = resolveSourceRoot();
  vlog("source root:", sourceRoot);
  vlog("target path:", TARGET_PATH);

  try {
    await fs.access(sourceRoot);
  } catch {
    warn(`source root not found at ${sourceRoot} - exiting cleanly.`);
    process.exit(0);
  }

  const workspaces = new Set();
  const entries = [];
  let skipped = 0;

  for await (const absPath of walk(sourceRoot)) {
    if (!isStandaloneTailoredResume(absPath)) continue;
    const workspace = deriveWorkspace(absPath, sourceRoot);
    if (!workspace) {
      warn(`could not derive workspace from path: ${absPath}`);
      skipped++;
      continue;
    }
    let raw;
    try {
      raw = await fs.readFile(absPath, "utf8");
    } catch (err) {
      warn(`failed to read ${absPath}: ${err && err.message}`);
      skipped++;
      continue;
    }

    let parsed;
    try {
      parsed = parseResumeMd(raw);
    } catch (err) {
      warn(`failed to parse ${absPath}: ${err && err.message}`);
      skipped++;
      continue;
    }

    workspaces.add(`${workspace.company}/${workspace.jobTitle}`);

    const wordCount = raw.split(/\s+/).filter(Boolean).length;
    entries.push({
      sourceFile: workspace.sourceFile,
      workspace: {
        company: workspace.company,
        jobTitle: workspace.jobTitle,
        variant: workspace.variant,
      },
      ...parsed,
      generatedDate: workspace.generatedDate,
      wordCount,
    });
  }

  // Sort: newest first, then by company + variant for stable output.
  entries.sort((a, b) => {
    if (a.generatedDate !== b.generatedDate) {
      return a.generatedDate < b.generatedDate ? 1 : -1;
    }
    if (a.workspace.company !== b.workspace.company) {
      return a.workspace.company.localeCompare(b.workspace.company);
    }
    return a.workspace.variant.localeCompare(b.workspace.variant);
  });

  const archive = {
    _meta: {
      source: "JobApplyFramework standalone tailored resumes",
      generatedAt: new Date().toISOString(),
      sourceRoot: path.relative(REPO_ROOT, sourceRoot).split(path.sep).join("/"),
      entryCount: entries.length,
      workspaceCount: workspaces.size,
      contentHash: crypto
        .createHash("sha256")
        .update(JSON.stringify(entries))
        .digest("hex"),
    },
    entries,
  };

  const pretty = JSON.stringify(archive, null, 2) + "\n";

  if (DRY_RUN) {
    log(
      `dry-run: would write ${TARGET_PATH} (${pretty.length} bytes), ` +
        `${entries.length} entries, ${workspaces.size} workspaces, ${skipped} skipped`,
    );
    process.exit(0);
  }

  await fs.mkdir(path.dirname(TARGET_PATH), { recursive: true });
  await fs.writeFile(TARGET_PATH, pretty, "utf8");
  const kb = (pretty.length / 1024).toFixed(1);
  log(
    `[ok] scanned ${workspaces.size} workspaces, ${entries.length} variants, ` +
      `wrote src/data/resumeArchive.json (${kb} KB)`,
  );
  if (skipped > 0) {
    warn(`${skipped} file(s) were skipped due to parse / read errors.`);
  }
}

main().catch((err) => {
  console.error("[build-archive] FATAL:", err && err.stack ? err.stack : String(err));
  process.exit(1);
});
