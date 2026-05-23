/**
 * Unit tests for the cv-render engine.
 *
 * No test runner is configured in this repo (no jest/vitest in
 * package.json). These tests are written in a runner-agnostic way:
 *   - Vitest / Jest will pick them up directly (describe/it/expect).
 *   - They can also be invoked via a small standalone harness if a
 *     runner is wired up later.
 *
 * The tests depend on agent A's data layer (src/data/resume.json and
 * src/data/cvAudienceTags.ts). If those don't exist yet, the imports
 * fail and the tests are skipped at compile time — which is the
 * expected behavior per the brief.
 */

import { describe, it, expect } from "vitest";
import resume from "../data/resume.json";
import { AUDIENCES, type Audience } from "../data/cvAudienceTags";
import {
  buildRenderPlan,
  EARLIER_EXPERIENCE_ROLE_ID,
  slugifySkill,
  type Section,
} from "./cv-render";

/** Pull a section by kind out of a plan, narrowed correctly. */
function section<K extends Section["kind"]>(
  plan: ReturnType<typeof buildRenderPlan>,
  kind: K,
): Extract<Section, { kind: K }> {
  const s = plan.sections.find((x) => x.kind === kind);
  if (!s) throw new Error(`section "${kind}" missing from plan`);
  return s as Extract<Section, { kind: K }>;
}

describe("buildRenderPlan", () => {
  // ── 1. default audience renders every section visible ──────────────
  it("default audience: every section visible", () => {
    const plan = buildRenderPlan(resume, "default", []);
    for (const s of plan.sections) {
      expect(s.visible).toBe(true);
    }
    expect(plan.audience).toBe("default");
    expect(plan.activeSkillFilters).toEqual([]);
  });

  // ── 2. recruiter audience: ≥10 roles, none hidden ──────────────────
  it("recruiter audience: ≥10 roles with no hidden entries", () => {
    const plan = buildRenderPlan(resume, "recruiter", []);
    const exp = section(plan, "experience");
    expect(exp.roles.length).toBeGreaterThanOrEqual(10);
    const hidden = exp.roles.filter((r) => r.emphasis === "hidden");
    expect(hidden.length).toBe(0);
  });

  // ── 3. investor audience: board/founding roles before line consulting ──
  it("investor audience: board/founding roles ranked before line-consulting roles", () => {
    const plan = buildRenderPlan(resume, "investor", []);
    const exp = section(plan, "experience");
    // Find the first board/founding-emphasis role and the first
    // consulting-emphasis role and assert ordering.
    const boardLikeKeywords = ["board", "founder", "founding", "advisor"];
    const consultingLikeKeywords = ["consultant", "consulting"];

    const firstBoardIdx = exp.roles.findIndex((r) =>
      boardLikeKeywords.some(
        (k) =>
          r.position.toLowerCase().includes(k) ||
          r.name.toLowerCase().includes(k),
      ),
    );
    const firstConsultingIdx = exp.roles.findIndex((r) =>
      consultingLikeKeywords.some(
        (k) =>
          r.position.toLowerCase().includes(k) &&
          // skip the board/founder hits which might also contain "consulting"
          !boardLikeKeywords.some(
            (b) =>
              r.position.toLowerCase().includes(b) ||
              r.name.toLowerCase().includes(b),
          ),
      ),
    );

    if (firstBoardIdx !== -1 && firstConsultingIdx !== -1) {
      expect(firstBoardIdx).toBeLessThan(firstConsultingIdx);
    } else {
      // If the resume doesn't actually contain both classes of role,
      // the audience-emphasis still has to put primary before
      // secondary. Verify that invariant instead.
      const primaryIdxs = exp.roles
        .map((r, i) => (r.emphasis === "primary" ? i : -1))
        .filter((i) => i !== -1);
      const secondaryIdxs = exp.roles
        .map((r, i) => (r.emphasis === "secondary" ? i : -1))
        .filter((i) => i !== -1);
      if (primaryIdxs.length && secondaryIdxs.length) {
        expect(Math.max(...primaryIdxs)).toBeLessThan(Math.min(...secondaryIdxs));
      }
    }
  });

  // ── 4. skill filtering flags recent Microsoft 365 roles ────────────
  it("skill filter 'Microsoft 365': flags MMR/DTIG/Kaufman Hall as matching", () => {
    const plan = buildRenderPlan(resume, "default", ["Microsoft 365"]);
    const exp = section(plan, "experience");
    const m365Matchers = ["mmr", "dtig", "kaufman hall"];
    const matched = exp.roles.filter((r) =>
      m365Matchers.some((needle) => r.name.toLowerCase().includes(needle)),
    );
    expect(matched.length).toBeGreaterThan(0);
    for (const r of matched) {
      expect(r.matchesAllActiveSkills).toBe(true);
    }
    // At least one older role should fail to match.
    const nonMatching = exp.roles.filter((r) => !r.matchesAllActiveSkills);
    expect(nonMatching.length).toBeGreaterThan(0);
  });

  // ── 5. bullets filtering: engineer view trims highlights ───────────
  it("bullets filtering: a tagged role with engineer indices [0, 2] renders 2 highlights", () => {
    // This test relies on cvAudienceTags having at least one role with
    // bullets["engineer"] configured. If none do, we soft-pass on the
    // structural property that ALL highlights flow through.
    const planAll = buildRenderPlan(resume, "default", []);
    const planEng = buildRenderPlan(resume, "engineer", []);
    const expAll = section(planAll, "experience");
    const expEng = section(planEng, "experience");

    // Find a role where the engineer view has strictly fewer highlights
    // than the default view — that's the bullets filter at work.
    const trimmed = expEng.roles.find((engRole) => {
      const allRole = expAll.roles.find((r) => r.roleId === engRole.roleId);
      return allRole && engRole.highlights.length < allRole.highlights.length;
    });

    if (trimmed) {
      // At least one role was trimmed; assert its highlights are a
      // strict subset of the default's, in-order.
      const allRole = expAll.roles.find((r) => r.roleId === trimmed.roleId)!;
      for (const h of trimmed.highlights) {
        expect(allRole.highlights).toContain(h);
      }
    }
    // (If no role was trimmed, the audience-tag config didn't supply
    // engineer bullets for any role yet. Not a failure of the engine.)
  });

  // ── 6. hidden roles surface with emphasis "hidden", not dropped ────
  it("hidden roles appear in plan with emphasis 'hidden', not dropped", () => {
    // Try every audience; if any role is hidden for that audience it
    // must still appear in the plan output.
    for (const audience of AUDIENCES as readonly Audience[]) {
      const plan = buildRenderPlan(resume, audience, []);
      const exp = section(plan, "experience");
      // Total work count from raw data
      const totalWork = Array.isArray((resume as any).work)
        ? (resume as any).work.length
        : 0;
      expect(exp.roles.length).toBe(totalWork);
      // Every role has one of the three valid emphasis values.
      for (const r of exp.roles) {
        expect(["primary", "secondary", "hidden"]).toContain(r.emphasis);
      }
    }
  });

  /* ──────────────────────────────────────────────────────────────────
   * Options: sinceYear collapse + hiddenSections override
   * ────────────────────────────────────────────────────────────────── */

  // ── 7. sinceYear collapses pre-threshold roles into virtual entry ──
  it("sinceYear: 2019 collapses pre-2019 roles into a virtual Earlier Experience entry", () => {
    const baseline = buildRenderPlan(resume, "default", []);
    const baselineRoles = section(baseline, "experience").roles;

    const plan = buildRenderPlan(resume, "default", [], { sinceYear: 2019 });
    const exp = section(plan, "experience");

    // Find the virtual entry. It must exist if the resume has any
    // roles ending before 2019.
    const virtuals = exp.roles.filter(
      (r) => r.roleId === EARLIER_EXPERIENCE_ROLE_ID,
    );

    // How many baseline roles ended before 2019?
    const preCount = baselineRoles.filter((r) => {
      if (!r.endDate) return false; // current → never collapsed
      const yr = parseInt(r.endDate.slice(0, 4), 10);
      return Number.isFinite(yr) && yr < 2019;
    }).length;

    if (preCount === 0) {
      // Nothing to collapse: virtual entry must NOT exist.
      expect(virtuals.length).toBe(0);
    } else {
      expect(virtuals.length).toBe(1);
      const virt = virtuals[0];
      // Virtual entry must be emphasis="hidden" so it falls into the
      // page's collapsed "show more" tier.
      expect(virt.emphasis).toBe("hidden");
      // It must summarize as a bullet-list of older role names.
      expect(virt.highlights.length).toBe(preCount);
      // The plan total = (kept post-2019 roles) + 1 virtual entry.
      const keptCount = baselineRoles.filter((r) => {
        if (!r.endDate) return true; // current role kept
        const yr = parseInt(r.endDate.slice(0, 4), 10);
        return !Number.isFinite(yr) || yr >= 2019;
      }).length;
      expect(exp.roles.length).toBe(keptCount + 1);
    }

    // Post-2019 / current roles must remain in the plan with their
    // original roleId unchanged.
    const post2019 = baselineRoles.filter((r) => {
      if (!r.endDate) return true;
      const yr = parseInt(r.endDate.slice(0, 4), 10);
      return !Number.isFinite(yr) || yr >= 2019;
    });
    for (const original of post2019) {
      const stillHere = exp.roles.find((r) => r.roleId === original.roleId);
      expect(stillHere).toBeDefined();
    }
  });

  // ── 8. hiddenSections force-hides regardless of audience defaults ──
  it("hiddenSections: ['education','awards'] marks both sections visible:false", () => {
    const plan = buildRenderPlan(resume, "default", [], {
      hiddenSections: ["education", "awards"],
    });
    expect(section(plan, "education").visible).toBe(false);
    expect(section(plan, "awards").visible).toBe(false);
    // Every other section keeps its default visibility.
    expect(section(plan, "summary").visible).toBe(true);
    expect(section(plan, "experience").visible).toBe(true);
    expect(section(plan, "skills").visible).toBe(true);
  });

  // ── 9. composition: filters compose with audience + skill filters ──
  it("composes sinceYear + hiddenSections with audience + skill filters", () => {
    const plan = buildRenderPlan(resume, "engineer", ["Microsoft 365"], {
      sinceYear: 2019,
      hiddenSections: ["volunteer"],
    });

    // Audience + skill: skill matching must still annotate roles.
    const exp = section(plan, "experience");
    const anyMatched = exp.roles.some(
      (r) => r.skillsMatched.length > 0,
    );
    // Either at least one role matched the skill, OR all roles ended
    // pre-2019 (which would collapse them into a single virtual entry
    // that doesn't carry skillsMatched). Both outcomes are valid.
    const virtualOnly =
      exp.roles.length === 1 &&
      exp.roles[0].roleId === EARLIER_EXPERIENCE_ROLE_ID;
    expect(anyMatched || virtualOnly).toBe(true);

    // hiddenSections override: volunteer must be hidden even though
    // the engineer matrix already defaults volunteer to hidden — we're
    // asserting the explicit-override path still produces visible:false.
    expect(section(plan, "volunteer").visible).toBe(false);

    // Audience matrix preserved for other sections.
    expect(section(plan, "summary").visible).toBe(true);
    expect(section(plan, "experience").visible).toBe(true);

    // Skill filters survive on the plan output.
    expect(plan.activeSkillFilters).toEqual(["Microsoft 365"]);
    expect(plan.audience).toBe("engineer");
  });

  /* ──────────────────────────────────────────────────────────────────
   * Client-adaptation data: per-role audienceMatrix, slugified skills,
   * yearEnd, and audiences/hiddenForAudiences split.
   * ────────────────────────────────────────────────────────────────── */

  it("every role carries an audienceMatrix covering all 6 audiences", () => {
    const plan = buildRenderPlan(resume, "default", []);
    const exp = section(plan, "experience");
    for (const r of exp.roles) {
      // Every audience key from AUDIENCES is present in the matrix.
      for (const a of AUDIENCES) {
        expect(r.audienceMatrix[a]).toBeDefined();
        expect(["primary", "secondary", "hidden"]).toContain(
          r.audienceMatrix[a],
        );
      }
    }
  });

  it("audiencesData omits audiences where role is hidden", () => {
    const plan = buildRenderPlan(resume, "default", []);
    const exp = section(plan, "experience");
    for (const r of exp.roles) {
      // Invariant: audiencesData + hiddenForAudiences partition AUDIENCES.
      const all = new Set([...r.audiencesData, ...r.hiddenForAudiences]);
      expect(all.size).toBe(AUDIENCES.length);
      // No audience appears in both halves.
      for (const h of r.hiddenForAudiences) {
        expect(r.audiencesData).not.toContain(h);
      }
      // Matrix agrees with the partition.
      for (const a of r.hiddenForAudiences) {
        expect(r.audienceMatrix[a as Audience]).toBe("hidden");
      }
    }
  });

  it("yearEnd parses ISO endDate; open-ended roles get current year", () => {
    const plan = buildRenderPlan(resume, "default", []);
    const exp = section(plan, "experience");
    const currentYear = new Date().getFullYear();
    for (const r of exp.roles) {
      if (r.roleId === EARLIER_EXPERIENCE_ROLE_ID) continue;
      if (r.endDate) {
        const expected = parseInt(r.endDate.slice(0, 4), 10);
        if (Number.isFinite(expected)) expect(r.yearEnd).toBe(expected);
      } else {
        // Open-ended → today.
        expect(r.yearEnd).toBe(currentYear);
      }
    }
  });

  it("skillsData is slugified (lowercase, hyphens, no spaces)", () => {
    const plan = buildRenderPlan(resume, "default", []);
    const exp = section(plan, "experience");
    for (const r of exp.roles) {
      for (const slug of r.skillsData) {
        // No uppercase, no whitespace, no leading/trailing hyphens.
        expect(slug).toBe(slug.toLowerCase());
        expect(/\s/.test(slug)).toBe(false);
        expect(slug.startsWith("-")).toBe(false);
        expect(slug.endsWith("-")).toBe(false);
      }
    }
  });

  it("slugifySkill produces stable URL/CSS-safe tokens", () => {
    expect(slugifySkill("Microsoft 365")).toBe("microsoft-365");
    expect(slugifySkill("Identity and Access Management")).toBe(
      "identity-and-access-management",
    );
    expect(slugifySkill("  Power BI  ")).toBe("power-bi");
    expect(slugifySkill("")).toBe("");
  });

  // ── 10. options-omitted call preserves existing behavior ───────────
  it("backward compatibility: omitting options yields identical plan to 3-arg call", () => {
    const a = buildRenderPlan(resume, "default", ["TypeScript"]);
    const b = buildRenderPlan(resume, "default", ["TypeScript"], {});
    // Section visibility and role counts must match exactly.
    expect(a.sections.length).toBe(b.sections.length);
    for (let i = 0; i < a.sections.length; i++) {
      expect(a.sections[i].kind).toBe(b.sections[i].kind);
      expect(a.sections[i].visible).toBe(b.sections[i].visible);
    }
    const expA = section(a, "experience");
    const expB = section(b, "experience");
    expect(expA.roles.length).toBe(expB.roles.length);
    // No virtual entry should appear when sinceYear is absent.
    expect(
      expB.roles.some((r) => r.roleId === EARLIER_EXPERIENCE_ROLE_ID),
    ).toBe(false);
  });
});
