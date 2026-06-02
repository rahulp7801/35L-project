"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "../ui/Card";
import { TextField } from "../ui/TextField";
import { CourseLink } from "../ui/CourseLink";
import { GradeBars } from "./GradeBars";
import {
  searchInstructors,
  fetchInstructor,
  formatGpa,
  gpaColor,
  titleCaseName,
  type InstructorHit,
  type InstructorDetail,
} from "../../lib/grades";

// Search an instructor by name and view every course they've taught,
// ranked by the GPA they personally gave out in that course.
//
// Mirrors CourseGradesCard's debounced-autocomplete shell so the two cards
// look and feel the same; the two were kept as separate components rather
// than parameterizing one shell, to keep the per-result row markup readable.
export function InstructorGradesCard() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<InstructorHit[]>([]);
  const [open, setOpen] = useState(false);
  const [instructor, setInstructor] = useState<InstructorDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced autocomplete: wait 200ms after typing stops, then query.
  useEffect(() => {
    const q = query.trim();
    const t = setTimeout(async () => {
      if (q.length < 2) {
        setHits([]);
        setOpen(false);
        return;
      }
      const results = await searchInstructors(q);
      setHits(results);
      setOpen(true);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  // Close the dropdown when the user clicks anywhere outside the card.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  async function select(hit: InstructorHit) {
    setOpen(false);
    setQuery(titleCaseName(hit.instructor));
    setLoading(true);
    setError("");
    try {
      const result = await fetchInstructor(hit.instructor);
      if (!result) {
        setInstructor(null);
        setError("No grade data for that instructor.");
      } else {
        setInstructor(result);
      }
    } catch (e) {
      setInstructor(null);
      setError(e instanceof Error ? e.message : "lookup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <div className="mb-[0.85rem] flex items-baseline justify-between border-b border-border pb-[0.6rem]">
        <h2 className="m-0 text-base font-semibold">Professor grades</h2>
        <span className="text-[0.8rem] text-muted">Historical GPA: 2021-2025</span>
      </div>

      <div ref={boxRef} className="relative">
        <TextField
          placeholder="Search a professor, e.g. Smallberg or Eggert"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
        />
        {open && hits.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-72 w-full list-none overflow-auto rounded-md border border-border bg-card p-1 shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
            {hits.map((h) => (
              <li key={h.instructor}>
                <button
                  type="button"
                  onClick={() => select(h)}
                  className="flex w-full items-center gap-2 rounded px-2 py-[0.45rem] text-left text-[0.85rem] hover:bg-accent-soft"
                >
                  <span className="truncate font-medium">
                    {titleCaseName(h.instructor)}
                  </span>
                  <span className="ml-auto shrink-0 text-muted">
                    {h.course_count} course{h.course_count === 1 ? "" : "s"}
                  </span>
                  <span
                    className="w-12 shrink-0 text-right font-semibold tabular-nums"
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
      {instructor && !loading && <InstructorDetailView detail={instructor} />}
      {!instructor && !loading && !error && (
        <p className="m-0 mt-4 text-[0.9rem] text-muted">
          Search any UCLA instructor to see every course they&apos;ve taught and
          how the GPAs they award compare.
        </p>
      )}
    </Card>
  );
}

const COURSE_PREVIEW = 6;

// Detail view shown after the user picks an instructor: career GPA headline,
// A/B/C/D/F bars, then a list of courses they taught with personal GPA.
function InstructorDetailView({ detail }: { detail: InstructorDetail }) {
  const [showAll, setShowAll] = useState(false);
  const { instructor, overall, courses } = detail;
  const visible = showAll ? courses : courses.slice(0, COURSE_PREVIEW);
  const hidden = courses.length - visible.length;

  return (
    <div className="mt-4 grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[0.78rem] font-medium uppercase tracking-wide text-muted">
            Professor
          </div>
          <div className="text-[1.05rem] font-semibold leading-tight">
            {titleCaseName(instructor)}
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
            career avg · {overall.graded.toLocaleString()} graded
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

      <div>
        <div className="mb-[0.4rem] text-[0.75rem] font-medium uppercase tracking-wide text-muted">
          Courses taught · {courses.length}
        </div>
        <div className="grid gap-[0.3rem]">
          {visible.map((c) => (
            <div
              key={`${c.dept}-${c.number}`}
              className="flex items-center gap-2 text-[0.84rem]"
            >
              <CourseLink
                dept={c.dept}
                number={c.number}
                className="shrink-0 font-mono font-semibold"
              />
              <span className="truncate text-muted">{c.title}</span>
              <span
                className="ml-auto shrink-0 font-semibold tabular-nums"
                style={{ color: gpaColor(c.avg_gpa) }}
              >
                {formatGpa(c.avg_gpa)}
              </span>
              <span className="w-12 shrink-0 text-right text-muted tabular-nums">
                {c.graded.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="mt-[0.45rem] border-none bg-transparent p-0 text-[0.78rem] font-medium text-accent"
          >
            Show {hidden} more course{hidden === 1 ? "" : "s"}
          </button>
        )}
      </div>
    </div>
  );
}
