"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "../ui/Card";
import { TextField } from "../ui/TextField";
import { GradeBars } from "./GradeBars";
import {
  searchInstructors,
  fetchInstructor,
  gradeBuckets,
  formatGpa,
  gpaColor,
  titleCaseName,
  type InstructorHit,
  type InstructorDetail,
} from "../../lib/grades";

// pick 2-4 professors and see their A% and full grade distribution side-by-side.

const MAX_PROFS = 4;

export function CompareProfessorsCard() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<InstructorHit[]>([]);
  const [open, setOpen] = useState(false);
  const [profs, setProfs] = useState<InstructorDetail[]>([]);
  const [loadingName, setLoadingName] = useState<string | null>(null);
  const [error, setError] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  async function add(hit: InstructorHit) {
    setOpen(false);
    setQuery("");
    setError("");
    if (profs.some((p) => p.instructor === hit.instructor)) return;
    if (profs.length >= MAX_PROFS) {
      setError(`Compare up to ${MAX_PROFS} professors at a time.`);
      return;
    }
    setLoadingName(hit.instructor);
    try {
      const detail = await fetchInstructor(hit.instructor);
      if (!detail) setError("No grade data for that instructor.");
      else setProfs((prev) => [...prev, detail]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "lookup failed");
    } finally {
      setLoadingName(null);
    }
  }

  function remove(name: string) {
    setProfs((prev) => prev.filter((p) => p.instructor !== name));
    setError("");
  }

  // Pick the column count from how many profs are selected so two profs lay
  // out side-by-side, three or four wrap to two rows on wide screens.
  const cols =
    profs.length >= 3 ? "lg:grid-cols-3" :
    profs.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-1";

  return (
    <Card>
      <div className="mb-[0.85rem] flex items-baseline justify-between border-b border-border pb-[0.6rem]">
        <h2 className="m-0 text-base font-semibold">Compare professors</h2>
        <span className="text-[0.8rem] text-muted">
          {profs.length}/{MAX_PROFS} selected
        </span>
      </div>

      <div ref={boxRef} className="relative">
        <TextField
          placeholder="Add a professor, e.g. Smallberg or Eggert"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
          disabled={profs.length >= MAX_PROFS}
        />
        {open && hits.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-72 w-full list-none overflow-auto rounded-md border border-border bg-card p-1 shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
            {hits.map((h) => {
              const already = profs.some((p) => p.instructor === h.instructor);
              return (
                <li key={h.instructor}>
                  <button
                    type="button"
                    onClick={() => !already && add(h)}
                    disabled={already}
                    className="flex w-full items-center gap-2 rounded px-2 py-[0.45rem] text-left text-[0.85rem] hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
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
                    {already && (
                      <span className="shrink-0 text-[0.7rem] text-muted">added</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {loadingName && (
        <p className="m-0 mt-3 text-[0.85rem] text-muted">
          Loading {titleCaseName(loadingName)}…
        </p>
      )}
      {error && (
        <p className="m-0 mt-3 text-[0.85rem] text-error">{error}</p>
      )}

      {profs.length === 0 ? (
        <p className="m-0 mt-4 text-[0.9rem] text-muted">
          Add two or more professors above to see their A% and grade
          distributions side-by-side.
        </p>
      ) : (
        <div className={`mt-4 grid gap-4 sm:grid-cols-2 ${cols}`}>
          {profs.map((p) => (
            <ProfessorCompareCell key={p.instructor} detail={p} onRemove={remove} />
          ))}
        </div>
      )}
    </Card>
  );
}

function ProfessorCompareCell({
  detail,
  onRemove,
}: {
  detail: InstructorDetail;
  onRemove: (name: string) => void;
}) {
  const { instructor, overall, course_count } = detail;
  const aPct = gradeBuckets(overall).find((b) => b.label === "A")?.pct ?? 0;

  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[0.7rem] font-medium uppercase tracking-wide text-muted">
            Professor
          </div>
          <div className="truncate text-[0.95rem] font-semibold leading-tight">
            {titleCaseName(instructor)}
          </div>
          <div className="mt-0.5 text-[0.72rem] text-muted">
            {course_count} course{course_count === 1 ? "" : "s"} · {overall.graded.toLocaleString()} graded
          </div>
        </div>
        <button
          type="button"
          onClick={() => onRemove(instructor)}
          aria-label={`Remove ${titleCaseName(instructor)}`}
          className="shrink-0 rounded border border-border bg-transparent px-2 py-[0.15rem] text-[0.72rem] text-muted hover:text-text"
        >
          remove
        </button>
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <div>
          <div
            className="text-2xl font-bold leading-none tabular-nums"
            style={{ color: gpaColor(overall.avg_gpa) }}
          >
            {formatGpa(overall.avg_gpa)}
          </div>
          <div className="mt-1 text-[0.7rem] text-muted">career avg GPA</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold leading-none tabular-nums text-success">
            {aPct.toFixed(0)}%
          </div>
          <div className="mt-1 text-[0.7rem] text-muted">A grades</div>
        </div>
      </div>

      <div className="mt-3">
        <GradeBars stats={overall} />
      </div>
    </div>
  );
}
