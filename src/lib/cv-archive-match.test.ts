/**
 * Unit tests for cv-archive-match.ts.
 *
 * No test runner is wired into this repo's package.json. These tests are
 * written runner-agnostic:
 *   - Vitest / Jest will pick them up via describe/it/expect.
 *   - node:test can run them by replacing the import shim below with the
 *     real `node:test` and `node:assert/strict` modules.
 *
 * The tests deliberately use a small synthetic fixture instead of the live
 * archive snapshot so they remain deterministic as the archive grows.
 */

// Reason: only vitest/jest are currently runner-friendly options. The shim
// below preserves the standard describe/it/expect surface and matches the
// pattern already used by `cv-render.test.ts` next to this file.
import { describe, it, expect } from "vitest";

import {
  matchArchive,
  extractKeywords,
  heuristicAudienceFor,
  MATCH_THRESHOLD_GOOD,
  type ResumeArchiveEntry,
} from "./cv-archive-match";

/** Compact factory so the fixture below stays readable. */
function entry(
  partial: Partial<ResumeArchiveEntry> & {
    company: string;
    jobTitle: string;
    keywords?: string[];
    generatedDate?: string;
    variant?: string;
  },
): ResumeArchiveEntry {
  return {
    sourceFile: `${partial.company}/${partial.jobTitle}/output/${partial.variant ?? "FullCV"}/x.md`,
    workspace: {
      company: partial.company,
      jobTitle: partial.jobTitle,
      variant: partial.variant ?? "FullCV",
    },
    summary: partial.summary ?? "",
    skills: partial.skills ?? "",
    experience: partial.experience ?? [],
    projects: partial.projects ?? [],
    education: partial.education ?? [],
    certifications: partial.certifications ?? [],
    publications: partial.publications ?? [],
    awards: partial.awards ?? [],
    volunteer: partial.volunteer ?? [],
    languages: partial.languages ?? [],
    keywords: partial.keywords ?? [],
    generatedDate: partial.generatedDate ?? "2026-01-01",
    wordCount: partial.wordCount ?? 500,
  };
}

const FIXTURE: ResumeArchiveEntry[] = [
  // CTO-style — VP Technology
  entry({
    company: "ROADRUNNER",
    jobTitle: "Vice President, Technology",
    keywords: ["sharepoint", "microsoft", "azure", "cloud", "engineering", "platform"],
    generatedDate: "2026-05-13",
  }),
  // CTO-style — Director of Technology
  entry({
    company: "Acme Holdings",
    jobTitle: "Director of Technology",
    keywords: ["sharepoint", "microsoft", "365", "office", "governance"],
    generatedDate: "2026-05-12",
  }),
  // Engineer-style — IT Manager
  entry({
    company: "Larko Group",
    jobTitle: "Information Technology Manager",
    keywords: ["sharepoint", "azure", "engineer", "platform", "scripting"],
    generatedDate: "2026-05-10",
  }),
  // Engineer-style — IT Director (also leadership keywords but heuristic
  // priority puts "engineer" relevant keywords first when title contains "it director")
  entry({
    company: "PAX Tech",
    jobTitle: "IT Director",
    keywords: ["azure", "infrastructure", "linux", "kubernetes", "docker"],
    generatedDate: "2026-05-09",
  }),
  // Board-style — Executive Director
  entry({
    company: "Trustmark",
    jobTitle: "Executive Director, IT Digital Delivery",
    keywords: ["governance", "transformation", "digital", "delivery"],
    generatedDate: "2026-05-08",
  }),
];

describe("matchArchive — audience-only ranking", () => {
  it("returns CTO-style workspaces first when audience is 'cto'", () => {
    const matches = matchArchive("cto", undefined, FIXTURE, 5);
    expect(matches.length).toBeGreaterThan(0);
    // Top match must be a workspace whose heuristic audience is CTO.
    const top = matches[0];
    expect(heuristicAudienceFor(top.entry)).toBe("cto");
    // Top score for an exact match is 1.0 audience-only.
    expect(top.score).toBeCloseTo(1.0, 6);
    // Reason string mentions CTO-style.
    expect(top.reasons.some((r) => /CTO/i.test(r))).toBe(true);
  });

  it("recruiter audience returns entries regardless of role type", () => {
    const matches = matchArchive("recruiter", undefined, FIXTURE, 100);
    // Every fixture entry is returned at a perfect 1.0 score (recruiter wants
    // everything).
    expect(matches.length).toBe(FIXTURE.length);
    for (const m of matches) {
      expect(m.score).toBeCloseTo(1.0, 6);
    }
    // Reason strings mention recruiter view.
    expect(matches[0].reasons.some((r) => /recruiter/i.test(r))).toBe(true);
  });

  it("empty jdText does not crash; falls back to audience-only matching", () => {
    expect(() => matchArchive("cto", "", FIXTURE)).not.toThrow();
    expect(() => matchArchive("cto", undefined, FIXTURE)).not.toThrow();
    const withEmpty = matchArchive("cto", "", FIXTURE, 3);
    const withUndefined = matchArchive("cto", undefined, FIXTURE, 3);
    // Both code paths produce the same scoring.
    expect(withEmpty.map((m) => m.entry.workspace.company)).toEqual(
      withUndefined.map((m) => m.entry.workspace.company),
    );
  });
});

describe("matchArchive — JD-aware ranking", () => {
  it("entries with JD-matching keywords rank ahead of unrelated ones", () => {
    const jd =
      "We use Microsoft 365, SharePoint, and Azure heavily across our platform engineering team.";
    const matches = matchArchive("engineer", jd, FIXTURE, 5);
    // The top match must have at least one of the JD keywords in its keyword
    // list. The Larko Group / ROADRUNNER / Acme Holdings entries do.
    const topKeywords = matches[0].entry.keywords;
    const jdKw = extractKeywords(jd);
    const overlap = jdKw.filter((k) => topKeywords.includes(k));
    expect(overlap.length).toBeGreaterThan(0);
    // The first reason should report the keyword-overlap count.
    expect(matches[0].reasons[0]).toMatch(/JD keywords/);
  });
});

describe("matchArchive — bookkeeping", () => {
  it("topK parameter is respected", () => {
    const three = matchArchive("recruiter", undefined, FIXTURE, 3);
    expect(three.length).toBe(3);
    const two = matchArchive("recruiter", undefined, FIXTURE, 2);
    expect(two.length).toBe(2);
    // Requesting more than available returns at most archive.length entries.
    const many = matchArchive("recruiter", undefined, FIXTURE, 999);
    expect(many.length).toBe(FIXTURE.length);
  });

  it("MATCH_THRESHOLD_GOOD is exported and between 0.4 and 0.7", () => {
    expect(MATCH_THRESHOLD_GOOD).toBeGreaterThanOrEqual(0.4);
    expect(MATCH_THRESHOLD_GOOD).toBeLessThanOrEqual(0.7);
  });

  it("empty archive returns []", () => {
    expect(matchArchive("cto", undefined, [], 5)).toEqual([]);
  });
});
