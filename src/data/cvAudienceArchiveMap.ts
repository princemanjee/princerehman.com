/**
 * cvAudienceArchiveMap.ts
 *
 * Curated map of audience → preferred archive entry. When a request comes
 * in for `?for=cto`, the page asks this map for the company+variant of the
 * tailored resume that best represents the CTO view, looks it up in
 * `resumeArchive.json`, and renders THAT entry's content as the page body.
 *
 * When a mapping is `null`, the page falls back to the engine-generated
 * RenderPlan (`buildRenderPlan(resume, audience, ...)`). That is the
 * intended escape hatch for audiences with no clear archive candidate.
 *
 * Picks below are best-guess derived from Agent C's heuristic that
 * classifies ~11/14 unique companies as CTO-shape and ~3/14 as
 * engineering-shape. The user is expected to override these manually
 * after the initial wiring lands — the file is intentionally kept small,
 * sorted, and easy to skim so editing is trivial.
 *
 * Pairing rules:
 *   - workspace.company + workspace.variant must match an entry in
 *     src/data/resumeArchive.json exactly (case + spacing matter).
 *   - Variant is usually "FullCV" for richest content, but for board /
 *     investor we may prefer a denser one-pager. Pick whichever variant
 *     best matches the audience's expected reading depth.
 *   - Set the entry to `null` to force the engine fallback for that
 *     audience. The page still renders, just from resume.json directly.
 */

import type { Audience } from "./cvAudienceTags";

export interface ArchiveSelection {
  /** Exact workspace.company string from resumeArchive.json. */
  company: string;
  /** Exact workspace.variant string from resumeArchive.json. */
  variant: string;
}

/**
 * Curated picks. Each entry is one of:
 *   { company, variant }  — render this archive entry as the page body
 *   null                  — fall back to the engine-generated plan
 *
 * EDIT FREELY. Add new picks, swap variants, set audiences to null.
 * The loader logs to console if an entry is configured but missing
 * from the archive so typos surface immediately during `npm run dev`.
 */
export const AUDIENCE_ARCHIVE_MAP: Record<Audience, ArchiveSelection | null> = {
  /*
   * default — neutral overview. Engine-rendered from resume.json so every
   * role is visible without any audience slant. (No archive entry is
   * truly "neutral" since every tailored package targets a specific job.)
   */
  default: null,

  /*
   * cto — flagship CTO-shape archive entry. Brown & Brown is a Senior
   * Director Technology Solutions role with strong transformation and
   * leadership signal, hitting the CTO view squarely.
   */
  cto: { company: "Brown & Brown", variant: "FullCV" },

  /*
   * engineer — hands-on IT Manager / engineering-lead shape. The Larko
   * Group's "Information Technology Manager" workspace is the closest
   * pure-engineering archive entry; its FullCV preserves the technical
   * depth recruiters scanning for IC depth expect.
   */
  engineer: { company: "The Larko Group", variant: "FullCV" },

  /*
   * board — executive board-facing presentation. Trustmark's "Executive
   * Director, IT Digital Delivery" is the closest board-shape entry;
   * FullCV gives space for governance + strategic outcomes.
   */
  board: { company: "Trustmark", variant: "FullCV" },

  /*
   * investor — no clear investor-shape entry in the current archive
   * (the corpus is IT leadership roles, not VC / founder pitches).
   * Engine fallback so the investor view still highlights the Groove
   * Science board role + Cognesense founding work from resume.json.
   */
  investor: null,

  /*
   * recruiter — recruiter view shows everything. Engine fallback so the
   * full 30-year history surfaces without an archive's narrowing slant.
   */
  recruiter: null,
};
