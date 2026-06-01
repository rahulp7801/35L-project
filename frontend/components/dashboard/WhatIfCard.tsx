"use client";

import { useMemo, useState } from "react";
import { Card } from "../ui/Card";
import { CourseLink } from "../ui/CourseLink";
import { formatGpa, gpaColor } from "../../lib/grades";
import { cumulativeGpa, GPA_POINTS } from "../../lib/stats";
import type { Course } from "../../lib/types";

// Grades the user can pick from. Order matches the dropdown — A+ at the top
// since that's the optimistic default.
const LETTER_GRADES = Object.keys(GPA_POINTS);

// Inline "what if?" calculator. Each row is one in-progress course; the user
// picks the grade they expect, and the projected cumulative GPA updates live.
// Pure client-side derivation off the same `cumulativeGpa()` the dashboard
// already uses — no new state to keep in sync with the parsed payload.
export function WhatIfCard({
  completed,
  inProgress,
}: {
  completed: Course[];
  inProgress: Course[];
}) {
  // Default every in-progress course to an A (optimistic). Keyed by term+code
  // so two re-takes of the same course in different quarters don't collide.
  const [picks, setPicks] = useState<Record<string, string>>(() =>
    Object.fromEntries(inProgress.map((c) => [keyFor(c), "A"])),
  );

  const projected = useMemo(() => {
    const hypothetical: Course[] = inProgress.map((c) => ({
      ...c,
      grade: picks[keyFor(c)] ?? "A",
    }));
    return cumulativeGpa([...completed, ...hypothetical]);
  }, [completed, inProgress, picks]);

  const current = useMemo(() => cumulativeGpa(completed), [completed]);
  const delta = projected !== null && current !== null ? projected - current : 0;

  if (inProgress.length === 0) return null;

  return (
    <Card>
      <header className="mb-[0.85rem] flex items-baseline justify-between border-b border-border pb-[0.6rem]">
        <h2 className="m-0 text-base font-semibold">What if?</h2>
        <span className="text-[0.8rem] text-muted">project your in-progress grades</span>
      </header>

      <div className="mb-3 flex items-end justify-between gap-3">
        <p className="m-0 max-w-md text-[0.85rem] text-muted">
          Try out the grades you&apos;re aiming for this quarter. Your projected
          cumulative GPA updates as you change them.
        </p>
        <div className="text-right">
          <div
            className="text-2xl font-semibold leading-none tabular-nums"
            style={{ color: gpaColor(projected) }}
          >
            {formatGpa(projected)}
          </div>
          <div className="mt-1 text-[0.72rem] text-muted">
            projected ·{" "}
            <span style={{ color: deltaColor(delta) }}>
              {delta >= 0 ? "+" : ""}
              {delta.toFixed(2)}
            </span>{" "}
            vs current
          </div>
        </div>
      </div>

      <ul className="m-0 grid list-none gap-[0.4rem] p-0">
        {inProgress.map((c) => {
          const k = keyFor(c);
          const grade = picks[k] ?? "A";
          return (
            <li
              key={k}
              className="flex items-center gap-2 rounded-md border border-border bg-bg px-3 py-[0.55rem] text-[0.88rem]"
            >
              <span className="shrink-0 text-[0.78rem] text-muted">{c.term}</span>
              <CourseLink code={c.code} className="shrink-0 font-mono font-semibold" />
              <span className="min-w-0 flex-1 truncate text-muted">{c.title}</span>
              <select
                value={grade}
                onChange={(e) => setPicks((p) => ({ ...p, [k]: e.target.value }))}
                aria-label={`Projected grade for ${c.code}`}
                className="shrink-0 rounded-md border border-border bg-card px-2 py-1 text-[0.85rem] font-semibold tabular-nums"
                style={{ color: gpaColor(GPA_POINTS[grade] ?? null) }}
              >
                {LETTER_GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function keyFor(c: Course): string {
  return `${c.term}-${c.code}`;
}

function deltaColor(delta: number): string {
  if (Math.abs(delta) < 0.005) return "var(--muted)";
  return delta > 0 ? "var(--success)" : "var(--error)";
}
