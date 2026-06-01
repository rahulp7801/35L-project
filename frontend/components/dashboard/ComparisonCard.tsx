"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "../ui/Card";
import { CourseLink } from "../ui/CourseLink";
import { formatGpa, gpaColor, fetchGradesBatch } from "../../lib/grades";
import { GPA_POINTS, splitCourseCode } from "../../lib/stats";
import type { Course } from "../../lib/types";
import type { CourseOverview } from "../../lib/grades";

// Compares each of the user's letter-graded courses to the historical
// UCLA average for that course. Surfaces:
//   - "above-average in X of Y" headline
//   - top 3 strongest performances (largest positive delta)
//   - top 3 hardest performances (largest negative delta)
//
// Uses POST /grades/batch so the entire transcript resolves in one round
// trip, and only re-fetches when the set of (dept,number) pairs changes.

type Row = {
  code: string;
  title: string;
  studentGrade: string;
  studentPoints: number;
  avgGpa: number;
  delta: number; // student_points - avg_gpa
};

const TOP_N = 3;

export function ComparisonCard({ completed }: { completed: Course[] }) {
  // Dept + number pairs we have any hope of comparing: letter-graded only,
  // deduped, and parseable. Recomputed only when `completed` changes
  // identity (Firestore snapshot replaces it).
  const lookups = useMemo(() => {
    const seen = new Set<string>();
    const out: { dept: string; number: string; code: string; grade: string }[] = [];
    for (const c of completed) {
      if (GPA_POINTS[c.grade] === undefined) continue;
      const split = splitCourseCode(c.code);
      if (!split) continue;
      const key = `${split.dept}|${split.number}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...split, code: c.code, grade: c.grade });
    }
    return out;
  }, [completed]);

  const [overviews, setOverviews] = useState<CourseOverview[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (lookups.length === 0) {
      setOverviews([]);
      return;
    }
    let alive = true;
    setLoading(true);
    setError("");
    fetchGradesBatch(lookups.map(({ dept, number }) => ({ dept, number })))
      .then((data) => alive && setOverviews(data))
      .catch((e) =>
        alive && setError(e instanceof Error ? e.message : "lookup failed"),
      )
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [lookups]);

  const rows = useMemo<Row[]>(() => {
    if (!overviews) return [];
    const out: Row[] = [];
    for (let i = 0; i < lookups.length; i++) {
      const lookup = lookups[i];
      const overview = overviews[i];
      if (!overview || overview.avg_gpa === null) continue;
      const studentPoints = GPA_POINTS[lookup.grade];
      if (studentPoints === undefined) continue;
      out.push({
        code: lookup.code,
        title: overview.title,
        studentGrade: lookup.grade,
        studentPoints,
        avgGpa: overview.avg_gpa,
        delta: studentPoints - overview.avg_gpa,
      });
    }
    return out;
  }, [lookups, overviews]);

  const noData = lookups.length - rows.length;
  const aboveAvg = rows.filter((r) => r.delta >= 0).length;

  return (
    <Card>
      <div className="mb-[0.85rem] flex items-baseline justify-between border-b border-border pb-[0.6rem]">
        <h2 className="m-0 text-base font-semibold">How you compare</h2>
        <span className="text-[0.8rem] text-muted">vs UCLA averages</span>
      </div>

      {loading && <ComparisonSkeleton />}

      {error && !loading && (
        <p className="m-0 text-[0.9rem] text-error">{error}</p>
      )}

      {!loading && !error && lookups.length === 0 && (
        <p className="m-0 text-[0.9rem] text-muted">
          No letter-graded courses to compare yet.
        </p>
      )}

      {!loading && !error && lookups.length > 0 && (
        <>
          <p className="m-0 text-[0.95rem]">
            Above average in{" "}
            <strong className="text-success">{aboveAvg}</strong> of{" "}
            <strong>{rows.length}</strong> graded course
            {rows.length === 1 ? "" : "s"}
            {noData > 0 && (
              <span className="text-muted">
                {" "}
                · {noData} with no grade data
              </span>
            )}
            .
          </p>

          {rows.length > 0 && (
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <RowList
                heading="Strongest"
                hint="biggest gap above class avg"
                rows={[...rows].sort((a, b) => b.delta - a.delta).slice(0, TOP_N)}
              />
              <RowList
                heading="Hardest"
                hint="biggest gap below class avg"
                rows={[...rows].sort((a, b) => a.delta - b.delta).slice(0, TOP_N)}
              />
            </div>
          )}
        </>
      )}
    </Card>
  );
}

// Two-column skeleton matching the real layout so the card doesn't jump when
// the batch fetch resolves.
function ComparisonSkeleton() {
  return (
    <div>
      <div className="h-4 w-2/3 animate-pulse rounded bg-border" />
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        {[0, 1].map((col) => (
          <div key={col}>
            <div className="mb-2 h-3 w-24 animate-pulse rounded bg-border" />
            <div className="grid gap-[0.3rem]">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-5 animate-pulse rounded bg-border" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RowList({
  heading,
  hint,
  rows,
}: {
  heading: string;
  hint: string;
  rows: Row[];
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <div className="mb-[0.4rem] flex items-baseline justify-between">
        <span className="text-[0.75rem] font-medium uppercase tracking-wide text-muted">
          {heading}
        </span>
        <span className="text-[0.7rem] text-muted">{hint}</span>
      </div>
      <ul className="m-0 grid list-none gap-[0.3rem] p-0">
        {rows.map((r) => (
          <li
            key={r.code}
            className="flex min-w-0 items-center gap-[0.45rem] text-[0.84rem]"
          >
            <CourseLink code={r.code} className="shrink-0 font-mono font-semibold" />
            <span className="min-w-0 flex-1 truncate text-muted">{r.title}</span>
            <span
              className="shrink-0 font-semibold tabular-nums"
              title={`your grade · class avg ${formatGpa(r.avgGpa)}`}
            >
              {r.studentGrade}
            </span>
            <span
              className="w-11 shrink-0 text-right text-[0.8rem] font-semibold tabular-nums"
              style={{ color: r.delta >= 0 ? "var(--success)" : "var(--error)" }}
            >
              {r.delta >= 0 ? "+" : ""}
              {r.delta.toFixed(2)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
