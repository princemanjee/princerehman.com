/**
 * themeSchedule.ts
 *
 * Phase 2 scheduled-default config for the Prism design system.
 *
 * Purpose
 * -------
 * Declares a 12-month rotating set of seasonal / celebratory swatch and theme
 * defaults that the pre-paint bootstrap in BaseLayout.astro consumes on every
 * page load to choose the right default look for the visitor.
 *
 * Semantics
 * ---------
 * Each entry is either SOFT (default) or FORCE.
 *
 *   SOFT entry  (force omitted or false)
 *     Applies only to visitors who have NEVER actively picked a theme via the
 *     Prism control panel. It is their launch default for the duration of the
 *     window. A visitor who has previously picked anything keeps their pick.
 *
 *   FORCE entry (force: true)
 *     Applies on every page load while the entry covers today's date and
 *     OVERRIDES any saved theme, UNLESS the visitor has actively picked a
 *     theme via the Prism control panel since this force period started.
 *     Once the visitor picks during a force window, that pick is sticky from
 *     then on (both within and after the force period).
 *
 * Note: the visitor-pick stickiness and "since this force period started"
 * bookkeeping live in localStorage, written by the bootstrap. This module is
 * data-only and pure TypeScript with no DOM access.
 *
 * Year-wrap
 * ---------
 * Entries use ISO recurring "MM-DD" strings (year-agnostic, repeats annually).
 * When end < start lexicographically (e.g. start=12-29, end=01-05), the window
 * crosses the year boundary. getActiveScheduleEntry handles this by checking
 * `today >= start || today <= end` for wrap ranges, and the normal
 * `today >= start && today <= end` for non-wrap ranges. Lexicographic compare
 * works on zero-padded "MM-DD".
 *
 * Overlap rule
 * ------------
 * When more than one entry covers today, pick the winner in this order:
 *   1. force entries beat soft entries
 *   2. among entries of equal force status, the one with the most-recent
 *      start (closest to today, descending) wins
 *   3. if still tied, lexicographic order of id (stable fallback)
 *
 * Fallback
 * --------
 * When no entry covers today, getActiveScheduleEntry returns
 * `{ entry: null, isForce: false }`. The bootstrap then uses the site-wide
 * fallback (Hybrid theme, royal-default swatch) for visitors who haven't
 * picked.
 */

export type ThemeMode = "dark" | "light" | "hybrid" | "system" | "neomorphic";

export interface ScheduleEntry {
  /** Stable key. Used by the bootstrap to track per-force-period state. */
  id: string;
  /** Inclusive recurring start, "MM-DD" zero-padded. */
  start: string;
  /** Inclusive recurring end, "MM-DD" zero-padded. May be before start to indicate year-wrap. */
  end: string;
  /** Matches a swatch id from src/data/prismSwatches.ts. */
  swatch: string;
  /** Optional theme mode override while this entry is active. */
  mode?: ThemeMode;
  /** Human-readable label (e.g. for admin UI, tooltips). */
  label: string;
  /** When true, overrides saved themes per the semantics above. Defaults to false. */
  force?: boolean;
}

export interface ResolvedSchedule {
  entry: ScheduleEntry | null;
  isForce: boolean;
}

/**
 * Starter schedule. Order in this array is not significant; resolution is
 * deterministic via the overlap rule.
 */
export const schedule: ScheduleEntry[] = [
  // Pride Month. The canonical FORCE example: site flips to Pride colors for
  // all visitors who have not actively picked since the period began.
  {
    id: "pride-month",
    start: "06-01",
    end: "06-30",
    swatch: "pride",
    label: "Pride Month",
    force: true,
  },

  // Independence Day window. Soft seasonal nod for first-time visitors.
  {
    id: "july-4-patriotic",
    start: "07-01",
    end: "07-07",
    swatch: "patriotic",
    label: "July 4 Patriotic",
  },

  // Late summer. Soft warm-palette default through August.
  {
    id: "late-summer",
    start: "08-01",
    end: "08-31",
    swatch: "hot-coral",
    label: "Late summer",
  },

  // Halloween. Soft seasonal default for October.
  {
    id: "halloween",
    start: "10-01",
    end: "10-31",
    swatch: "halloween",
    label: "Halloween",
  },

  // Christmas / winter holiday season. Soft default from late November
  // through the day before the New Year noir window.
  {
    id: "christmas-season",
    start: "11-25",
    end: "12-28",
    swatch: "christmas",
    label: "Christmas season",
  },

  // New Year noir. Crosses the year boundary (Dec 29 -> Jan 5). Soft default,
  // with an explicit dark mode pairing for the noir feel.
  {
    id: "new-year-noir",
    start: "12-29",
    end: "01-05",
    swatch: "charcoal-noir",
    mode: "dark",
    label: "New Year noir",
  },

  // Spring. Soft default from the vernal equinox through end of May.
  {
    id: "spring",
    start: "03-20",
    end: "05-31",
    swatch: "lavender-spring",
    label: "Spring",
  },
];

/** Format a Date as zero-padded "MM-DD" in local time. */
function toMonthDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day}`;
}

/** True when the entry's window covers the given "MM-DD", handling year-wrap. */
function entryCovers(entry: ScheduleEntry, today: string): boolean {
  const { start, end } = entry;
  if (start <= end) {
    return today >= start && today <= end;
  }
  // Year-wrap window: covers from `start` through end-of-year and from
  // start-of-year through `end`.
  return today >= start || today <= end;
}

/**
 * Return the active schedule entry for the given date.
 *
 * Resolution:
 *   1. Filter entries whose window covers today's MM-DD.
 *   2. Prefer force entries over soft entries.
 *   3. Among equal-force candidates, prefer the most-recent start
 *      (lexicographically greatest start that is still <= today, accounting
 *      for year-wrap by treating wrap entries as having "started" on their
 *      MM-DD regardless of which calendar year today falls in).
 *   4. Tiebreak by id ascending.
 *
 * Returns `{ entry: null, isForce: false }` when nothing matches.
 */
export function getActiveScheduleEntry(date: Date): ResolvedSchedule {
  const today = toMonthDay(date);

  const matches = schedule.filter((entry) => entryCovers(entry, today));
  if (matches.length === 0) {
    return { entry: null, isForce: false };
  }

  // "Most-recent start" relative to today, considering year-wrap:
  //   - If the entry does NOT wrap, its start is <= today (since it matched),
  //     so distance = today - start using simple lexicographic compare is fine.
  //   - If the entry DOES wrap (end < start) and today >= start, the start
  //     is in the current year and is <= today.
  //   - If the entry DOES wrap and today <= end, the start was last year;
  //     it's still the most-recent start of that entry. We model that by
  //     treating its effective start as <= today by construction. For
  //     comparison across entries we use a synthetic key: the start itself,
  //     but wrap entries whose start is in the prior year get a leading "0"
  //     so today's-year starts win ties intuitively.
  function recencyKey(entry: ScheduleEntry): string {
    const wraps = entry.end < entry.start;
    const startInPriorYear = wraps && today <= entry.end;
    // Prefix ensures current-year starts sort after prior-year starts when
    // we pick the maximum.
    return (startInPriorYear ? "0:" : "1:") + entry.start;
  }

  matches.sort((a, b) => {
    // 1. Force beats soft.
    const aForce = a.force === true ? 1 : 0;
    const bForce = b.force === true ? 1 : 0;
    if (aForce !== bForce) return bForce - aForce;

    // 2. Most-recent start wins (descending).
    const aKey = recencyKey(a);
    const bKey = recencyKey(b);
    if (aKey !== bKey) return aKey < bKey ? 1 : -1;

    // 3. Stable tiebreak by id ascending.
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });

  const winner = matches[0];
  return { entry: winner, isForce: winner.force === true };
}
