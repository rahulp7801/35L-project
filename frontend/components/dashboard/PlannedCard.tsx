"use client";

import { useEffect, useState } from "react";
import { Card } from "../ui/Card";
import { CardHeader } from "../ui/CardHeader";
import { CourseLink } from "../ui/CourseLink";
import {
  fetchGradesBatch,
  formatGpa,
  gpaColor,
  type CourseOverview,
} from "../../lib/grades";
import { splitCourseCode } from "../../lib/stats";
import type { Course, PlannedCourse } from "../../lib/types";

// shows the user's plan, grouped by which requirement each course fulfills.
export function PlannedCard({
  planned,
  onRemove,
  knownUnits,
}: {
  planned: PlannedCourse[];
  onRemove: (entry: PlannedCourse) => Promise<void> | void;
  knownUnits?: Map<string, number>;
}) {
  const [gpas, setGpas] = useState<Map<string, CourseOverview>>(new Map());

  // grab gpas for everything in the plan in one request
  useEffect(() => {
    if (planned.length === 0) {
      setGpas(new Map());
      return;
    }
    const courses = [];
    for (const p of planned) {
      const split = splitCourseCode(p.code);
      if (split) courses.push(split);
    }
    if (courses.length === 0) return;

    let alive = true;
    fetchGradesBatch(courses)
      .then((rows) => {
        if (!alive) return;
        const next = new Map<string, CourseOverview>();
        for (const r of rows) next.set(`${r.dept} ${r.number}`, r);
        setGpas(next);
      })
      .catch(() => {
        if (alive) setGpas(new Map());
      });
    return () => {
      alive = false;
    };
  }, [planned]);

  // group courses by section so each requirement gets its own block
  const bySection = new Map<string, string[]>();
  for (const p of planned) {
    const codes = bySection.get(p.section);
    if (codes) {
      codes.push(p.code);
    } else {
      bySection.set(p.section, [p.code]);
    }
  }

  return (
    <Card>
      <CardHeader title="My plan" count={planned.length} accent="var(--planned)" />
      <ul className="m-0 grid list-none gap-[0.85rem] p-0">
        {Array.from(bySection.entries()).map(([section, codes]) => (
          <li
            key={section}
            className="rounded-lg border border-border bg-[var(--planned-soft)] px-[0.85rem] py-3"
          >
            <p className="m-0 text-[0.7rem] font-medium uppercase tracking-wide text-muted">
              Fulfills
            </p>
            <p className="m-0 text-[0.82rem] font-semibold">{section}</p>
            <ul className="m-0 mt-[0.4rem] grid list-none gap-[0.3rem] p-0">
              {codes.map((code) => {
                const row = gpas.get(code);
                let gpa: number | null = null;
                if (row) gpa = row.avg_gpa;
                let units: number | null = null;
                if (knownUnits && knownUnits.has(code)) {
                  units = knownUnits.get(code) as number;
                }
                return (
                  <PlannedRow
                    key={code}
                    code={code}
                    section={section}
                    gpa={gpa}
                    units={units}
                    onRemove={onRemove}
                  />
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PlannedRow({
  code,
  section,
  gpa,
  units,
  onRemove,
}: {
  code: string;
  section: string;
  gpa: number | null;
  units: number | null;
  onRemove: (entry: PlannedCourse) => Promise<void> | void;
}) {
  async function handleRemove() {
    await onRemove({ code, section });
  }

  // when there's no gpa, push the remove button to the right edge instead
  let removeClass =
    "shrink-0 rounded-md border border-border bg-card px-2 py-[0.15rem] text-[0.72rem] text-muted hover:text-error";
  if (gpa === null) removeClass = "ml-auto " + removeClass;

  return (
    <li className="flex items-center gap-2 text-[0.85rem]">
      <CourseLink code={code} className="font-mono font-semibold" />
      {units !== null && (
        <span className="shrink-0 text-[0.75rem] text-muted">{units} units</span>
      )}
      {gpa !== null && (
        <span
          className="ml-auto shrink-0 font-semibold tabular-nums"
          style={{ color: gpaColor(gpa) }}
          title="historical avg gpa"
        >
          {formatGpa(gpa)}
        </span>
      )}
      <button
        type="button"
        onClick={handleRemove}
        aria-label={`Remove ${code} from plan`}
        className={removeClass}
      >
        Remove
      </button>
    </li>
  );
}

// build a code -> units lookup from the user's transcript so we can show
// units for any planned course they've already taken or are currently in.
export function buildKnownUnits(
  completed: Course[],
  inProgress: Course[]
): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of completed) {
    if (c.code) out.set(c.code, c.units);
  }
  for (const c of inProgress) {
    if (c.code) out.set(c.code, c.units);
  }
  return out;
}
