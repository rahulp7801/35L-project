// Client helpers for the backend grade-distribution API (User Story #3).
// Talks to GET /grades and GET /grades/search; shapes mirror backend/grades.py.

import { GRADES_ENDPOINT, GRADES_SEARCH_ENDPOINT } from "./constants";

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
