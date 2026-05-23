/**
 * Adaptive CV render engine.
 *
 * Pure-TS, no DOM, no Astro. Given (resume, audience, activeSkillFilters)
 * it returns a deterministic RenderPlan: which sections are visible, in
 * which order, with which highlights, with which roles dimmed.
 *
 * The page (src/pages/cv/index.astro) consumes this plan and emits HTML
 * via the existing glass design primitives. The engine itself never
 * touches markup so it stays trivially unit-testable.
 *
 * Dependencies on agent A's data layer:
 *   - Audience union and visibleForAudience / emphasisFor helpers come
 *     from src/data/cvAudienceTags.ts. We import the type and the helpers
 *     dynamically so a missing module produces a clear runtime error
 *     during the build rather than a confusing type error.
 *   - resume.json shape is intentionally loose (`any`) at this boundary
 *     because the schema lives in the data file, not in the renderer.
 */

import type { Audience } from "../data/cvAudienceTags";
// Reason: helpers come from the same module as the type; if they ever
// move, this is the only place to update.
import {
  AUDIENCES,
  visibleForAudience,
  emphasisFor,
  getRoleTag,
} from "../data/cvAudienceTags";
import { getSkillsForRole } from "../data/cvSkillIndex";

/**
 * Stable role ID format used by cvAudienceTags: `${name}__${startDate}`.
 * resume.json entries don't carry an explicit roleId, so we derive it
 * here from the (name, startDate) pair. Keep in sync with
 * cvAudienceTags.ts if that format ever changes.
 */
function computeRoleId(raw: any): string {
  const name = String(raw?.name ?? raw?.company ?? "").trim();
  const start = String(raw?.startDate ?? "").trim();
  return `${name}__${start}`;
}

/**
 * Look up the per-audience bullet index list for a role. Returns null
 * when no override is configured (caller renders all highlights).
 */
function audienceBulletIndices(roleId: string, audience: Audience): number[] | null {
  const tag = getRoleTag(roleId);
  const bullets = tag?.bullets?.[audience];
  // An empty array means "no override, show everything" by convention in
  // cvAudienceTags (default rows are explicitly []). Treat both null and
  // empty as "no filter".
  if (!bullets || bullets.length === 0) return null;
  return bullets;
}

/* ────────────────────────────────────────────────────────────────────
 * Public types
 * ──────────────────────────────────────────────────────────────────── */

export interface RenderPlan {
  audience: Audience;
  sections: Section[];
  activeSkillFilters: string[];
}

export type SectionKind =
  | "summary"
  | "experience"
  | "projects"
  | "skills"
  | "education"
  | "certifications"
  | "publications"
  | "awards"
  | "volunteer";

export type Section =
  | { kind: "summary"; visible: boolean; emphasis: "primary" | "secondary"; content: string }
  | { kind: "experience"; visible: boolean; roles: RenderedRole[] }
  | { kind: "projects"; visible: boolean; projects: RenderedProject[] }
  | { kind: "skills"; visible: boolean; skills: RenderedSkillGroup[] }
  | { kind: "education"; visible: boolean; items: any[] }
  | { kind: "certifications"; visible: boolean; items: any[] }
  | { kind: "publications"; visible: boolean; items: any[] }
  | { kind: "awards"; visible: boolean; items: any[] }
  | { kind: "volunteer"; visible: boolean; items: any[] };

/**
 * Per-audience emphasis matrix. The client uses this baked-in data to
 * recompute visibility / dimming locally when the user switches audience
 * via the AudienceSwitcher, without re-fetching from the server.
 * Reason: phase-2 client-side adaptation pattern — every audience's
 * styling decisions ship with the role, page never reloads.
 */
export type AudienceMatrix = Record<Audience, "primary" | "secondary" | "hidden">;

export interface RenderedRole {
  roleId: string;
  name: string;            // company / employer
  position: string;
  location?: string;
  startDate: string;
  endDate?: string;
  summary: string;
  highlights: string[];    // filtered by audience bullets[] if provided
  emphasis: "primary" | "secondary" | "hidden";
  skillsMatched: string[];
  matchesAllActiveSkills: boolean;
  /** Per-audience emphasis for client-side adaptation. */
  audienceMatrix: AudienceMatrix;
  /** Audiences where this role is primary or secondary (for data-cv-audiences). */
  audiencesData: string[];
  /** Audiences where this role's emphasis is "hidden" (for data-cv-hidden-for). */
  hiddenForAudiences: string[];
  /** Slugified skill tokens for client-side skill matching. */
  skillsData: string[];
  /** End year (or current-year sentinel) used by the time-axis filter. */
  yearEnd: number;
}

export interface RenderedProject {
  roleId: string;
  name: string;
  location?: string;
  startDate: string;
  endDate?: string;
  summary: string;
  highlights: string[];
  emphasis: "primary" | "secondary" | "hidden";
  skillsMatched: string[];
  matchesAllActiveSkills: boolean;
  audienceMatrix: AudienceMatrix;
  audiencesData: string[];
  hiddenForAudiences: string[];
  skillsData: string[];
  yearEnd: number;
}

export interface RenderedSkillGroup {
  category: string;
  skills: { name: string; active: boolean }[];
}

/* ────────────────────────────────────────────────────────────────────
 * Section visibility matrix.
 *
 * Per-audience defaults for which "soft" sections render. Summary,
 * Experience, Projects, Education, Skills, Certifications are always
 * visible per the spec. Awards/Publications/Volunteer vary.
 * ──────────────────────────────────────────────────────────────────── */

const ALWAYS_VISIBLE: SectionKind[] = [
  "summary",
  "experience",
  "projects",
  "skills",
  "education",
  "certifications",
];

const AUDIENCE_SECTION_VISIBILITY: Record<
  Audience,
  Partial<Record<SectionKind, boolean>>
> = {
  default:   { awards: true,  publications: true,  volunteer: true },
  recruiter: { awards: true,  publications: true,  volunteer: true },
  cto:       { awards: false, publications: true,  volunteer: false },
  engineer:  { awards: false, publications: true,  volunteer: false },
  board:     { awards: true,  publications: true,  volunteer: true },
  investor:  { awards: true,  publications: true,  volunteer: true },
} as unknown as Record<Audience, Partial<Record<SectionKind, boolean>>>;

/**
 * Returns true if the named section should render for this audience.
 * Always-visible sections short-circuit; everything else falls through
 * the matrix above with a "default audience" fallback.
 */
function sectionVisible(kind: SectionKind, audience: Audience): boolean {
  if (ALWAYS_VISIBLE.includes(kind)) return true;
  const row = AUDIENCE_SECTION_VISIBILITY[audience] ?? AUDIENCE_SECTION_VISIBILITY.default;
  return row?.[kind] ?? false;
}

/* ────────────────────────────────────────────────────────────────────
 * Skill matching utilities
 * ──────────────────────────────────────────────────────────────────── */

/**
 * Substring, case-insensitive match. We deliberately keep this loose
 * because resume.json's bullet copy uses natural language: "Microsoft
 * 365" should match "deployed Microsoft 365 across...".
 */
function textContainsSkill(haystack: string, skill: string): boolean {
  if (!haystack || !skill) return false;
  return haystack.toLowerCase().includes(skill.toLowerCase());
}

/**
 * Scans the role's searchable surface (name, position, summary,
 * highlights) for every active skill filter. Returns the matched
 * subset plus a convenience boolean for "matches every filter".
 */
function computeSkillMatch(
  searchable: string,
  activeSkillFilters: string[],
): { skillsMatched: string[]; matchesAllActiveSkills: boolean } {
  if (activeSkillFilters.length === 0) {
    return { skillsMatched: [], matchesAllActiveSkills: true };
  }
  const matched: string[] = [];
  for (const skill of activeSkillFilters) {
    if (textContainsSkill(searchable, skill)) matched.push(skill);
  }
  return {
    skillsMatched: matched,
    matchesAllActiveSkills: matched.length === activeSkillFilters.length,
  };
}

/* ────────────────────────────────────────────────────────────────────
 * Date utilities
 *
 * resume.json dates are ISO strings (`YYYY-MM` or `YYYY-MM-DD`) or
 * absent (current). We sort by parsed Date; absent endDate sorts as
 * "now" so current roles bubble to the top within their emphasis tier.
 * ──────────────────────────────────────────────────────────────────── */

function endDateValue(endDate?: string): number {
  if (!endDate) return Number.MAX_SAFE_INTEGER;
  const parsed = Date.parse(endDate);
  return Number.isNaN(parsed) ? 0 : parsed;
}

const EMPHASIS_RANK: Record<RenderedRole["emphasis"], number> = {
  primary: 0,
  secondary: 1,
  hidden: 2,
};

/* ────────────────────────────────────────────────────────────────────
 * Slugification + per-audience matrix utilities
 *
 * The client uses slug tokens (lowercase, hyphenated) as the canonical
 * skill identifier in data-cv-skills attributes and ?skill= URL params.
 * Mirrors the convention used in the Claire's reference pattern.
 * ──────────────────────────────────────────────────────────────────── */

/**
 * Normalize a free-form skill or label string into a URL/CSS-safe slug:
 * "Microsoft 365" → "microsoft-365", "Identity & Access Mgmt" → "identity-access-mgmt".
 * Empty input returns "".
 */
export function slugifySkill(input: string): string {
  return String(input ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")    // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")        // collapse non-alnum to single dash
    .replace(/^-+|-+$/g, "");           // trim leading/trailing dashes
}

/**
 * Build the full per-audience emphasis map for a given role/project.
 * Walks every Audience and asks the tag layer, falling back to "hidden"
 * if the role has no tag at all. Reason: client needs the complete
 * matrix so audience switching doesn't have to phone home.
 */
function buildAudienceMatrix(roleId: string): AudienceMatrix {
  const matrix = {} as AudienceMatrix;
  for (const a of AUDIENCES) {
    matrix[a] = emphasisFor(roleId, a);
  }
  return matrix;
}

/* ────────────────────────────────────────────────────────────────────
 * Role / project rendering
 * ──────────────────────────────────────────────────────────────────── */

/**
 * Render a single experience entry. Hidden roles are NOT dropped: they
 * come back with emphasis "hidden" so the page can render them under
 * a collapsed "Show more" block.
 */
function renderRole(
  raw: any,
  audience: Audience,
  activeSkillFilters: string[],
): RenderedRole {
  const roleId: string = computeRoleId(raw);
  const allHighlights: string[] = Array.isArray(raw?.highlights) ? raw.highlights : [];

  // Bullets filter: if the audience tag config supplies an explicit index
  // list for this role, render only those highlights. Otherwise render all.
  const indices = audienceBulletIndices(roleId, audience);
  const highlights = indices
    ? indices
        .filter((i) => i >= 0 && i < allHighlights.length)
        .map((i) => allHighlights[i])
    : allHighlights;

  const visible = visibleForAudience(roleId, audience);
  const rawEmphasis = emphasisFor(roleId, audience);
  const emphasis: RenderedRole["emphasis"] = visible ? rawEmphasis : "hidden";

  // Skill search surface: pull every text field that could legitimately
  // mention a tooling/skill keyword. summary + position + name catch
  // role-level context; highlights catch line-item proof.
  const searchable = [
    raw?.name,
    raw?.position,
    raw?.summary,
    ...allHighlights,
  ]
    .filter(Boolean)
    .join(" \n ");

  const { skillsMatched, matchesAllActiveSkills } = computeSkillMatch(
    searchable,
    activeSkillFilters,
  );

  // Build the full per-audience matrix so the client can re-style on
  // audience switch without re-running the engine.
  const audienceMatrix = buildAudienceMatrix(roleId);

  // audiencesData = list of audiences where this role is primary or
  // secondary (i.e. NOT hidden). Used by data-cv-audiences on the card.
  // hiddenForAudiences = inverse, used by data-cv-hidden-for so CSS can
  // hide the card under those audiences.
  const audiencesData: string[] = [];
  const hiddenForAudiences: string[] = [];
  for (const a of AUDIENCES) {
    if (audienceMatrix[a] === "hidden") hiddenForAudiences.push(a);
    else audiencesData.push(a);
  }

  // skillsData: slugified skill tokens indexed for this role via the
  // cvSkillIndex. Used by client-side filtering — a role is "matched"
  // if its skillsData intersects the active filter set.
  const indexedSkills = getSkillsForRole(roleId);
  const skillsData = indexedSkills.map(slugifySkill).filter(Boolean);

  // yearEnd: integer year of role end, or current-year sentinel for
  // open-ended roles. Drives the time-axis slider client-side.
  const yearEndRaw = raw?.endDate ? String(raw.endDate).slice(0, 4) : "";
  const parsedYearEnd = parseInt(yearEndRaw, 10);
  const yearEnd = Number.isFinite(parsedYearEnd)
    ? parsedYearEnd
    : new Date().getFullYear();

  return {
    roleId,
    name: String(raw?.name ?? ""),
    position: String(raw?.position ?? ""),
    location: raw?.location ?? undefined,
    startDate: String(raw?.startDate ?? ""),
    endDate: raw?.endDate ?? undefined,
    summary: String(raw?.summary ?? ""),
    highlights,
    emphasis,
    skillsMatched,
    matchesAllActiveSkills,
    audienceMatrix,
    audiencesData,
    hiddenForAudiences,
    skillsData,
    yearEnd,
  };
}

/**
 * Project entries have the same shape as roles minus `position`. We
 * still flow them through the same emphasis / skill-match pipeline.
 */
function renderProject(
  raw: any,
  audience: Audience,
  activeSkillFilters: string[],
): RenderedProject {
  const role = renderRole(raw, audience, activeSkillFilters);
  // Strip `position` since projects don't carry one. Keep everything else.
  const { position, ...rest } = role;
  return rest;
}

/**
 * Sort: emphasis tier (primary, secondary, hidden) then endDate desc.
 * Stable within tier so equal-date entries hold input order.
 */
function sortByEmphasisThenRecency<T extends { emphasis: RenderedRole["emphasis"]; endDate?: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const rankDiff = EMPHASIS_RANK[a.emphasis] - EMPHASIS_RANK[b.emphasis];
    if (rankDiff !== 0) return rankDiff;
    return endDateValue(b.endDate) - endDateValue(a.endDate);
  });
}

/* ────────────────────────────────────────────────────────────────────
 * Skills section
 *
 * resume.json's skills[] structure: each entry has { category, keywords }
 * where keywords is either an array or a comma-joined string. We
 * normalize to an array and mark every keyword that's an active filter.
 * ──────────────────────────────────────────────────────────────────── */

function renderSkills(
  rawSkills: any[],
  activeSkillFilters: string[],
): RenderedSkillGroup[] {
  if (!Array.isArray(rawSkills)) return [];
  const activeLower = activeSkillFilters.map((s) => s.toLowerCase());
  return rawSkills.map((group) => {
    const category = String(group?.category ?? group?.name ?? "");
    const rawKeywords = group?.keywords ?? group?.skills ?? [];
    const names: string[] = Array.isArray(rawKeywords)
      ? rawKeywords.map((k) => String(k).trim()).filter(Boolean)
      : String(rawKeywords)
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean);
    return {
      category,
      skills: names.map((name) => ({
        name,
        active: activeLower.includes(name.toLowerCase()),
      })),
    };
  });
}

/* ────────────────────────────────────────────────────────────────────
 * Options for buildRenderPlan
 *
 * sinceYear:        when set, every Experience role whose effective end
 *                   year is earlier than `sinceYear` is collapsed into a
 *                   single virtual "Earlier Experience" role with
 *                   emphasis="hidden". This mirrors the years_back
 *                   collapse logic from JobApplyFramework.
 * hiddenSections:   list of SectionKind values to force-hide regardless
 *                   of audience visibility defaults. Used by the
 *                   SectionFilterDrawer surface on the /cv page.
 * ──────────────────────────────────────────────────────────────────── */

export interface BuildRenderPlanOptions {
  sinceYear?: number | null;
  hiddenSections?: string[];
}

/**
 * Stable role ID for the synthetic "Earlier Experience" virtual entry.
 * Kept distinct from any computeRoleId() output so consumers can
 * special-case it (e.g. render a different RoleCard variant).
 */
export const EARLIER_EXPERIENCE_ROLE_ID = "__earlier_experience__";

/**
 * Pull the effective end year from a rendered role. Open-ended roles
 * (endDate falsy) are treated as "current" — they always satisfy any
 * sinceYear filter. Parse failures fall through as 0 so genuinely bad
 * data is collapsed defensively rather than crashing.
 */
function roleEffectiveEndYear(role: RenderedRole | RenderedProject): number {
  if (!role.endDate) {
    // Current role — never collapse.
    return Number.MAX_SAFE_INTEGER;
  }
  // `YYYY-MM` or `YYYY-MM-DD` — take the leading 4 chars.
  const yr = parseInt(String(role.endDate).slice(0, 4), 10);
  return Number.isNaN(yr) ? 0 : yr;
}

/**
 * Collapse roles whose effective end year is earlier than sinceYear
 * into a single synthetic "Earlier Experience" entry that sits at the
 * tail of the experience list with emphasis="hidden". The synthetic
 * entry's highlights array is a bullet-list of the collapsed role
 * names in `Position at Company (YYYY-YYYY)` form so the page can
 * render it as a compact summary.
 *
 * Reason: this matches the years_back collapse used in the
 * JobApplyFramework Phase 1 prompt — older detail is summarized rather
 * than dropped, preserving truthfulness while shortening the visible
 * surface.
 */
function applySinceYearCollapse(
  roles: RenderedRole[],
  sinceYear: number,
): RenderedRole[] {
  const kept: RenderedRole[] = [];
  const collapsed: RenderedRole[] = [];
  for (const r of roles) {
    if (roleEffectiveEndYear(r) < sinceYear) {
      collapsed.push(r);
    } else {
      kept.push(r);
    }
  }
  if (collapsed.length === 0) return roles;

  // Build a short, truthful bullet per collapsed role. Format:
  //   "Position at Company (YYYY-YYYY)" or "(YYYY)" if start/end same year.
  const bullets = collapsed.map((r) => {
    const startYr = r.startDate ? r.startDate.slice(0, 4) : "";
    const endYr = r.endDate ? r.endDate.slice(0, 4) : "";
    let span = "";
    if (startYr && endYr) {
      span = startYr === endYr ? `(${startYr})` : `(${startYr}-${endYr})`;
    } else if (startYr) {
      span = `(${startYr})`;
    }
    const who = r.position ? `${r.position} at ${r.name}` : r.name;
    return `${who} ${span}`.trim();
  });

  // Find the earliest start and latest end across collapsed entries so
  // the virtual entry has a meaningful date range.
  const startYears = collapsed
    .map((r) => parseInt(r.startDate.slice(0, 4), 10))
    .filter((y) => !Number.isNaN(y));
  const endYears = collapsed
    .map((r) => (r.endDate ? parseInt(r.endDate.slice(0, 4), 10) : NaN))
    .filter((y) => !Number.isNaN(y));
  const earliestStart = startYears.length > 0 ? String(Math.min(...startYears)) : "";
  const latestEnd = endYears.length > 0 ? String(Math.max(...endYears)) : "";

  // Synthetic virtual entry: emphasis "hidden" across every audience so
  // the page never surfaces it unless the user expands the collapsed
  // block. Carries empty client-side adaptation data so the JS state
  // applier treats it as a no-match neutral.
  const hiddenMatrix: AudienceMatrix = {
    default: "hidden",
    cto: "hidden",
    engineer: "hidden",
    board: "hidden",
    investor: "hidden",
    recruiter: "hidden",
  };
  const latestEndYear = parseInt(latestEnd, 10);
  const earlier: RenderedRole = {
    roleId: EARLIER_EXPERIENCE_ROLE_ID,
    name: "Earlier Experience",
    position: `${collapsed.length} earlier role${collapsed.length === 1 ? "" : "s"}`,
    startDate: earliestStart,
    endDate: latestEnd,
    summary: `Roles prior to ${sinceYear}, summarized.`,
    highlights: bullets,
    emphasis: "hidden",
    skillsMatched: [],
    matchesAllActiveSkills: true,
    audienceMatrix: hiddenMatrix,
    audiencesData: [],
    hiddenForAudiences: [...AUDIENCES],
    skillsData: [],
    yearEnd: Number.isFinite(latestEndYear) ? latestEndYear : 0,
  };

  return [...kept, earlier];
}

/* ────────────────────────────────────────────────────────────────────
 * Public entry point
 * ──────────────────────────────────────────────────────────────────── */

export function buildRenderPlan(
  resume: any,
  audience: Audience,
  activeSkillFilters: string[],
  options?: BuildRenderPlanOptions,
): RenderPlan {
  const safeFilters = Array.isArray(activeSkillFilters)
    ? activeSkillFilters.filter((s): s is string => typeof s === "string" && s.length > 0)
    : [];

  // Normalize options. Both are optional so the existing call sites
  // (no options arg) keep working unchanged.
  const sinceYear: number | null =
    options?.sinceYear != null && Number.isFinite(options.sinceYear)
      ? Math.trunc(options.sinceYear as number)
      : null;
  const hiddenSectionsSet = new Set<string>(
    Array.isArray(options?.hiddenSections) ? options!.hiddenSections : [],
  );

  // ── Summary ────────────────────────────────────────────────────────
  // resume.json may carry per-audience summary strings under
  // basics.summaries[audience]; otherwise fall back to basics.summary.
  const summaryContent: string =
    resume?.basics?.summaries?.[audience] ??
    resume?.summaries?.[audience] ??
    resume?.basics?.summary ??
    resume?.summary ??
    "";

  // Emphasis: board/investor/cto get "primary" weight on summary
  // (it's the most-read paragraph for executive audiences); recruiter
  // and engineer treat it as secondary scaffolding.
  const summaryEmphasis: "primary" | "secondary" =
    audience === "board" || audience === "investor" || audience === "cto"
      ? "primary"
      : "secondary";

  // ── Experience ─────────────────────────────────────────────────────
  const rawWork: any[] = Array.isArray(resume?.work) ? resume.work : [];
  let renderedRoles = sortByEmphasisThenRecency(
    rawWork.map((r) => renderRole(r, audience, safeFilters)),
  );
  // sinceYear filter: collapse roles whose effective end year is
  // earlier than the threshold into a single virtual "Earlier
  // Experience" entry. Applied AFTER audience/emphasis sorting so
  // the virtual entry lands at the tail (hidden tier) automatically.
  if (sinceYear != null) {
    renderedRoles = applySinceYearCollapse(renderedRoles, sinceYear);
    // Re-sort: the virtual entry has emphasis="hidden" so this keeps
    // ordering invariants intact and lets the page treat it via the
    // existing hidden-tier branch.
    renderedRoles = sortByEmphasisThenRecency(renderedRoles);
  }

  // ── Projects ───────────────────────────────────────────────────────
  const rawProjects: any[] = Array.isArray(resume?.projects) ? resume.projects : [];
  const renderedProjects = sortByEmphasisThenRecency(
    rawProjects.map((p) => renderProject(p, audience, safeFilters)),
  );

  // ── Skills ─────────────────────────────────────────────────────────
  const skillGroups = renderSkills(resume?.skills ?? [], safeFilters);

  // ── Pass-through sections (Education, Certifications, etc.) ────────
  const education: any[] = Array.isArray(resume?.education) ? resume.education : [];
  const certifications: any[] = Array.isArray(resume?.certifications)
    ? resume.certifications
    : Array.isArray(resume?.certificates) // schema name variance
      ? resume.certificates
      : [];
  const publications: any[] = Array.isArray(resume?.publications) ? resume.publications : [];
  const awards: any[] = Array.isArray(resume?.awards) ? resume.awards : [];
  const volunteer: any[] = Array.isArray(resume?.volunteer) ? resume.volunteer : [];

  // hiddenSections: explicit user opt-out from the SectionFilterDrawer.
  // When a section kind is in this set we force visible:false regardless
  // of audience defaults. Reason: drawer is a per-visitor manual override
  // and should beat the audience matrix.
  function vis(kind: SectionKind): boolean {
    if (hiddenSectionsSet.has(kind)) return false;
    return sectionVisible(kind, audience);
  }

  const sections: Section[] = [
    {
      kind: "summary",
      visible: vis("summary"),
      emphasis: summaryEmphasis,
      content: summaryContent,
    },
    {
      kind: "experience",
      visible: vis("experience"),
      roles: renderedRoles,
    },
    {
      kind: "projects",
      visible: vis("projects"),
      projects: renderedProjects,
    },
    {
      kind: "skills",
      visible: vis("skills"),
      skills: skillGroups,
    },
    {
      kind: "education",
      visible: vis("education"),
      items: education,
    },
    {
      kind: "certifications",
      visible: vis("certifications"),
      items: certifications,
    },
    {
      kind: "publications",
      visible: vis("publications"),
      items: publications,
    },
    {
      kind: "awards",
      visible: vis("awards"),
      items: awards,
    },
    {
      kind: "volunteer",
      visible: vis("volunteer"),
      items: volunteer,
    },
  ];

  return {
    audience,
    sections,
    activeSkillFilters: safeFilters,
  };
}
