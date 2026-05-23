/**
 * cv-archive-adapter.ts
 *
 * Pure-TS adapter that converts a `ResumeArchiveEntry` (the prebaked
 * tailored-resume shape produced by scripts/build-archive.mjs) into the
 * same `RenderPlan` shape that `cv-render.ts`#buildRenderPlan emits.
 *
 * Why this adapter exists
 * -----------------------
 * The /cv page renders identical DOM regardless of source. When the audience
 * map (cvAudienceArchiveMap.ts) selects a curated archive entry for the
 * current audience, the page hands the entry's content to this adapter and
 * receives back a RenderPlan that the existing template can iterate without
 * branching on archive-vs-engine. That keeps the client-side state machine
 * (skill chips, time slider, section drawer) working unchanged.
 *
 * Mapping notes
 * -------------
 * - Archive entries do NOT carry per-audience emphasis matrices; every role
 *   is rendered as "primary" so the curated archive's own ordering is the
 *   editorial signal. Skill / time / hide filters still apply via CSS.
 * - Archive entries don't carry stable roleId strings either, so we derive
 *   one from `${company}__${index}` to give the DOM a key. The id is
 *   opaque; nothing else in the system depends on it.
 * - `audiencesData` / `hiddenForAudiences` are filled so the static DOM
 *   shape matches the engine's; the curated entry is treated as visible
 *   to every audience.
 * - Year-end is parsed loose from `dateRange` (e.g. "July 2025 to January
 *   2026" → 2026, "January 2024 to Present" → currentYear). When parsing
 *   fails the role falls back to currentYear so the time slider never
 *   hides curated content unexpectedly.
 */

import type { Audience } from "../data/cvAudienceTags";
import { AUDIENCES } from "../data/cvAudienceTags";
import {
  slugifySkill,
  type AudienceMatrix,
  type RenderPlan,
  type RenderedProject,
  type RenderedRole,
  type RenderedSkillGroup,
  type Section,
} from "./cv-render";
import type {
  ParsedProject,
  ParsedRole,
  ResumeArchiveEntry,
} from "./cv-archive-match";

/**
 * Best-effort end-year parser. Archive dateRanges are human strings
 * like "July 2025 to January 2026" or "January 2024 to Present" - we
 * extract the trailing 4-digit year or return the current year for
 * "Present"/unparseable input.
 */
function parseEndYear(dateRange: string | undefined): number {
  const currentYear = new Date().getFullYear();
  if (!dateRange) return currentYear;
  const trimmed = dateRange.trim();
  if (/present|current/i.test(trimmed)) return currentYear;
  const years = trimmed.match(/(19|20)\d{2}/g);
  if (!years || years.length === 0) return currentYear;
  const last = parseInt(years[years.length - 1], 10);
  return Number.isFinite(last) ? last : currentYear;
}

/** Same parser, leading-year for startDate display. */
function parseStartYear(dateRange: string | undefined): string {
  if (!dateRange) return "";
  const years = dateRange.match(/(19|20)\d{2}/g);
  return years && years[0] ? years[0] : "";
}

/**
 * Visible-to-every-audience matrix. Curated archive picks are editorial
 * choices, so the entire entry is shown for every audience (CSS skill /
 * time / hide filters still apply downstream).
 */
const ALL_PRIMARY_MATRIX: AudienceMatrix = (() => {
  const m = {} as AudienceMatrix;
  for (const a of AUDIENCES) m[a] = "primary";
  return m;
})();

/**
 * Build the searchable surface string from a parsed role for skill
 * matching. Mirrors cv-render's heuristic: company + position + bullets.
 */
function searchableSurface(role: ParsedRole | ParsedProject): string {
  const fields =
    "company" in role
      ? [role.company, role.position, ...(role.bullets ?? [])]
      : [role.name, ...(role.bullets ?? [])];
  return fields.filter(Boolean).join(" \n ");
}

function computeSkillMatch(
  searchable: string,
  activeSkillFilters: string[],
): { skillsMatched: string[]; matchesAllActiveSkills: boolean } {
  if (activeSkillFilters.length === 0) {
    return { skillsMatched: [], matchesAllActiveSkills: true };
  }
  const lower = searchable.toLowerCase();
  const matched = activeSkillFilters.filter((s) =>
    lower.includes(s.toLowerCase()),
  );
  return {
    skillsMatched: matched,
    matchesAllActiveSkills: matched.length === activeSkillFilters.length,
  };
}

function roleToRendered(
  parsed: ParsedRole,
  idx: number,
  activeSkillFilters: string[],
): RenderedRole {
  const roleId = `archive::${parsed.company}__${idx}`;
  const searchable = searchableSurface(parsed);
  const { skillsMatched, matchesAllActiveSkills } = computeSkillMatch(
    searchable,
    activeSkillFilters,
  );
  const yearEnd = parseEndYear(parsed.dateRange);
  const startYear = parseStartYear(parsed.dateRange);
  const skillsData = (parsed.bullets ?? [])
    .flatMap((b) => b.split(/[,;]\s*|\s+/))
    .map(slugifySkill)
    .filter(Boolean);
  return {
    roleId,
    name: parsed.company || "",
    position: parsed.position || "",
    startDate: startYear,
    endDate: undefined,
    summary: "",
    highlights: parsed.bullets ?? [],
    emphasis: "primary",
    skillsMatched,
    matchesAllActiveSkills,
    audienceMatrix: ALL_PRIMARY_MATRIX,
    audiencesData: [...AUDIENCES],
    hiddenForAudiences: [],
    skillsData,
    yearEnd,
  };
}

function projectToRendered(
  parsed: ParsedProject,
  idx: number,
  activeSkillFilters: string[],
): RenderedProject {
  const roleId = `archive-project::${parsed.name}__${idx}`;
  const searchable = searchableSurface(parsed);
  const { skillsMatched, matchesAllActiveSkills } = computeSkillMatch(
    searchable,
    activeSkillFilters,
  );
  const yearEnd = parseEndYear(parsed.dateRange);
  const startYear = parseStartYear(parsed.dateRange);
  const skillsData = (parsed.bullets ?? [])
    .flatMap((b) => b.split(/[,;]\s*|\s+/))
    .map(slugifySkill)
    .filter(Boolean);
  return {
    roleId,
    name: parsed.name || "",
    startDate: startYear,
    endDate: undefined,
    summary: "",
    highlights: parsed.bullets ?? [],
    emphasis: "primary",
    skillsMatched,
    matchesAllActiveSkills,
    audienceMatrix: ALL_PRIMARY_MATRIX,
    audiencesData: [...AUDIENCES],
    hiddenForAudiences: [],
    skillsData,
    yearEnd,
  };
}

/**
 * Parse the archive's skills string ("Cat: a, b, c; Cat2: d, e") into
 * the engine's RenderedSkillGroup shape so the Skills section can render
 * identically whether sourced from resume.json or an archive entry.
 *
 * Archive `skills` is a single string blob produced by the scanner; we
 * split on semicolons first (between categories) then colons to separate
 * category name from comma-list values.
 */
function parseArchiveSkills(
  skills: string,
  activeSkillFilters: string[],
): RenderedSkillGroup[] {
  if (!skills || typeof skills !== "string") return [];
  const activeLower = activeSkillFilters.map((s) => s.toLowerCase());
  const groups: RenderedSkillGroup[] = [];
  for (const block of skills.split(/[;\n]+/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    let category: string;
    let valuesRaw: string;
    if (colon > -1) {
      category = trimmed.slice(0, colon).trim();
      valuesRaw = trimmed.slice(colon + 1).trim();
    } else {
      category = "Skills";
      valuesRaw = trimmed;
    }
    const values = valuesRaw
      .split(/,\s*/)
      .map((v) => v.trim())
      .filter(Boolean);
    if (values.length === 0) continue;
    groups.push({
      category,
      skills: values.map((name) => ({
        name,
        active: activeLower.includes(name.toLowerCase()),
      })),
    });
  }
  return groups;
}

/**
 * Convert a list of human strings (archive's `education`, `awards`,
 * etc) into the loose `items` shape that the engine's pass-through
 * sections expect. Each string becomes an item with a `name` field so
 * the page's existing template can lift `item.name` for display.
 */
function stringsToItems(values: string[] | undefined): Array<{ name: string }> {
  if (!Array.isArray(values)) return [];
  return values
    .map((v) => String(v).trim())
    .filter(Boolean)
    .map((name) => ({ name }));
}

/**
 * Top-level adapter. Produces a RenderPlan with the same section ordering
 * as the engine so the page template can iterate uniformly.
 *
 * @param entry     a single ResumeArchiveEntry to render as the page body
 * @param audience  the audience the page is rendering for; used for the
 *                  plan's `audience` field (not for filtering, since the
 *                  archive entry is pre-selected for this audience)
 * @param activeSkillFilters  the live skill filter set; used so curated
 *                            roles get the same skillsMatched annotation
 *                            as engine-rendered roles
 * @param hiddenSections  list of section kinds the visitor wants hidden;
 *                        forces the section's visible:false flag without
 *                        dropping the data
 */
export function adaptArchiveEntryToRenderPlan(
  entry: ResumeArchiveEntry,
  audience: Audience,
  activeSkillFilters: string[],
  hiddenSections: string[] = [],
): RenderPlan {
  const hide = new Set(hiddenSections.map((s) => s.toLowerCase()));
  const vis = (kind: string): boolean => !hide.has(kind);

  const renderedRoles: RenderedRole[] = (entry.experience ?? []).map(
    (role, idx) => roleToRendered(role, idx, activeSkillFilters),
  );
  const renderedProjects: RenderedProject[] = (entry.projects ?? []).map(
    (proj, idx) => projectToRendered(proj, idx, activeSkillFilters),
  );
  const skillGroups = parseArchiveSkills(entry.skills, activeSkillFilters);

  const sections: Section[] = [
    {
      kind: "summary",
      visible: vis("summary"),
      // Archive summaries are pre-tailored, so we lean primary to give them
      // the executive-summary treatment regardless of audience.
      emphasis: "primary",
      content: entry.summary ?? "",
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
      items: stringsToItems(entry.education),
    },
    {
      kind: "certifications",
      visible: vis("certifications"),
      items: stringsToItems(entry.certifications),
    },
    {
      kind: "publications",
      visible: vis("publications"),
      items: stringsToItems(entry.publications),
    },
    {
      kind: "awards",
      visible: vis("awards"),
      items: stringsToItems(entry.awards),
    },
    {
      kind: "volunteer",
      visible: vis("volunteer"),
      items: stringsToItems(entry.volunteer),
    },
  ];

  return {
    audience,
    sections,
    activeSkillFilters,
  };
}
