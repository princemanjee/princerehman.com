/**
 * cvData.test.ts
 *
 * Smoke tests for the Adaptive CV data layer. The princerehman.com repo
 * does not yet have a test runner configured (no vitest / jest in
 * package.json as of this writing), so these tests are written as plain
 * assertions inside an exported `runCvDataTests()` function. They can be
 * executed with `tsx`, `ts-node`, or imported from a future test runner.
 *
 * To run manually once a runner is added, either:
 *   - Switch to `describe/it` blocks for vitest, or
 *   - Run `import { runCvDataTests } from './cvData.test'; runCvDataTests();`
 *     from a small wrapper script and assert it doesn't throw.
 *
 * Each test throws on failure with a clear message so the failing
 * assertion is obvious in the stack trace.
 */

import resumeData from "./resume.json" with { type: "json" };
import {
  AUDIENCES,
  emphasisFor,
  getRoleTag,
  visibleForAudience,
  type Audience,
  type RoleAudienceTag,
} from "./cvAudienceTags";
import {
  SKILL_CHIP_DEFAULTS,
  SKILL_INDEX,
  getRolesForSkill,
} from "./cvSkillIndex";

interface ResumeShape {
  basics?: unknown;
  work: { name: string; startDate: string }[];
  projects: { name: string; startDate: string }[];
  skills?: unknown;
  education?: unknown;
  certificates?: unknown;
  publications?: unknown;
  awards?: unknown;
  volunteer?: unknown;
  languages?: unknown;
}

const RESUME = resumeData as unknown as ResumeShape;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/**
 * 1. resume.json parses and has the expected top-level keys.
 *    Note: the snapshot also adds `_snapshotMeta`; we don't enforce it
 *    here so the test stays robust if metadata changes.
 */
export function testResumeShape(): void {
  const required = [
    "basics",
    "work",
    "projects",
    "skills",
    "education",
    "certificates",
    "publications",
    "awards",
    "volunteer",
    "languages",
  ];
  for (const key of required) {
    assert(
      Object.prototype.hasOwnProperty.call(RESUME, key),
      `resume.json missing required key '${key}'`,
    );
  }
  assert(Array.isArray(RESUME.work), "resume.work should be an array");
  assert(RESUME.work.length > 0, "resume.work should not be empty");
  assert(Array.isArray(RESUME.projects), "resume.projects should be an array");
  assert(RESUME.projects.length > 0, "resume.projects should not be empty");
}

/**
 * 2. Every work entry resolves to a valid RoleAudienceTag — either via
 *    explicit override or heuristic fallback. Same for projects.
 */
export function testEveryRoleHasTag(): void {
  for (const w of RESUME.work) {
    const id = `${w.name}__${w.startDate}`;
    const tag = getRoleTag(id);
    assert(tag !== undefined, `getRoleTag returned undefined for work id '${id}'`);
    assertValidTag(tag, id);
  }
  for (const p of RESUME.projects) {
    const id = `${p.name}__${p.startDate}`;
    const tag = getRoleTag(id);
    assert(tag !== undefined, `getRoleTag returned undefined for project id '${id}'`);
    assertValidTag(tag, id);
  }
}

function assertValidTag(tag: RoleAudienceTag, id: string): void {
  assert(tag.roleId === id, `tag.roleId mismatch for '${id}'`);
  assert(Array.isArray(tag.audiences), `tag.audiences not array for '${id}'`);
  const validEmphasis = new Set(["primary", "secondary", "hidden"]);
  for (const a of AUDIENCES) {
    const e = tag.emphasis[a];
    assert(
      validEmphasis.has(e),
      `tag.emphasis[${a}] = '${e}' is not primary|secondary|hidden for '${id}'`,
    );
  }
}

/**
 * 3. visibleForAudience(roleId, "recruiter") is true for every role and
 *    every project — recruiter view is comprehensive.
 */
export function testRecruiterShowsEverything(): void {
  for (const w of RESUME.work) {
    const id = `${w.name}__${w.startDate}`;
    assert(
      visibleForAudience(id, "recruiter"),
      `recruiter view should show '${id}' but visibleForAudience returned false`,
    );
  }
  for (const p of RESUME.projects) {
    const id = `${p.name}__${p.startDate}`;
    assert(
      visibleForAudience(id, "recruiter"),
      `recruiter view should show project '${id}' but visibleForAudience returned false`,
    );
  }
}

/**
 * 4. emphasisFor returns primary | secondary | hidden for every
 *    (role, audience) pair, with no undefined leaks.
 */
export function testEmphasisAlwaysValid(): void {
  const valid = new Set(["primary", "secondary", "hidden"]);
  const allIds: string[] = [
    ...RESUME.work.map((w) => `${w.name}__${w.startDate}`),
    ...RESUME.projects.map((p) => `${p.name}__${p.startDate}`),
  ];
  for (const id of allIds) {
    for (const a of AUDIENCES) {
      const e = emphasisFor(id, a);
      assert(
        valid.has(e),
        `emphasisFor('${id}', '${a}') returned '${e}', expected primary|secondary|hidden`,
      );
    }
  }
}

/**
 * 5. SKILL_INDEX is non-empty; key narrative skills appear.
 */
export function testSkillIndexCoreSkills(): void {
  assert(SKILL_INDEX.length > 0, "SKILL_INDEX should not be empty");
  const skillNames = new Set(SKILL_INDEX.map((s) => s.skill));
  for (const required of ["Microsoft 365", "SharePoint", "AI Adoption"]) {
    assert(skillNames.has(required), `SKILL_INDEX missing required skill '${required}'`);
  }
  // Each of those should have nonzero frequency given the resume content.
  for (const required of ["Microsoft 365", "SharePoint", "AI Adoption"]) {
    const entry = SKILL_INDEX.find((s) => s.skill === required);
    assert(
      entry !== undefined && entry.frequency > 0,
      `SKILL_INDEX entry '${required}' should have frequency > 0`,
    );
  }
}

/**
 * 6. getRolesForSkill("Microsoft 365") returns at least 3 role IDs — the
 *    resume mentions Microsoft 365 across MMR, DTIG, Heitman, Kaufman
 *    Hall, Rockit Ranch, Tahoe Partners, so 3 is a conservative floor.
 */
export function testMicrosoft365Coverage(): void {
  const roles = getRolesForSkill("Microsoft 365");
  assert(
    roles.length >= 3,
    `expected >=3 roles for 'Microsoft 365', got ${roles.length}: ${JSON.stringify(roles)}`,
  );
}

/**
 * 7. SKILL_CHIP_DEFAULTS contains 8-12 entries, all present in SKILL_INDEX.
 */
export function testChipDefaultsValid(): void {
  assert(
    SKILL_CHIP_DEFAULTS.length >= 8 && SKILL_CHIP_DEFAULTS.length <= 12,
    `SKILL_CHIP_DEFAULTS should have 8-12 entries, got ${SKILL_CHIP_DEFAULTS.length}`,
  );
  const skillNames = new Set(SKILL_INDEX.map((s) => s.skill));
  for (const chip of SKILL_CHIP_DEFAULTS) {
    assert(
      skillNames.has(chip),
      `SKILL_CHIP_DEFAULTS contains '${chip}' which is not in SKILL_INDEX`,
    );
  }
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

export function runCvDataTests(): void {
  const tests: { name: string; fn: () => void }[] = [
    { name: "resume.json shape", fn: testResumeShape },
    { name: "every role has a tag", fn: testEveryRoleHasTag },
    { name: "recruiter view shows every role", fn: testRecruiterShowsEverything },
    { name: "emphasisFor always returns valid value", fn: testEmphasisAlwaysValid },
    { name: "SKILL_INDEX core skills present", fn: testSkillIndexCoreSkills },
    { name: "getRolesForSkill('Microsoft 365') >= 3", fn: testMicrosoft365Coverage },
    { name: "SKILL_CHIP_DEFAULTS valid", fn: testChipDefaultsValid },
  ];

  let passed = 0;
  const failures: { name: string; error: string }[] = [];
  for (const t of tests) {
    try {
      t.fn();
      passed++;
    } catch (err) {
      failures.push({ name: t.name, error: err instanceof Error ? err.message : String(err) });
    }
  }

  if (failures.length > 0) {
    const lines = failures.map((f) => `  - ${f.name}: ${f.error}`).join("\n");
    throw new Error(`cvData tests: ${passed}/${tests.length} passed, ${failures.length} failed\n${lines}`);
  }
}

// Used by audience iteration in testEmphasisAlwaysValid — silences unused
// import warning under strict TS settings where the type is otherwise
// imported only for documentation.
const _audienceTypeWitness: Audience = "default";
void _audienceTypeWitness;
