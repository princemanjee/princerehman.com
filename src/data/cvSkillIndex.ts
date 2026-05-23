/**
 * cvSkillIndex.ts
 *
 * Skill-to-role / skill-to-project index for the Adaptive CV system. The
 * /cv page renders a chip row of "core competencies" and lets the visitor
 * click a chip to filter the work and project lists to entries that
 * reference that skill.
 *
 * Source of truth
 * ---------------
 * Derived from the resume.json snapshot in this directory at module load
 * time. The KNOWN_SKILLS list below is the curated vocabulary — about 40
 * terms drawn from the skill keywords and highlight bullets in the
 * snapshot. Each skill is matched case-insensitively as a substring of
 * the role's name/position/summary/highlights or the project's name/
 * description/highlights/keywords. We do NOT attempt NER or fuzzy
 * matching; the curated list is intentional.
 *
 * Frequency counting
 * ------------------
 * One "mention" per (role or project, skill) pair, plus one extra mention
 * per highlight bullet that contains the skill. That way a role that
 * mentions SharePoint in five bullets contributes 6 mentions (1 for the
 * role + 5 for the bullets), while a role that mentions it once
 * contributes 2. The frequency drives the sort order and the chip-default
 * selection.
 *
 * The SKILL_CHIP_DEFAULTS array is the 8-12 most-frequent skills filtered
 * down to those that read as "core competencies" rather than niche tools
 * (e.g. we prefer "Microsoft 365" and "SharePoint" over "MySQL" if both
 * fit the budget). The operator can refine this list later by hand.
 */

import resumeData from "./resume.json" with { type: "json" };

export interface SkillIndexEntry {
  skill: string;
  roleIds: string[];
  projectIds: string[];
  frequency: number;
}

/**
 * Curated skill vocabulary for the index. About 40 entries spanning the
 * skill categories in resume.json (modern workplace, cloud, web, data,
 * security, AI, leadership). Adding a new skill here is safe — the index
 * regenerates at module load.
 *
 * Reason: explicit list rather than dynamic NER keeps results predictable
 * and reviewable. Curators can tune this list when the resume changes.
 */
export const KNOWN_SKILLS: readonly string[] = [
  // Modern workplace / Microsoft platform
  "Microsoft 365",
  "Office 365",
  "Microsoft Teams",
  "SharePoint",
  "SharePoint Online",
  "Power BI",
  "Power Automate",
  "Power Platform",
  "Microsoft Azure",
  "Azure",
  // AI / data
  "AI Adoption",
  "AI Readiness",
  "Context Engineering",
  "Prompt Engineering",
  "Machine Learning",
  "Dataverse",
  "Data Visualization",
  "Business Intelligence",
  // Cloud / infrastructure
  "Cloud Migration",
  "Lift and Shift",
  "Re-platforming",
  "Cloud Strategy",
  "Kubernetes",
  "Docker",
  "Terraform",
  "Ansible",
  // Web / dev stacks
  "LAMP",
  "PHP",
  "JavaScript",
  "TypeScript",
  "Python",
  "PowerShell",
  "Bash",
  "REST API",
  "MySQL",
  "SQL Server",
  "Drupal",
  // Security / compliance
  "Incident Response",
  "Cybersecurity",
  "Ransomware",
  "Disaster Recovery",
  "HIPAA",
  "Identity and Access Management",
  // Leadership / strategy
  "Digital Transformation",
  "Modernization",
  "Change Enablement",
  "Information Architecture",
  "Governance",
  "Stakeholder Alignment",
] as const;

// ---------------------------------------------------------------------------
// Index construction
// ---------------------------------------------------------------------------

interface ResumeWorkEntry {
  name: string;
  position: string;
  startDate: string;
  summary?: string;
  highlights?: string[];
}

interface ResumeProjectEntry {
  name: string;
  startDate: string;
  description?: string;
  highlights?: string[];
  keywords?: string[];
}

interface ResumeShape {
  work: ResumeWorkEntry[];
  projects: ResumeProjectEntry[];
}

const RESUME = resumeData as unknown as ResumeShape;

function lc(s: string | undefined | null): string {
  return (s ?? "").toLowerCase();
}

function workIdOf(w: ResumeWorkEntry): string {
  return `${w.name}__${w.startDate}`;
}

function projectIdOf(p: ResumeProjectEntry): string {
  return `${p.name}__${p.startDate}`;
}

/**
 * Counts substring occurrences of `needle` in `haystack`, case-insensitive.
 * Returns 0 for empty input. Used to count how many bullets a skill appears
 * in (we treat each highlight bullet as a separate haystack so a skill
 * mentioned in three bullets adds 3 to the frequency).
 */
function countHits(haystack: string, needle: string): number {
  if (!haystack || !needle) return 0;
  const h = lc(haystack);
  const n = lc(needle);
  if (!h.includes(n)) return 0;
  let count = 0;
  let idx = 0;
  while ((idx = h.indexOf(n, idx)) !== -1) {
    count++;
    idx += n.length;
  }
  return count;
}

/**
 * Returns true if any of the strings in `parts` contains the skill
 * (case-insensitive). Used to decide whether a role/project should be
 * added to the skill's `roleIds`/`projectIds` list — a single hit anywhere
 * in the entry's text is enough.
 */
function entryMentions(parts: (string | undefined)[], skill: string): boolean {
  const n = lc(skill);
  return parts.some((p) => p !== undefined && lc(p).includes(n));
}

function buildIndex(): SkillIndexEntry[] {
  const entries: SkillIndexEntry[] = KNOWN_SKILLS.map((skill) => ({
    skill,
    roleIds: [],
    projectIds: [],
    frequency: 0,
  }));

  for (const entry of entries) {
    const { skill } = entry;

    for (const w of RESUME.work) {
      const parts = [w.name, w.position, w.summary, ...(w.highlights ?? [])];
      if (entryMentions(parts, skill)) {
        entry.roleIds.push(workIdOf(w));
        // One mention for the role itself, plus one per highlight bullet
        // that contains the skill. Summary and position are NOT counted
        // separately — we already counted the role itself once.
        entry.frequency += 1;
        for (const hl of w.highlights ?? []) {
          entry.frequency += countHits(hl, skill);
        }
      }
    }

    for (const p of RESUME.projects) {
      const parts = [
        p.name,
        p.description,
        ...(p.highlights ?? []),
        ...(p.keywords ?? []),
      ];
      if (entryMentions(parts, skill)) {
        entry.projectIds.push(projectIdOf(p));
        entry.frequency += 1;
        for (const hl of p.highlights ?? []) {
          entry.frequency += countHits(hl, skill);
        }
      }
    }
  }

  // Sort by frequency desc, then alpha asc for stable ties.
  entries.sort((a, b) => {
    if (b.frequency !== a.frequency) return b.frequency - a.frequency;
    return a.skill.localeCompare(b.skill);
  });

  // Keep zero-frequency entries — they're useful for completeness checks
  // and to surface gaps in the resume. The UI will simply not render
  // chips with frequency=0.
  return entries;
}

export const SKILL_INDEX: SkillIndexEntry[] = buildIndex();

/**
 * Reason: hand-curated subset of the top-frequency skills that read as
 * "core competencies" the visitor would expect to see in the default chip
 * row. We deliberately exclude very-niche tools (Drupal, MySQL) and very-
 * broad descriptors (Governance) in favor of the headline narrative skills.
 * The operator can refine this list later.
 */
export const SKILL_CHIP_DEFAULTS: string[] = [
  "Microsoft 365",
  "SharePoint",
  "Digital Transformation",
  "Cloud Migration",
  "AI Adoption",
  "Incident Response",
  "Power BI",
  "Information Architecture",
  "Modernization",
  "Identity and Access Management",
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

const skillLookup: Map<string, SkillIndexEntry> = new Map(
  SKILL_INDEX.map((e) => [e.skill.toLowerCase(), e]),
);

export function getRolesForSkill(skill: string): string[] {
  const entry = skillLookup.get(skill.toLowerCase());
  return entry ? [...entry.roleIds] : [];
}

export function getProjectsForSkill(skill: string): string[] {
  const entry = skillLookup.get(skill.toLowerCase());
  return entry ? [...entry.projectIds] : [];
}

export function getSkillsForRole(roleId: string): string[] {
  const result: string[] = [];
  for (const entry of SKILL_INDEX) {
    if (entry.roleIds.includes(roleId) || entry.projectIds.includes(roleId)) {
      result.push(entry.skill);
    }
  }
  return result;
}
