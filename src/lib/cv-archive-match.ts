/**
 * cv-archive-match.ts
 *
 * Pure-TS ranker that scores past tailored-resume archive entries against
 * (audience, JD-keywords) inputs and returns the top K matches.
 *
 * The archive is produced by `scripts/build-archive.mjs` and lives at
 * `src/data/resumeArchive.json`. This module is intentionally side-effect
 * free, has zero DOM / Astro dependencies, and is easy to unit-test under
 * vitest, jest, or node:test.
 *
 * Scoring strategy
 * ----------------
 *
 *   audienceScore   — exact heuristic match = 1.0, "related" pair = 0.6,
 *                     unrelated = 0.2, recruiter = 1.0 for everything.
 *
 *   keywordOverlap  — |jd_kw ∩ entry.keywords| / max(1, |jd_kw|). When jdText
 *                     is empty / undefined, keywordOverlap is not computed
 *                     and the final score equals audienceScore.
 *
 *   final           — 0.4 * audienceScore + 0.6 * keywordOverlap  (JD given)
 *                   = audienceScore                                (no JD)
 *
 *   recency tiebreaker — entries with newer generatedDate sort first when
 *                         scores tie within a few milli-points of each other.
 *
 * MATCH_THRESHOLD_GOOD is the cutoff below which callers should consider
 * falling back to a live Claude generation (Agent D wires that up); the
 * archive is "good enough to show as-is" at or above this score.
 */

import type { Audience } from "../data/cvAudienceTags";

// ---------------------------------------------------------------------------
// Types — describe the schema produced by scripts/build-archive.mjs
// ---------------------------------------------------------------------------

export interface ParsedRole {
  position: string;
  company: string;
  dateRange: string;
  bullets: string[];
}

export interface ParsedProject {
  name: string;
  dateRange: string;
  bullets: string[];
}

export interface ResumeArchiveEntry {
  sourceFile: string;
  workspace: {
    company: string;
    jobTitle: string;
    variant: string;
  };
  summary: string;
  skills: string;
  experience: ParsedRole[];
  projects: ParsedProject[];
  education: string[];
  certifications: string[];
  publications: string[];
  awards: string[];
  volunteer: string[];
  languages: string[];
  keywords: string[];
  generatedDate: string;
  wordCount: number;
}

export interface ArchiveMatch {
  entry: ResumeArchiveEntry;
  score: number;
  reasons: string[];
}

/**
 * Confidence threshold below which the caller should fall back to a fresh
 * Claude generation. At or above this, the archive entry is good enough to
 * show as-is. Empirically calibrated so an audience-only "related" match
 * (0.6 * 1.0 = 0.6) clears the bar but an unrelated match (0.2) does not.
 */
export const MATCH_THRESHOLD_GOOD = 0.55;

// ---------------------------------------------------------------------------
// Heuristic audience classification for an archive entry
// ---------------------------------------------------------------------------

const HEURISTIC_KEYWORDS: Record<Exclude<Audience, "default" | "recruiter">, string[]> = {
  cto: [
    "cto", "cio", "chief technology", "chief information", "vice president",
    "vp ", "executive director", "director of technology", "director, technology",
    "senior director", "principal", "head of", "innovation",
  ],
  engineer: [
    "engineer", "developer", "architect", "administrator", "devops", "sre",
    "software", "data center", "platform", "manager", "information technology",
    "it manager", "it director", "end user", "shared services",
  ],
  board: [
    "board", "advisor", "executive director", "chief", "president",
    "vice president", "chairman", "trustee", "governance",
  ],
  investor: [
    "founder", "co-founder", "owner", "venture", "investor", "partnership",
    "growth", "portfolio", "fund",
  ],
};

/**
 * Classify an archive entry into the single most-relevant audience based on
 * its workspace.jobTitle. The classifier is deliberately small and explicit;
 * curators can override matches by adding an explicit entry to
 * cvAudienceTags.ts (the heuristic only fires when nothing else has spoken).
 *
 * Returns the first audience whose keywords match the job title, in priority
 * order cto > board > investor > engineer. Defaults to "engineer" when no
 * keyword matches, since most tailored resumes in the corpus are IT roles.
 *
 * Exported for testing.
 */
export function heuristicAudienceFor(entry: ResumeArchiveEntry): Exclude<Audience, "default" | "recruiter"> {
  const title = (entry.workspace.jobTitle || "").toLowerCase();
  // Priority: cto first (most leadership signal), then board, then investor,
  // then engineer.
  for (const aud of ["cto", "board", "investor", "engineer"] as const) {
    for (const kw of HEURISTIC_KEYWORDS[aud]) {
      if (title.includes(kw)) return aud;
    }
  }
  return "engineer";
}

/**
 * Pairs of "related" audiences (used to award a partial 0.6 score when the
 * requested audience and the entry's heuristic audience don't match exactly
 * but are conceptually close).
 */
const RELATED_PAIRS: Array<[Audience, Audience]> = [
  ["cto", "engineer"],
  ["cto", "board"],
  ["board", "investor"],
  ["engineer", "default"],
  ["cto", "default"],
  ["board", "default"],
];

function isRelatedAudience(a: Audience, b: Audience): boolean {
  if (a === b) return true;
  for (const [x, y] of RELATED_PAIRS) {
    if ((a === x && b === y) || (a === y && b === x)) return true;
  }
  return false;
}

/**
 * Compute audienceScore: 1.0 exact, 0.6 related, 0.2 unrelated. The recruiter
 * audience treats every entry as a 1.0 ("show me everything") - that matches
 * the recruiter-view semantics already established in cvAudienceTags.ts.
 *
 * The "default" audience is similarly permissive but slightly less so (0.8) -
 * it means "balanced view, no slant", so every entry is relevant but no
 * single one is the strongest match.
 */
function scoreAudience(requested: Audience, entryAudience: Audience): number {
  if (requested === "recruiter") return 1.0;
  if (requested === "default") return 0.8;
  if (requested === entryAudience) return 1.0;
  if (isRelatedAudience(requested, entryAudience)) return 0.6;
  return 0.2;
}

// ---------------------------------------------------------------------------
// JD keyword extraction — must mirror the scanner's behavior
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "have", "has", "had",
  "been", "into", "over", "across", "through", "their", "they", "them", "than",
  "then", "also", "more", "most", "some", "such", "each", "very", "just",
  "about", "after", "before", "between", "among", "during", "while", "when",
  "where", "what", "which", "whose", "who", "whom", "your", "yours", "ours",
  "mine", "his", "hers", "its", "any", "all", "but", "not", "nor", "yet",
  "are", "was", "were", "will", "would", "could", "should", "may", "might",
  "shall", "must", "can", "did", "does", "doing", "done", "made", "make",
  "use", "used", "using", "uses", "via", "per", "out",
  "under", "above", "below", "off", "own", "only", "many", "much",
  "few", "lot", "lots", "etc",
  "high", "low", "new", "old", "big", "small", "well", "good", "great",
  "best", "better", "worse", "worst", "less", "least",
  "based", "include", "includes", "including", "included",
  "ensure", "ensures", "ensuring", "ensured",
  "drive", "drove", "driven", "driving", "drives",
  "lead", "leads", "leading", "led",
  "build", "builds", "building", "built",
  "deliver", "delivers", "delivered", "delivering", "delivery",
  "within", "without", "around", "onto", "upon", "while", "until", "since",
  "year", "years", "month", "months", "day", "days", "week", "weeks",
  "team", "teams", "work", "works", "working", "worked",
  "role", "roles", "company", "companies", "client", "clients",
  "stakeholder", "stakeholders",
  "responsible", "responsibility", "responsibilities",
]);

/**
 * Extract a deduped set of keywords from arbitrary text, applying the same
 * token boundary, stopword filter, and length threshold the scanner uses.
 * Returns an ordered array; callers typically convert this to a Set for
 * intersection scoring.
 *
 * Exported for testing.
 */
export function extractKeywords(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const rawTokens = lower.split(/[^a-z0-9+#./-]+/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (let tok of rawTokens) {
    if (!tok) continue;
    tok = tok.replace(/^[-./#]+|[-./#]+$/g, "");
    if (tok.length < 4) continue;
    if (STOPWORDS.has(tok)) continue;
    if (/^[0-9.]+$/.test(tok)) continue;
    if (seen.has(tok)) continue;
    seen.add(tok);
    out.push(tok);
  }
  return out;
}

function keywordOverlapRatio(jdKeywords: string[], entryKeywords: string[]): {
  ratio: number;
  matched: number;
  total: number;
} {
  if (jdKeywords.length === 0) return { ratio: 0, matched: 0, total: 0 };
  const entrySet = new Set(entryKeywords);
  let matched = 0;
  for (const k of jdKeywords) if (entrySet.has(k)) matched++;
  return { ratio: matched / jdKeywords.length, matched, total: jdKeywords.length };
}

// ---------------------------------------------------------------------------
// Reason-string helpers
// ---------------------------------------------------------------------------

function audienceLabel(aud: Audience): string {
  switch (aud) {
    case "cto":
      return "CTO-style";
    case "engineer":
      return "engineering-leadership";
    case "board":
      return "board / executive";
    case "investor":
      return "investor / founder-style";
    case "recruiter":
      return "broad-scan";
    case "default":
      return "balanced";
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Rank the archive against the visitor's audience and (optionally) pasted JD
 * text, returning the top K matches sorted by score desc. Pure function:
 * no side effects, no caching, deterministic for fixed inputs.
 *
 * @param audience  active audience preset (from the segmented control on /cv)
 * @param jdText    raw JD text (visitor paste); empty string or undefined
 *                  means "match on audience only"
 * @param archive   ResumeArchiveEntry[] from resumeArchive.json#entries
 * @param topK      max matches to return (default 5)
 */
export function matchArchive(
  audience: Audience,
  jdText: string | undefined,
  archive: ResumeArchiveEntry[],
  topK: number = 5,
): ArchiveMatch[] {
  if (!Array.isArray(archive) || archive.length === 0) return [];
  const hasJd = typeof jdText === "string" && jdText.trim().length > 0;
  const jdKeywords = hasJd ? extractKeywords(jdText as string) : [];

  const scored: ArchiveMatch[] = archive.map((entry) => {
    const entryAudience = heuristicAudienceFor(entry);
    const audienceScore = scoreAudience(audience, entryAudience);
    const reasons: string[] = [];

    let score = audienceScore;
    let overlap: ReturnType<typeof keywordOverlapRatio> | null = null;

    if (hasJd && jdKeywords.length > 0) {
      overlap = keywordOverlapRatio(jdKeywords, entry.keywords || []);
      // Weighted average: 0.4 audience + 0.6 JD overlap.
      score = 0.4 * audienceScore + 0.6 * overlap.ratio;
      reasons.push(
        `${overlap.matched} of ${overlap.total} JD keywords appear in this resume`,
      );
    }

    // Audience reason - mention how it matched.
    if (audience === "recruiter") {
      reasons.push("Recruiter view shows every archived workspace");
    } else if (audience === entryAudience) {
      reasons.push(
        `Workspace was a ${audienceLabel(entryAudience)} role at ${entry.workspace.company || "(unknown)"}`,
      );
    } else if (isRelatedAudience(audience, entryAudience)) {
      reasons.push(
        `Related audience: workspace is ${audienceLabel(entryAudience)}, request is ${audienceLabel(audience)}`,
      );
    } else {
      reasons.push(
        `Audience mismatch: workspace is ${audienceLabel(entryAudience)}, request is ${audienceLabel(audience)}`,
      );
    }

    // Recency reason - useful spot-check for callers.
    if (entry.generatedDate) {
      reasons.push(`Generated ${entry.generatedDate}`);
    }

    return { entry, score, reasons };
  });

  // Sort by score desc; tiebreak on generatedDate desc.
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ad = a.entry.generatedDate || "";
    const bd = b.entry.generatedDate || "";
    if (bd !== ad) return bd < ad ? -1 : 1;
    return a.entry.workspace.company.localeCompare(b.entry.workspace.company);
  });

  const k = Math.max(0, Math.floor(topK));
  return scored.slice(0, k);
}
