"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "../ui/Card";
import { TextField } from "../ui/TextField";
import { GradeBars } from "./GradeBars";
import {
  searchCourses,
  fetchCourseGrades,
  gradeBuckets,
  formatGpa,
  gpaColor,
  titleCaseName,
  type CourseHit,
  type CourseGrades,
  type InstructorStats,
} from "../../lib/grades";

// search a course and view its historical grade distribution.
export function CourseGradesCard() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CourseHit[]>([]);
  const [open, setOpen] = useState(false);
  const [course, setCourse] = useState<CourseGrades | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced autocomplete.
  useEffect(() => {
    const q = query.trim();
    const t = setTimeout(async () => {
      if (q.length < 2) {
        setHits([]);
        setOpen(false);
        return;
      }
      const results = await searchCourses(q);
      setHits(results);
      setOpen(true);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  // Close the dropdown on an outside click.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  async function select(hit: CourseHit) {
    setOpen(false);
    setQuery(`${hit.dept} ${hit.number}`);
    setLoading(true);
    setError("");
    try {
      const result = await fetchCourseGrades(hit.dept, hit.number);
      if (!result) {
        setCourse(null);
        setError("No grade data for that course.");
      } else {
        setCourse(result);
      }
    } catch (e) {
      setCourse(null);
      setError(e instanceof Error ? e.message : "lookup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <div className="mb-[0.85rem] flex items-baseline justify-between border-b border-border pb-[0.6rem]">
        <h2 className="m-0 text-base font-semibold">Course grades</h2>
        <span className="text-[0.8rem] text-muted">Historical GPA: 2021-2025</span>
      </div>

      <div ref={boxRef} className="relative">
        <TextField
          placeholder="Search a course, e.g. COM SCI 31 or Algorithms"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
        />
        {open && hits.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-72 w-full list-none overflow-auto rounded-md border border-border bg-card p-1 shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
            {hits.map((h) => (
              <li key={`${h.dept}-${h.number}`}>
                <button
                  type="button"
                  onClick={() => select(h)}
                  className="flex w-full items-center gap-2 rounded px-2 py-[0.45rem] text-left text-[0.85rem] hover:bg-accent-soft"
                >
                  <span className="shrink-0 font-mono font-semibold">
                    {h.dept} {h.number}
                  </span>
                  <span className="truncate text-muted">{h.title}</span>
                  <span
                    className="ml-auto shrink-0 font-semibold tabular-nums"
                    style={{ color: gpaColor(h.avg_gpa) }}
                  >
                    {formatGpa(h.avg_gpa)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {loading && <p className="m-0 mt-4 text-[0.9rem] text-muted">Loading…</p>}
      {error && !loading && (
        <p className="m-0 mt-4 text-[0.9rem] text-error">{error}</p>
      )}
      {course && !loading && <CourseDetail course={course} />}
      {!course && !loading && !error && (
        <p className="m-0 mt-4 text-[0.9rem] text-muted">
          Search any UCLA course to see its grade distribution, average GPA, and
          how each professor compares.
        </p>
      )}
    </Card>
  );
}

const INSTRUCTOR_PREVIEW = 5;

// One professor row: an A-percentage bar, average GPA, and enrollment, expandable to that professor's full grade distribution so professors can be compared.
function ProfessorRow({ ins }: { ins: InstructorStats }) {
  const [open, setOpen] = useState(false);
  const aPct = gradeBuckets(ins).find((b) => b.label === "A")?.pct ?? 0;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 text-left text-[0.84rem]"
      >
        <span className="truncate">{titleCaseName(ins.instructor)}</span>
        <span className="ml-auto flex shrink-0 items-center gap-2.5">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-10 overflow-hidden rounded-full bg-border">
              <span
                className="block h-full rounded-full bg-success"
                style={{ width: `${aPct}%` }}
              />
            </span>
            <span className="w-11 text-right text-muted tabular-nums">
              {aPct.toFixed(0)}% A
            </span>
          </span>
          <span
            className="w-9 text-right font-semibold tabular-nums"
            style={{ color: gpaColor(ins.avg_gpa) }}
          >
            {formatGpa(ins.avg_gpa)}
          </span>
          <span className="w-12 text-right text-muted tabular-nums">
            {ins.graded.toLocaleString()}
          </span>
        </span>
      </button>
      {open && (
        <div className="mb-1 mt-2">
          <GradeBars stats={ins} />
        </div>
      )}
    </div>
  );
}

function CourseDetail({ course }: { course: CourseGrades }) {
  const [showAll, setShowAll] = useState(false);
  const { overall, by_instructor } = course;
  const visible = showAll ? by_instructor : by_instructor.slice(0, INSTRUCTOR_PREVIEW);
  const hidden = by_instructor.length - visible.length;

  return (
    <div className="mt-4 grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[0.85rem] font-semibold text-muted">
            {course.dept} {course.number}
          </div>
          <div className="text-[1.05rem] font-semibold leading-tight">
            {course.title}
          </div>
        </div>
        <div className="text-right">
          <div
            className="text-2xl font-bold leading-none tabular-nums"
            style={{ color: gpaColor(overall.avg_gpa) }}
          >
            {formatGpa(overall.avg_gpa)}
          </div>
          <div className="mt-1 text-[0.75rem] text-muted">
            avg GPA · {overall.graded.toLocaleString()} graded
          </div>
        </div>
      </div>

      <div>
        <GradeBars stats={overall} />
        {overall.total > overall.graded && (
          <p className="m-0 mt-2 text-[0.75rem] text-muted">
            + {(overall.total - overall.graded).toLocaleString()} non-letter marks
            (P/NP/I, not counted in GPA)
          </p>
        )}
      </div>

      {by_instructor.length > 0 && (
        <div>
          <div className="mb-[0.4rem] flex items-baseline justify-between">
            <span className="text-[0.75rem] font-medium uppercase tracking-wide text-muted">
              By professor · {by_instructor.length}
            </span>
            {by_instructor.length > 1 && (
              <span className="text-[0.7rem] text-muted">tap to compare</span>
            )}
          </div>
          <div className="grid gap-[0.3rem]">
            {visible.map((ins) => (
              <ProfessorRow key={ins.instructor} ins={ins} />
            ))}
          </div>
          {hidden > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-[0.45rem] border-none bg-transparent p-0 text-[0.78rem] font-medium text-accent"
            >
              Show {hidden} more professor{hidden === 1 ? "" : "s"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
