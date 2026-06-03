// Client helpers for the backend grade + recommendation API.
// Talks to GET /grades, GET /grades/search, GET /grades/browse,
// GET /grades/departments, GET /instructors/search, GET /instructors,
// and POST /recommend; shapes mirror backend/grades.py.

import {
  GRADES_BATCH_ENDPOINT,
  GRADES_BROWSE_ENDPOINT,
  GRADES_DEPARTMENTS_ENDPOINT,
  GRADES_ENDPOINT,
  GRADES_SEARCH_ENDPOINT,
  INSTRUCTOR_ENDPOINT,
  INSTRUCTORS_SEARCH_ENDPOINT,
  RECOMMEND_ENDPOINT,
} from "./constants";
import type { EligibleGroup } from "./eligible";

export type GradeStats = {
  avg_gpa: number | null;
  total: number;
  graded: number;
  distribution: Record<string, number>;
};

export type InstructorStats = GradeStats & { instructor: string };
export type TermStats = GradeStats & { term: string; label: string };

export type CourseGrades = {
  dept: string;
  number: string;
  title: string;
  overall: GradeStats;
  by_instructor: InstructorStats[];
  by_term: TermStats[];
};

export type CourseHit = {
  dept: string;
  number: string;
  title: string;
  avg_gpa: number | null;
  total: number;
};

export async function searchCourses(query: string, limit = 8): Promise<CourseHit[]> {
  const url = `${GRADES_SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchCourseGrades(
  dept: string,
  number: string
): Promise<CourseGrades | null> {
  const url = `${GRADES_ENDPOINT}?dept=${encodeURIComponent(dept)}&number=${encodeURIComponent(number)}`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`grade lookup failed (HTTP ${res.status})`);
  return res.json();
}

// Lightweight per-course stats: same fields as a BrowseHit but always
// returned (avg_gpa=null when we have no data for that course) so the caller
// gets a 1:1 row for every requested course.
export type CourseOverview = {
  dept: string;
  number: string;
  title: string;
  avg_gpa: number | null;
  graded: number;
  total: number;
};

// Look up many courses in one round trip. Used by dashboard widgets that need
// historical averages for the entire transcript at once.
export async function fetchGradesBatch(
  courses: { dept: string; number: string }[]
): Promise<CourseOverview[]> {
  if (courses.length === 0) return [];
  const res = await fetch(GRADES_BATCH_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ courses }),
  });
  if (!res.ok) throw new Error(`batch lookup failed (HTTP ${res.status})`);
  return res.json();
}

// How a course's upcoming-term instructor compares to the course's overall historical baseline.
export type CourseTiming = {
  instructor: string;
  term: string; // SOC term code, e.g. "26F"
  term_label: string; // e.g. "Fall 2026"
  instructor_avg_gpa: number;
  instructor_graded: number;
  baseline_avg_gpa: number;
  delta: number;
  favorable: boolean;
};

// One ranked course in a requirement's recommendations.
export type Recommendation = {
  dept: string;
  number: string;
  title: string;
  avg_gpa: number | null;
  graded: number;
  total: number;
  // null when the course isn't offered next term or its instructor has no grade history.
  timing: CourseTiming | null;
};

export type RecommendResult = {
  total_with_data: number;
  courses: Recommendation[];
  term?: string; // the upcoming term timing was resolved against
};

// Rank a requirement's eligible courses by historical average GPA.
export async function fetchRecommendations(
  groups: EligibleGroup[],
  limit = 5
): Promise<RecommendResult> {
  const res = await fetch(RECOMMEND_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groups, limit }),
  });
  if (!res.ok) throw new Error(`recommend failed (HTTP ${res.status})`);
  return res.json();
}

// --- instructor search ---

// One row in the instructor-search autocomplete dropdown.
export type InstructorHit = {
  instructor: string;
  course_count: number;
  avg_gpa: number | null;
  graded: number;
  total: number;
};

// One course taught by an instructor, including their personal distribution.
export type InstructorCourse = GradeStats & {
  dept: string;
  number: string;
  title: string;
};

// Full instructor profile: every course they've taught + a career aggregate.
export type InstructorDetail = {
  instructor: string;
  course_count: number;
  overall: GradeStats;
  courses: InstructorCourse[];
};

export async function searchInstructors(
  query: string,
  limit = 8
): Promise<InstructorHit[]> {
  const url = `${INSTRUCTORS_SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchInstructor(
  name: string
): Promise<InstructorDetail | null> {
  const url = `${INSTRUCTOR_ENDPOINT}?name=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`instructor lookup failed (HTTP ${res.status})`);
  return res.json();
}

// --- filtered course browse ---

export type BrowseLevel = "lower" | "upper" | "graduate";

export type BrowseFilters = {
  dept?: string;
  min_gpa?: number;
  level?: BrowseLevel;
  limit?: number;
};

export type BrowseHit = {
  dept: string;
  number: string;
  title: string;
  avg_gpa: number | null;
  graded: number;
  total: number;
};

// Compact-form filtered list of courses ranked by historical avg GPA.
export async function browseCourses(filters: BrowseFilters): Promise<BrowseHit[]> {
  const params = new URLSearchParams();
  if (filters.dept) params.set("dept", filters.dept);
  if (filters.min_gpa !== undefined) params.set("min_gpa", String(filters.min_gpa));
  if (filters.level) params.set("level", filters.level);
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  const res = await fetch(`${GRADES_BROWSE_ENDPOINT}?${params}`);
  if (!res.ok) throw new Error(`browse failed (HTTP ${res.status})`);
  return res.json();
}

// Department codes for the browse-card dropdown. Cached at module level since
// the list is fixed at server startup; no point refetching across cards.
let _deptCache: Promise<string[]> | null = null;
export function fetchDepartments(): Promise<string[]> {
  if (!_deptCache) {
    _deptCache = fetch(GRADES_DEPARTMENTS_ENDPOINT)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
  }
  return _deptCache;
}

// --- presentation helpers ---

export type GradeBucket = { label: string; count: number; pct: number; color: string };

// Group the fine-grained grades into A/B/C/D/F bands for a readable chart.
const BUCKETS: { label: string; grades: string[]; color: string }[] = [
  { label: "A", grades: ["A+", "A", "A-"], color: "#16a34a" },
  { label: "B", grades: ["B+", "B", "B-"], color: "#84cc16" },
  { label: "C", grades: ["C+", "C", "C-"], color: "#eab308" },
  { label: "D", grades: ["D+", "D", "D-"], color: "#f97316" },
  { label: "F", grades: ["F"], color: "#dc2626" },
];

// Percentages are over letter-graded students (P/NP/I/etc. excluded), so the
// bands sum to 100% and read as "share of grades awarded".
export function gradeBuckets(stats: GradeStats): GradeBucket[] {
  const base = stats.graded || 1;
  return BUCKETS.map((b) => {
    const count = b.grades.reduce((sum, g) => sum + (stats.distribution[g] ?? 0), 0);
    return { label: b.label, count, pct: (count / base) * 100, color: b.color };
  });
}

export function formatGpa(gpa: number | null): string {
  return gpa === null ? "—" : gpa.toFixed(2);
}

// Tier color for an average GPA, reused for the headline number and instructors.
export function gpaColor(gpa: number | null): string {
  if (gpa === null) return "var(--muted)";
  if (gpa >= 3.7) return "#16a34a";
  if (gpa >= 3.3) return "#65a30d";
  if (gpa >= 3.0) return "#ca8a04";
  if (gpa >= 2.5) return "#ea580c";
  return "#dc2626";
}

// "SMALLBERG, DAVID A" -> "Smallberg, David A" for display.
export function titleCaseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase());
}
