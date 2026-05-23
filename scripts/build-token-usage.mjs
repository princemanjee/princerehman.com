#!/usr/bin/env node
/**
 * build-token-usage.mjs
 *
 * Scans src/** for `var(--token)` references and emits
 * `src/data/tokenUsage.json` mapping each token to the selectors / class
 * names / files that reference it.
 *
 * Pure Node built-ins (fs, path, url). No external deps.
 *
 * Usage:
 *   node scripts/build-token-usage.mjs
 *
 * Output shape:
 *   {
 *     generated_at: "<ISO timestamp>",
 *     tokens: {
 *       "--accent-royal": [
 *         { file: "src/styles/global.css", line: 57, context: "::selection" },
 *         ...
 *       ],
 *       ...
 *     }
 *   }
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(REPO_ROOT, "src");
const OUTPUT_FILE = path.join(REPO_ROOT, "src", "data", "tokenUsage.json");

const SCAN_EXTENSIONS = new Set([
  ".astro",
  ".css",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
]);

// Regex for `var(--token)` references. Captures the token name including the
// leading `--`. Allows optional whitespace between `(` and `--`.
const VAR_REGEX = /var\(\s*(--[a-zA-Z0-9_-]+)/g;

// Loose regex to detect malformed `var(` calls so we can warn (not crash).
const MALFORMED_VAR_REGEX = /var\(\s*(?!--|var\()[^)]{0,40}/g;

/**
 * Recursively walk a directory, returning the absolute paths of all files
 * whose extension is in SCAN_EXTENSIONS.
 */
async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    process.stderr.write(`[warn] cannot read directory ${dir}: ${err.message}\n`);
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip the conventional vendor/build sinkholes if any ever appear here.
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      out.push(...(await walk(full)));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SCAN_EXTENSIONS.has(ext)) out.push(full);
    }
  }
  return out;
}

/**
 * Normalize a CSS selector string. Strips comments, collapses whitespace,
 * removes leading "}" that may have been captured when peeling back from
 * a previous rule.
 */
function normalizeSelector(raw) {
  let s = raw;
  // Strip full /* ... */ comments.
  s = s.replace(/\/\*[\s\S]*?\*\//g, " ");
  // Strip dangling partial comments — `buildCssRuleIndex`'s backward walk
  // doesn't know about comments, so the captured slice can start in the
  // middle of a comment. Drop everything up to a stray `*/` and everything
  // after a stray `/*`.
  const lastClose = s.lastIndexOf("*/");
  if (lastClose !== -1 && !s.slice(0, lastClose).includes("/*")) {
    s = s.slice(lastClose + 2);
  }
  const firstOpen = s.indexOf("/*");
  if (firstOpen !== -1 && !s.slice(firstOpen).includes("*/")) {
    s = s.slice(0, firstOpen);
  }
  // Keep only after the last `}` `{` or `;` (defensive — usually a no-op).
  s = s.replace(/^[\s\S]*[}{;]/, "");
  return s.replace(/\s+/g, " ").trim();
}

/**
 * For a CSS-like file, build a list of `{ openIdx, selector }` for every `{`
 * brace, so we can later determine which selector a given character offset
 * sits inside. Tracks brace nesting so nested at-rules (@media { ... }) work.
 *
 * Returns an array of "rule openings" sorted by openIdx. For each `var(`
 * match at offset O we pick the *innermost* opening whose openIdx < O and
 * whose corresponding `}` is > O.
 */
function buildCssRuleIndex(text) {
  const rules = [];
  const stack = []; // stack of rule indices currently open
  let i = 0;
  let inString = null; // "'" or '"' when inside a string literal
  let inComment = false;

  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];

    if (inComment) {
      if (ch === "*" && next === "/") {
        inComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (inString) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === inString) inString = null;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      inComment = true;
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = ch;
      i++;
      continue;
    }
    if (ch === "{") {
      // Walk backward to capture the selector text. Stop at the previous
      // `{`, `}`, or `;` at the same nesting layer (close enough for our
      // purposes since we ignore braces inside strings/comments above).
      let j = i - 1;
      while (j >= 0) {
        const cj = text[j];
        if (cj === "}" || cj === "{" || cj === ";") break;
        j--;
      }
      const rawSelector = text.slice(j + 1, i);
      const selector = normalizeSelector(rawSelector) || "(unknown selector)";
      const ruleIdx = rules.length;
      rules.push({ openIdx: i, closeIdx: -1, selector });
      stack.push(ruleIdx);
      i++;
      continue;
    }
    if (ch === "}") {
      const ruleIdx = stack.pop();
      if (ruleIdx != null) rules[ruleIdx].closeIdx = i;
      i++;
      continue;
    }
    i++;
  }
  // Any unclosed rules: treat as extending to EOF (defensive).
  for (const r of rules) {
    if (r.closeIdx === -1) r.closeIdx = text.length;
  }
  return rules;
}

/**
 * For a given character offset in CSS text, find the innermost rule whose
 * span contains it. Returns the selector string, or null.
 */
function selectorAt(rules, offset) {
  let best = null;
  for (const r of rules) {
    if (r.openIdx < offset && offset < r.closeIdx) {
      if (best === null || r.openIdx > best.openIdx) best = r;
    }
  }
  return best ? best.selector : null;
}

/**
 * Best-effort enclosing class lookup for component-style files
 * (.astro / .tsx / .jsx / .ts / .js).
 *
 * Strategy: walk backward from the `var(` offset and find the nearest
 * `class="..."`, `className="..."`, or `class:list={[ ... ]}` attribute.
 * We only consider attributes that occur AFTER the most recent `<` and
 * before the match. If nothing useful is found, returns "inline style".
 */
function classContextAt(text, offset) {
  // Find the start of the current element by scanning backward for `<`
  // that is not part of `</` or `<!--`.
  let elementStart = -1;
  for (let k = offset - 1; k >= 0; k--) {
    if (text[k] === "<") {
      if (text[k + 1] === "/" || text[k + 1] === "!") continue;
      elementStart = k;
      break;
    }
  }
  if (elementStart === -1) return "inline style";

  // The element-opening text we will scan is from elementStart up to the
  // var match. (We don't search past it.)
  const window = text.slice(elementStart, offset);

  // 1) class:list={[ ... ]} — pull all string literals from the array.
  const listMatch = /\bclass:list\s*=\s*\{?\s*\[([\s\S]*?)\]/.exec(window);
  if (listMatch) {
    const inner = listMatch[1];
    const strings = [];
    const strRe = /["'`]([^"'`]+)["'`]/g;
    let m;
    while ((m = strRe.exec(inner)) !== null) {
      // Skip template-expression bits that look like template names like
      // `brand-mark--${size}` — the bare-string portion still gives us
      // a useful anchor though.
      strings.push(m[1].trim());
    }
    if (strings.length) {
      // Concatenate; the first literal is usually the base class.
      const joined = strings.filter(Boolean).join(" ").trim();
      if (joined) return joined;
    }
  }

  // 2) class="..." or className="..." (also supports single quotes & backticks).
  const classMatch =
    /\b(?:class|className)\s*=\s*["'`]([^"'`]+)["'`]/.exec(window);
  if (classMatch) {
    return classMatch[1].trim();
  }

  // 3) class={`...`} or className={`...`} template literal.
  const tplMatch =
    /\b(?:class|className)\s*=\s*\{\s*`([^`]+)`\s*\}/.exec(window);
  if (tplMatch) {
    return tplMatch[1].replace(/\$\{[^}]*\}/g, "").trim() || "inline style";
  }

  return "inline style";
}

/**
 * Map a character offset back to a 1-based line number. We precompute a
 * sorted array of line-start offsets to make this O(log n).
 */
function buildLineIndex(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function lineFromOffset(lineStarts, offset) {
  // Binary search for the greatest line start <= offset.
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (lineStarts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

/**
 * Locate `<style>...</style>` blocks within a component-style file and
 * return their inner-content ranges (start/end offsets of the CSS body).
 *
 * Reason: `.astro` files commonly use `var(--token)` inside `<style>` blocks,
 * where the meaningful context is the CSS selector, not a JSX class. We
 * dual-mode the scanner so the right context is captured in each region.
 */
function findStyleBlocks(text) {
  const blocks = [];
  // Match opening `<style ...>` (any attributes) and its closing `</style>`.
  const re = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const openEnd = m.index + m[0].indexOf(">") + 1;
    const closeStart = m.index + m[0].lastIndexOf("</style>");
    blocks.push({ start: openEnd, end: closeStart });
  }
  return blocks;
}

function inStyleBlock(blocks, offset) {
  for (const b of blocks) {
    if (offset >= b.start && offset < b.end) return b;
  }
  return null;
}

async function scanFile(absPath, tokens) {
  let text;
  try {
    text = await fs.readFile(absPath, "utf8");
  } catch (err) {
    process.stderr.write(`[warn] cannot read ${absPath}: ${err.message}\n`);
    return;
  }

  const relPath = path
    .relative(REPO_ROOT, absPath)
    .split(path.sep)
    .join("/"); // forward-slash for cross-platform JSON

  const ext = path.extname(absPath).toLowerCase();
  const isCss = ext === ".css";
  const lineStarts = buildLineIndex(text);

  // For component files, detect `<style>` blocks and build a CSS rule index
  // for each block independently (offsets are file-global so a single index
  // works as long as we restrict selectorAt() lookups to the block range).
  const styleBlocks = isCss ? null : findStyleBlocks(text);
  let cssRules;
  if (isCss) {
    cssRules = buildCssRuleIndex(text);
  } else if (styleBlocks && styleBlocks.length) {
    // Build one combined rules list by scanning each block, offsetting to
    // file-global positions. We re-use buildCssRuleIndex on the block body
    // and add the block-start offset to every rule's open/close index.
    cssRules = [];
    for (const b of styleBlocks) {
      const body = text.slice(b.start, b.end);
      const local = buildCssRuleIndex(body);
      for (const r of local) {
        cssRules.push({
          openIdx: r.openIdx + b.start,
          closeIdx: r.closeIdx + b.start,
          selector: r.selector,
        });
      }
    }
  } else {
    cssRules = null;
  }

  // Warn about suspicious-looking var( calls that don't start with `--`.
  // (We deliberately do this BEFORE the main scan so the warnings come out
  // even if no valid tokens exist in the file.)
  MALFORMED_VAR_REGEX.lastIndex = 0;
  let mm;
  while ((mm = MALFORMED_VAR_REGEX.exec(text)) !== null) {
    // Filter out the legitimate cases: nested `var(var(` is fine and the
    // outer regex hands that to the inner one. Also skip if the captured
    // payload begins with `--` (paranoid double-check).
    const snippet = mm[0];
    if (/var\(\s*--/.test(snippet) || /var\(\s*var\(/.test(snippet)) continue;
    // Skip blank var() — that's just not-yet-typed code, not a malformation.
    if (/var\(\s*\)/.test(snippet)) continue;
    const line = lineFromOffset(lineStarts, mm.index);
    process.stderr.write(
      `[warn] ${relPath}:${line} suspicious var() call: ${snippet.slice(0, 40)}\n`,
    );
  }

  VAR_REGEX.lastIndex = 0;
  let m;
  while ((m = VAR_REGEX.exec(text)) !== null) {
    const tokenName = m[1];
    const offset = m.index;
    const line = lineFromOffset(lineStarts, offset);

    let context;
    if (isCss) {
      context = selectorAt(cssRules, offset) || "(file scope)";
    } else if (styleBlocks && inStyleBlock(styleBlocks, offset)) {
      // Reason: `<style>` block contents in .astro / .tsx files are CSS;
      // the meaningful context is the selector, not a JSX class.
      context = selectorAt(cssRules, offset) || "(style block)";
    } else {
      context = classContextAt(text, offset);
    }

    if (!tokens[tokenName]) tokens[tokenName] = [];
    tokens[tokenName].push({ file: relPath, line, context });
  }
}

function dedupeAndSort(tokens) {
  for (const name of Object.keys(tokens)) {
    const seen = new Set();
    const unique = [];
    for (const e of tokens[name]) {
      const key = `${e.file}|${e.line}|${e.context}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(e);
    }
    unique.sort((a, b) => {
      if (a.file < b.file) return -1;
      if (a.file > b.file) return 1;
      return a.line - b.line;
    });
    tokens[name] = unique;
  }
  // Sort token keys alphabetically for stable output.
  const sortedKeys = Object.keys(tokens).sort();
  const sorted = {};
  for (const k of sortedKeys) sorted[k] = tokens[k];
  return sorted;
}

async function main() {
  const startedAt = Date.now();

  let stat;
  try {
    stat = await fs.stat(SRC_DIR);
  } catch {
    process.stderr.write(`[fatal] src directory not found at ${SRC_DIR}\n`);
    process.exit(1);
  }
  if (!stat.isDirectory()) {
    process.stderr.write(`[fatal] ${SRC_DIR} is not a directory\n`);
    process.exit(1);
  }

  const files = await walk(SRC_DIR);
  files.sort();

  const tokens = {};
  for (const f of files) {
    await scanFile(f, tokens);
  }

  const sortedTokens = dedupeAndSort(tokens);

  const payload = {
    generated_at: new Date().toISOString(),
    tokens: sortedTokens,
  };

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(
    OUTPUT_FILE,
    JSON.stringify(payload, null, 2) + "\n",
    "utf8",
  );

  const totalRefs = Object.values(sortedTokens).reduce(
    (n, arr) => n + arr.length,
    0,
  );
  const elapsed = Date.now() - startedAt;
  process.stdout.write(
    `[ok] scanned ${files.length} files, ` +
      `found ${Object.keys(sortedTokens).length} tokens / ` +
      `${totalRefs} references in ${elapsed}ms ` +
      `-> ${path.relative(REPO_ROOT, OUTPUT_FILE).split(path.sep).join("/")}\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`[fatal] ${err.stack || err.message || err}\n`);
  process.exit(1);
});
