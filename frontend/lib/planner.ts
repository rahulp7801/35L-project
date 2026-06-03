// Client for the multi-quarter recommendation engine at POST /plan.
//
// The backend does the heavy lifting (scarcity ranking, first/second-pass
// packing). This module just shapes the request from parsed DARS data and
// types the response.

import { PLAN_ENDPOINT } from "./constants";
import { parseEligible } from "./eligible";
import { paceForecast, summarizeByTerm, UNITS_TO_GRADUATE } from "./stats";
import type { Parsed, Section } from "./types";

// --- response shape (mirrors backend/planner.py) ---

export type PlanInstructor = {
  instructor: string;
  avg_gpa: number;
  graded: number;
};

export type PlanCourse = {
  dept: string;
  number: string;
  title: string;
  avg_gpa: number | null;
  seasons: string[]; // "Fall" | "Winter" | "Spring" | "Summer"
  top_instructors: PlanInstructor[];
  requirement: string;
  pass: "first" | "second";
};

export type PlanQuarter = {
  index: number;
  year: number;
  season: string;
  term_code: string;
  label: string;
  first_pass_units: number;
  total_units: number;
  first_pass: PlanCourse[];
  second_pass: PlanCourse[];
};

export type PlanUnsatisfied = {
  title: string;
  still_needed: number;
};

export type PlanConfig = {
  pace_units: number;
  max_quarters: number;
  first_pass_cap: number;
  min_units: number;
  max_units: number;
  include_summer: boolean;
  typical_units: number;
  start_term: string;
};

export type PlanResponse = {
  quarters: PlanQuarter[];
  unsatisfied: PlanUnsatisfied[];
  config: PlanConfig;
};

// --- request shape ---

export type PlannerConfigInput = Partial<
  Omit<PlanConfig, "start_term">
>;

export type PlanRequest = {
  requirements: {
    title: string;
    needs: Record<string, number>;
    candidates: { dept: string; number: string }[];
  }[];
  excluded: { dept: string; number: string }[];
  start_term: string;
  config?: PlannerConfigInput;
};

export async function fetchPlan(req: PlanRequest): Promise<PlanResponse> {
  const res = await fetch(PLAN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    let detail = `plan failed (HTTP ${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json();
}

// --- bridging parsed DARS data into the planner input ---

// Split a "COM SCI 35L"-style course code (parsed.completed / in_progress) into
// dept + number. Mirrors lib/stats.splitCourseCode but inlined to avoid the
// optional-chain dance; we only call it on known-good rows.
function splitCode(code: string): { dept: string; number: string } | null {
  const i = code.lastIndexOf(" ");
  if (i <= 0 || i >= code.length - 1) return null;
  return { dept: code.slice(0, i), number: code.slice(i + 1) };
}

// Flatten parseEligible's dept-grouped output into flat (dept, number) pairs.
function eligibleToPairs(eligible: string): { dept: string; number: string }[] {
  const groups = parseEligible(eligible);
  const out: { dept: string; number: string }[] = [];
  for (const g of groups) {
    for (const n of g.numbers) {
      // Range syntax ("111–187") slips in occasionally; the planner ignores
      // it because no such (dept, "111-187") row exists in grade data.
      out.push({ dept: g.dept, number: n });
    }
  }
  return out;
}

// Turn the parsed DARS payload + config overrides into a planner request.
// Picks the start term as one quarter past the latest term we see on the
// transcript (completed or in-progress, whichever is more recent).
export function buildPlanRequest(
  parsed: Parsed,
  overrides: PlannerConfigInput = {},
): PlanRequest {
  const sections = parsed.sections ?? [];
  const unfulfilled = sections.filter((s) => s.status === "unfulfilled");
  const requirements = unfulfilled.flatMap((s) => sectionToRequirement(s));

  const excluded: { dept: string; number: string }[] = [];
  for (const c of parsed.completed) {
    const split = splitCode(c.code);
    if (split) excluded.push(split);
  }
  for (const c of parsed.in_progress) {
    const split = splitCode(c.code);
    if (split) excluded.push(split);
  }

  // Default pace from the user's history; fall back to 16u when they have no
  // term data yet (e.g. first quarter).
  const pace = paceForecast(parsed) ?? null;
  const paceUnits = pace?.avgUnitsPerQuarter ?? 16;

  return {
    requirements,
    excluded,
    start_term: nextTermAfterLatest(parsed),
    config: {
      pace_units: paceUnits,
      ...overrides,
    },
  };
}

// One outstanding DARS section can have multiple NEEDS lines; the planner
// treats each NEEDS line as its own requirement so a section saying "NEEDS 2
// COURSES" and "NEEDS 8 UNITS" produces two independent picks.
function sectionToRequirement(section: Section): PlanRequest["requirements"] {
  return section.needs.map((n) => ({
    title: section.title,
    needs: n.needs as unknown as Record<string, number>,
    candidates: n.eligible ? eligibleToPairs(n.eligible) : [],
  }));
}

// Find the latest term we have any course in (completed or in-progress) and
// return the *next* quarter after it as a DARS code. Fall back to FA + current
// year when there's no transcript history at all.
function nextTermAfterLatest(parsed: Parsed): string {
  const all = [...parsed.completed, ...parsed.in_progress];
  const summarized = summarizeByTerm(all);
  if (summarized.length === 0) {
    return `FA${new Date().getFullYear() % 100}`;
  }
  const latest = summarized[summarized.length - 1];
  return advanceDarsTerm(latest.term);
}

// Local term advancer: parses "FA23" / "WI24" / ... and returns the next
// quarter's DARS code. Summer is skipped by default (matches the planner's
// default config). Mirrors backend/planner.py:advance_term so the start term
// the client suggests is the same one the backend would compute.
function advanceDarsTerm(code: string): string {
  const codeMap: Record<string, string> = {
    WI: "Winter",
    SP: "Spring",
    SU: "Summer",
    FA: "Fall",
  };
  const seasonToCode: Record<string, string> = {
    Winter: "WI",
    Spring: "SP",
    Summer: "SU",
    Fall: "FA",
  };
  const season = codeMap[code.slice(0, 2)];
  const yy = parseInt(code.slice(2), 10);
  if (!season || Number.isNaN(yy)) return code;
  let nextYear = 2000 + yy;
  let nextSeason: string;
  if (season === "Fall") {
    nextSeason = "Winter";
    nextYear += 1;
  } else if (season === "Winter") {
    nextSeason = "Spring";
  } else if (season === "Spring") {
    nextSeason = "Fall"; // skip summer
  } else {
    // Summer
    nextSeason = "Fall";
  }
  return `${seasonToCode[nextSeason]}${nextYear % 100}`;
}

// Quick sanity check the caller can run before sending: returns a count of
// outstanding requirements and total candidate courses across them, used by
// the UI to show "8 requirements, 134 eligible courses" before fetching.
export function planRequestSummary(req: PlanRequest): {
  requirements: number;
  candidates: number;
} {
  return {
    requirements: req.requirements.length,
    candidates: req.requirements.reduce((sum, r) => sum + r.candidates.length, 0),
  };
}

export { UNITS_TO_GRADUATE };
