// Pure derivations over parsed DARS data.
//
// Everything here is a deterministic function of the parsed payload — no
// React state, no fetch, no side effects — so the dashboard cards can stay
// thin display components and these calculations stay easy to read, reason
// about, and (later) unit test.
//
// Two duplications worth calling out:
//   1. GPA_POINTS — same 4.0 scale the backend uses in grades.py. Duplicated
//      so the dashboard doesn't need a round-trip just to total a GPA.
//   2. Term decoding — UCLA's DARS encodes terms as "FA23", "WI24", "SP24",
//      "SU24". The backend grades dataset uses a different ("24F") encoding,
//      so we keep a local DARS-specific parser here rather than share code.

import type { Course, CumulativeGpa, Parsed } from "./types";
import type { GradeStats } from "./grades";

// 4.0 grade-point scale. Letter grades not in this map (P, NP, IP, S, U, NR,
// TA, AP, …) are excluded from GPA averaging.
export const GPA_POINTS: Record<string, number> = {
  "A+": 4.0, "A": 4.0, "A-": 3.7,
  "B+": 3.3, "B": 3.0, "B-": 2.7,
  "C+": 2.3, "C": 2.0, "C-": 1.7,
  "D+": 1.3, "D": 1.0, "D-": 0.7,
  "F": 0.0,
};

// UCLA bachelor's minimum. Some majors require more, but 180 is the floor.
export const UNITS_TO_GRADUATE = 180;

// --- core scalars ---

// Units-weighted cumulative GPA over courses with a GPA-eligible letter grade.
// Returns null when no course contributes (e.g. only P/NP/IP grades).
export function cumulativeGpa(courses: Course[]): number | null {
  let points = 0;
  let units = 0;
  for (const c of courses) {
    const p = GPA_POINTS[c.grade];
    if (p === undefined) continue;
    points += p * c.units;
    units += c.units;
  }
  return units > 0 ? points / units : null;
}

// Sum of units across courses — includes P, S, etc. since they still count
// toward graduation even though they don't contribute to GPA.
export function totalUnits(courses: Course[]): number {
  return courses.reduce((sum, c) => sum + c.units, 0);
}

// gpa = total points / total units. start from UCLA's tally if we got it
// from the audit, then add the new courses on top.
export function projectGpa(
  base: CumulativeGpa | null | undefined,
  extras: Course[],
): number | null {
  let units = 0;
  let points = 0;
  if (base) {
    units = base.units;
    points = base.points;
  }
  for (const c of extras) {
    const p = GPA_POINTS[c.grade];
    if (p === undefined) continue;
    units += c.units;
    points += p * c.units;
  }
  if (units === 0) return null;
  return points / units;
}

// --- grade band breakdown ---

export type GradeBand = "A" | "B" | "C" | "D" | "F";
export type GradeBandCount = { label: GradeBand; count: number };

const BANDS: GradeBand[] = ["A", "B", "C", "D", "F"];

// Count of courses in each A/B/C/D/F band. Non-letter grades are excluded.
export function gradeBandCounts(courses: Course[]): GradeBandCount[] {
  const counts: Record<GradeBand, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const c of courses) {
    if (GPA_POINTS[c.grade] === undefined) continue;
    const first = c.grade.charAt(0) as GradeBand;
    if (first in counts) counts[first]++;
  }
  return BANDS.map((b) => ({ label: b, count: counts[b] }));
}

// Adapt completed courses into the GradeStats shape that GradeBars expects.
// `distribution` is course counts, `graded` is the count of letter-graded
// courses, and `avg_gpa` is the units-weighted cumulative — so the dashboard
// chart matches the explorer's chart visually and surfaces a sensible
// headline at the same time.
export function completedGradeStats(courses: Course[]): GradeStats {
  const distribution: Record<string, number> = {};
  let graded = 0;
  for (const c of courses) {
    distribution[c.grade] = (distribution[c.grade] ?? 0) + 1;
    if (GPA_POINTS[c.grade] !== undefined) graded++;
  }
  return {
    distribution,
    total: courses.length,
    graded,
    avg_gpa: cumulativeGpa(courses),
  };
}

// --- term decoding (DARS-specific) ---

// DARS quarter codes in chronological order within an academic year.
const QUARTER_CODES = ["WI", "SP", "SU", "FA"] as const;
const QUARTER_NAMES: Record<string, string> = {
  WI: "Winter",
  SP: "Spring",
  SU: "Summer",
  FA: "Fall",
};

type ParsedTerm = { year: number; quarterIdx: number };

function parseDarsTerm(term: string): ParsedTerm | null {
  if (term.length !== 4) return null;
  const code = term.slice(0, 2);
  const yy = parseInt(term.slice(2), 10);
  const quarterIdx = (QUARTER_CODES as readonly string[]).indexOf(code);
  if (quarterIdx < 0 || Number.isNaN(yy)) return null;
  return { year: 2000 + yy, quarterIdx };
}

function termSortKey(term: string): number {
  const p = parseDarsTerm(term);
  return p ? p.year * 4 + p.quarterIdx : 0;
}

export function termLabel(term: string): string {
  const p = parseDarsTerm(term);
  return p ? `${QUARTER_NAMES[QUARTER_CODES[p.quarterIdx]]} ${p.year}` : term;
}

// --- per-term timeline ---

export type TermSummary = {
  term: string;
  label: string;
  units: number;
  courseCount: number;
  gpa: number | null;
  bands: GradeBandCount[];
};

// Group courses by term and summarize each (units, GPA, band counts).
// Returns chronological order, oldest first.
export function summarizeByTerm(courses: Course[]): TermSummary[] {
  const byTerm = new Map<string, Course[]>();
  for (const c of courses) {
    const list = byTerm.get(c.term);
    if (list) list.push(c);
    else byTerm.set(c.term, [c]);
  }
  const summaries: TermSummary[] = [];
  for (const [term, list] of byTerm) {
    summaries.push({
      term,
      label: termLabel(term),
      units: totalUnits(list),
      courseCount: list.length,
      gpa: cumulativeGpa(list),
      bands: gradeBandCounts(list),
    });
  }
  summaries.sort((a, b) => termSortKey(a.term) - termSortKey(b.term));
  return summaries;
}

// --- pace forecast ---

export type PaceForecast = {
  avgUnitsPerQuarter: number;
  unitsRemaining: number;
  quartersRemaining: number;
};

// Project how many quarters until graduation, given the student's average
// units per past quarter and how many units they still need. Returns null
// when there's no completed history to average over.
export function paceForecast(
  parsed: Parsed,
  unitsToGraduate: number = UNITS_TO_GRADUATE,
): PaceForecast | null {
  const past = summarizeByTerm(parsed.completed);
  if (past.length === 0) return null;
  const avg = past.reduce((sum, t) => sum + t.units, 0) / past.length;
  if (avg <= 0) return null;
  const done = totalUnits(parsed.completed) + totalUnits(parsed.in_progress);
  const remaining = Math.max(0, unitsToGraduate - done);
  return {
    avgUnitsPerQuarter: avg,
    unitsRemaining: remaining,
    quartersRemaining: remaining === 0 ? 0 : Math.ceil(remaining / avg),
  };
}

// --- course-code splitting ---

// DARS course codes are space-separated "DEPT NUMBER", where DEPT may contain
// multiple words ("COM SCI", "AN N EA", "C&EE"). NUMBER is always the last
// whitespace-separated token. Returns null on malformed input.
export function splitCourseCode(
  code: string,
): { dept: string; number: string } | null {
  const i = code.lastIndexOf(" ");
  if (i <= 0 || i >= code.length - 1) return null;
  return { dept: code.slice(0, i), number: code.slice(i + 1) };
}
