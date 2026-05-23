/**
 * cvAudienceTags.ts
 *
 * Per-role and per-project audience tagging for the Adaptive CV system on
 * princerehman.com. The visitor selects one of six audience views (default,
 * cto, engineer, board, investor, recruiter); this module declares which
 * roles and projects should be visible and how prominently they should be
 * rendered for each view.
 *
 * Stable IDs
 * ----------
 * Every role is identified by `${work.name}__${work.startDate}` exactly as
 * those fields appear in resume.json (e.g. "Kaufman Hall__2015-06"). Projects
 * use `${project.name}__${project.startDate}` in the same way. The double
 * underscore avoids collision with any single underscores that already appear
 * in role names. IDs are stable as long as the resume.json work.name and
 * work.startDate fields don't change — the snapshot file `resume.json` in
 * this directory is the canonical source.
 *
 * Curation vs heuristic
 * ---------------------
 * The arrays ROLE_AUDIENCE_TAGS and PROJECT_AUDIENCE_TAGS below contain
 * explicit, hand-curated tags for the most important entries. For any role
 * or project that doesn't appear in these arrays, the `getRoleTag()` and
 * `emphasisFor()` helpers fall back to `deriveHeuristicTag()`, which infers
 * reasonable defaults from the position/name string using keyword matching.
 * That way future additions to resume.json don't crash the UI even if a
 * curator hasn't tagged them yet — they'll just render with sensible
 * defaults until someone adds an explicit entry.
 *
 * Emphasis semantics
 * ------------------
 *   "primary"   — feature this role prominently in the audience's view
 *                 (top of section, full bullets visible, larger card).
 *   "secondary" — show but de-emphasize (smaller card, fewer bullets,
 *                 lower in section).
 *   "hidden"    — do not render in this audience view at all.
 *
 * The recruiter view treats every role as at least "secondary"; recruiters
 * want comprehensive coverage. The other views are more selective.
 */

export type Audience = "default" | "cto" | "engineer" | "board" | "investor" | "recruiter";

export const AUDIENCES: readonly Audience[] = [
  "default",
  "cto",
  "engineer",
  "board",
  "investor",
  "recruiter",
] as const;

export const AUDIENCE_LABELS: Record<Audience, string> = {
  default: "Overview",
  cto: "CTO / CIO",
  engineer: "Engineering Lead",
  board: "Board / Executive",
  investor: "Investor",
  recruiter: "Recruiter",
};

export const AUDIENCE_DESCRIPTIONS: Record<Audience, string> = {
  default:
    "Balanced view of 30 years of work — every role visible, neutral emphasis, no narrative slant.",
  cto: "For the CTO / CIO view, we emphasize transformation leadership, security and incident response, large-spend impact, and enterprise platform modernization.",
  engineer:
    "For the engineering view, we emphasize hands-on architecture, concrete stacks (SharePoint, Microsoft 365, LAMP, Python), and individual-contributor depth.",
  board:
    "For the board view, we emphasize executive scope, cross-functional leadership, governance, financial impact, and strategic outcomes.",
  investor:
    "For the investor view, we emphasize ventures founded and advised, board roles, partnership development, and growth-stage strategic work.",
  recruiter:
    "For the recruiter view, we show everything — full 30-year history with recent roles surfaced first and older roles available for scan.",
};

export interface RoleAudienceTag {
  roleId: string;
  audiences: Audience[];
  emphasis: Record<Audience, "primary" | "secondary" | "hidden">;
  bullets?: Record<Audience, number[]>;
}

// Reason: explicit overrides for the five most narratively important roles.
// Anything not listed here falls through to deriveHeuristicTag() below.
export const ROLE_AUDIENCE_TAGS: RoleAudienceTag[] = [
  {
    // Most recent role, AI adoption program lead — strongest signal across
    // all audiences. CTO and engineer views see it as primary; investor and
    // board see the strategic framing.
    roleId: "MMR - Modern Workplace Consultant__2025-07",
    audiences: ["default", "cto", "engineer", "board", "investor", "recruiter"],
    emphasis: {
      default: "primary",
      cto: "primary",
      engineer: "primary",
      board: "primary",
      investor: "secondary",
      recruiter: "primary",
    },
    bullets: {
      // CTO/board want the transformation/roadmap bullets; engineer wants the
      // hands-on stack bullets; investor wants the cross-functional / KPI angle.
      default: [],
      cto: [0, 1, 2, 3, 4, 5],
      engineer: [0, 1, 3, 4],
      board: [1, 2, 5],
      investor: [2, 5],
      recruiter: [],
    },
  },
  {
    // Incident response / ransomware recovery — flagship security signal.
    // Primary for CTO; engineer sees the technical playbooks; board sees the
    // crisis-management framing; investor de-emphasized.
    roleId: "Cognesense__2025-10",
    audiences: ["default", "cto", "engineer", "board", "recruiter"],
    emphasis: {
      default: "primary",
      cto: "primary",
      engineer: "secondary",
      board: "primary",
      investor: "hidden",
      recruiter: "primary",
    },
  },
  {
    // Longest recent tenure, broad transformation work — the bedrock entry
    // for almost every audience.
    roleId: "DTIG__2021-05",
    audiences: ["default", "cto", "engineer", "board", "investor", "recruiter"],
    emphasis: {
      default: "primary",
      cto: "primary",
      engineer: "secondary",
      board: "primary",
      investor: "secondary",
      recruiter: "primary",
    },
  },
  {
    // Senior SharePoint Architect — flagship hands-on engineering role, and
    // includes the $1.2M IT-spend-reduction bullet that resonates with CTO
    // and board.
    roleId: "Kaufman Hall__2015-06",
    audiences: ["default", "cto", "engineer", "board", "recruiter"],
    emphasis: {
      default: "primary",
      cto: "primary",
      engineer: "primary",
      board: "secondary",
      investor: "hidden",
      recruiter: "primary",
    },
    bullets: {
      default: [],
      // CTO sees the $1.2M and governance bullets up front; engineer sees the
      // custom dev and automation work.
      cto: [3, 5, 6],
      engineer: [0, 2, 3, 4],
      board: [5, 6],
      investor: [],
      recruiter: [],
    },
  },
  {
    // Board of Advisors role at Groove Science — primary signal for investor
    // and board views; engineer/CTO views de-emphasized.
    roleId: "Groove Science Studios, Inc.__2014-06",
    audiences: ["default", "board", "investor", "recruiter"],
    emphasis: {
      default: "secondary",
      cto: "hidden",
      engineer: "hidden",
      board: "primary",
      investor: "primary",
      recruiter: "secondary",
    },
  },
];

// Reason: a couple of explicit project overrides; the rest fall back to
// heuristic. Projects are short-form, so curating fewer is fine.
export const PROJECT_AUDIENCE_TAGS: RoleAudienceTag[] = [
  {
    // Incident response project — same emphasis profile as Cognesense role.
    roleId: "CONFIDENTIAL | Cybersecurity & Disaster Recovery Lead__2025-10",
    audiences: ["default", "cto", "engineer", "board", "recruiter"],
    emphasis: {
      default: "primary",
      cto: "primary",
      engineer: "secondary",
      board: "primary",
      investor: "hidden",
      recruiter: "primary",
    },
  },
  {
    // AI Adoption / MMR project — pairs with the MMR role.
    roleId: "MMR AI Adoption Program Lead (Software Engineering Transformation)__2025-07",
    audiences: ["default", "cto", "engineer", "board", "investor", "recruiter"],
    emphasis: {
      default: "primary",
      cto: "primary",
      engineer: "primary",
      board: "primary",
      investor: "secondary",
      recruiter: "primary",
    },
  },
  {
    // HIMSS information-architecture deployment — strong board/CTO outcome
    // story (28% knowledge-worker capacity gain).
    roleId: "Plan and Deploy New Information Architecture for HIMSS__2020-12",
    audiences: ["default", "cto", "engineer", "board", "recruiter"],
    emphasis: {
      default: "primary",
      cto: "primary",
      engineer: "secondary",
      board: "primary",
      investor: "hidden",
      recruiter: "secondary",
    },
  },
];

// ---------------------------------------------------------------------------
// Heuristic fallback
// ---------------------------------------------------------------------------

/**
 * Keyword sets that drive the heuristic emphasis decision. These are
 * intentionally small and explicit — the goal is "reasonable default", not
 * "perfect classifier". Curators add an explicit ROLE_AUDIENCE_TAGS entry
 * whenever the heuristic gets it wrong.
 */
const LEADERSHIP_TERMS = [
  "director",
  "lead",
  "architect",
  "head",
  "chief",
  "vp",
  "vice president",
  "principal",
  "advisor",
  "board",
  "founder",
  "owner",
  "manager",
];

const ENGINEERING_TERMS = [
  "engineer",
  "developer",
  "architect",
  "administrator",
  "dba",
  "devops",
  "sre",
  "software",
  "data center",
  "web",
];

const ENTREPRENEURIAL_TERMS = ["founder", "co-founder", "advisor", "board", "owner"];

function lc(s: string | undefined | null): string {
  return (s ?? "").toLowerCase();
}

function anyMatch(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

/**
 * Compute a heuristic RoleAudienceTag for a role/project that isn't in the
 * explicit override arrays. Decisions are based on the position/title string
 * plus an optional start-year for recency.
 *
 * Decisions:
 *   - Recent (within the last 10 years) → recruiter "primary", else "secondary".
 *   - Leadership terms → board "primary", cto "primary" (else "secondary").
 *   - Engineering terms → engineer "primary" (else "secondary").
 *   - Entrepreneurial terms → investor "primary"; otherwise investor "hidden"
 *     unless the role is also leadership, in which case "secondary".
 *   - default → always "secondary" (the default view shows everything,
 *     neutrally).
 *
 * This function is exported for testing and for callers that want to score
 * roles dynamically (e.g. a future authoring tool).
 */
export function deriveHeuristicTag(
  roleId: string,
  position: string,
  startDate: string,
  todayYear: number = new Date().getUTCFullYear(),
): RoleAudienceTag {
  const pos = lc(position);
  const startYear = Number.parseInt(startDate.slice(0, 4), 10);
  const isRecent = Number.isFinite(startYear) && todayYear - startYear <= 10;

  const isLeadership = anyMatch(pos, LEADERSHIP_TERMS);
  const isEngineering = anyMatch(pos, ENGINEERING_TERMS);
  const isEntrepreneurial = anyMatch(pos, ENTREPRENEURIAL_TERMS);

  const ctoEmphasis: "primary" | "secondary" | "hidden" = isLeadership
    ? "primary"
    : isEngineering
      ? "secondary"
      : "secondary";

  const engineerEmphasis: "primary" | "secondary" | "hidden" = isEngineering
    ? "primary"
    : isLeadership
      ? "secondary"
      : "secondary";

  const boardEmphasis: "primary" | "secondary" | "hidden" = isLeadership
    ? "primary"
    : isEngineering
      ? "hidden"
      : "secondary";

  const investorEmphasis: "primary" | "secondary" | "hidden" = isEntrepreneurial
    ? "primary"
    : isLeadership
      ? "secondary"
      : "hidden";

  const recruiterEmphasis: "primary" | "secondary" | "hidden" = isRecent
    ? "primary"
    : "secondary";

  // Reason: the audiences[] array lists which views this role appears in.
  // We add an audience only when its emphasis is not "hidden". Some of the
  // emphasis variables above are narrowed by TS to never be "hidden" given
  // the ternary branches, so we cast to the wide union for a uniform check.
  type Emphasis = "primary" | "secondary" | "hidden";
  const emphasisMap: Record<Exclude<Audience, "default" | "recruiter">, Emphasis> = {
    cto: ctoEmphasis as Emphasis,
    engineer: engineerEmphasis as Emphasis,
    board: boardEmphasis as Emphasis,
    investor: investorEmphasis as Emphasis,
  };
  const audiences: Audience[] = ["default", "recruiter"];
  for (const a of ["cto", "engineer", "board", "investor"] as const) {
    if (emphasisMap[a] !== "hidden") audiences.push(a);
  }

  return {
    roleId,
    audiences,
    emphasis: {
      default: "secondary",
      cto: ctoEmphasis,
      engineer: engineerEmphasis,
      board: boardEmphasis,
      investor: investorEmphasis,
      recruiter: recruiterEmphasis,
    },
  };
}

// ---------------------------------------------------------------------------
// Resume-data-driven heuristic registry
// ---------------------------------------------------------------------------

// Reason: import the snapshot to derive heuristic tags for any role/project
// the curator hasn't explicitly tagged. This is read-only — we never mutate.
import resumeData from "./resume.json" with { type: "json" };

interface ResumeWorkEntry {
  name: string;
  position: string;
  startDate: string;
}

interface ResumeProjectEntry {
  name: string;
  description?: string;
  startDate: string;
}

interface ResumeShape {
  work: ResumeWorkEntry[];
  projects: ResumeProjectEntry[];
}

const RESUME = resumeData as unknown as ResumeShape;

/**
 * Lookup table keyed by roleId. Explicit entries override heuristics; if a
 * role is missing entirely, we fall back to deriveHeuristicTag at lookup time.
 */
const explicitRoleMap: Map<string, RoleAudienceTag> = new Map(
  ROLE_AUDIENCE_TAGS.map((t) => [t.roleId, t]),
);

const explicitProjectMap: Map<string, RoleAudienceTag> = new Map(
  PROJECT_AUDIENCE_TAGS.map((t) => [t.roleId, t]),
);

/**
 * Returns the explicit ROLE_AUDIENCE_TAGS / PROJECT_AUDIENCE_TAGS entry for
 * the given role ID if one exists, otherwise computes a heuristic tag from
 * the resume.json work/projects entry that matches. Returns undefined only
 * if the roleId doesn't correspond to any known role or project.
 */
export function getRoleTag(roleId: string): RoleAudienceTag | undefined {
  const explicitRole = explicitRoleMap.get(roleId);
  if (explicitRole) return explicitRole;

  const explicitProject = explicitProjectMap.get(roleId);
  if (explicitProject) return explicitProject;

  // Try the work[] array first.
  for (const w of RESUME.work) {
    const id = `${w.name}__${w.startDate}`;
    if (id === roleId) {
      return deriveHeuristicTag(roleId, w.position, w.startDate);
    }
  }

  // Then projects[]. Projects don't have a "position" field, so we use the
  // name as a proxy for the title-string keyword match.
  for (const p of RESUME.projects) {
    const id = `${p.name}__${p.startDate}`;
    if (id === roleId) {
      return deriveHeuristicTag(roleId, p.name, p.startDate);
    }
  }

  return undefined;
}

export function visibleForAudience(roleId: string, audience: Audience): boolean {
  const tag = getRoleTag(roleId);
  if (!tag) return false;
  return tag.emphasis[audience] !== "hidden";
}

export function emphasisFor(
  roleId: string,
  audience: Audience,
): "primary" | "secondary" | "hidden" {
  const tag = getRoleTag(roleId);
  if (!tag) return "hidden";
  return tag.emphasis[audience];
}
