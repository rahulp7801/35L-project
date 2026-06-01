"use client";

import { useEffect, useState } from "react";
import { Card } from "../ui/Card";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import { CourseLink } from "../ui/CourseLink";
import {
  browseCourses,
  fetchDepartments,
  formatGpa,
  gpaColor,
  type BrowseFilters,
  type BrowseHit,
  type BrowseLevel,
} from "../../lib/grades";

const LEVEL_OPTIONS: { value: BrowseLevel | ""; label: string }[] = [
  { value: "", label: "Any" },
  { value: "lower", label: "Lower div" },
  { value: "upper", label: "Upper div" },
  { value: "graduate", label: "Graduate" },
];

const DEFAULT_LIMIT = 25;

// Filtered browse over the grade dataset: pick a department, level, and
// minimum GPA, and get back the courses that match ranked by GPA.
//
// Unlike CourseGradesCard (lookup by name) this is "give me anything that
// fits these criteria" — useful for finding easy electives, hard graduate
// seminars, etc.
export function BrowseCoursesCard() {
  const [dept, setDept] = useState("");
  const [level, setLevel] = useState<BrowseLevel | "">("");
  const [minGpaText, setMinGpaText] = useState("3.0");
  const [departments, setDepartments] = useState<string[]>([]);
  const [results, setResults] = useState<BrowseHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Departments are static for the session — fetched once and cached in the
  // grades module so re-mounting the card doesn't re-hit the server.
  useEffect(() => {
    fetchDepartments().then(setDepartments).catch(() => setDepartments([]));
  }, []);

  async function runSearch() {
    setLoading(true);
    setError("");
    const filters: BrowseFilters = { limit: DEFAULT_LIMIT };
    const trimmedDept = dept.trim();
    if (trimmedDept) filters.dept = trimmedDept;
    if (level) filters.level = level;
    const minGpaNumber = parseFloat(minGpaText);
    if (!Number.isNaN(minGpaNumber)) filters.min_gpa = minGpaNumber;
    try {
      setResults(await browseCourses(filters));
    } catch (e) {
      setResults(null);
      setError(e instanceof Error ? e.message : "browse failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <div className="mb-[0.85rem] flex items-baseline justify-between border-b border-border pb-[0.6rem]">
        <h2 className="m-0 text-base font-semibold">Browse easy courses</h2>
        <span className="text-[0.8rem] text-muted">Ranked by avg GPA</span>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch();
        }}
        className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"
      >
        <Field label="Department">
          <TextField
            list="browse-dept-options"
            placeholder="Any (or e.g. COM SCI)"
            value={dept}
            onChange={(e) => setDept(e.target.value.toUpperCase())}
          />
          {/* Native datalist gives autocomplete without extra JS or markup. */}
          <datalist id="browse-dept-options">
            {departments.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </Field>

        <Field label="Level">
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as BrowseLevel | "")}
            className="w-full rounded-md border border-border bg-card px-[0.7rem] py-[0.55rem] text-[0.95rem] text-text"
          >
            {LEVEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Min GPA">
          <TextField
            type="number"
            min="0"
            max="4"
            step="0.1"
            value={minGpaText}
            onChange={(e) => setMinGpaText(e.target.value)}
            className="w-24"
          />
        </Field>

        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? "…" : "Search"}
        </Button>
      </form>

      {error && !loading && (
        <p className="m-0 mt-4 text-[0.9rem] text-error">{error}</p>
      )}
      {results && !error && <ResultsList results={results} />}
      {!results && !error && !loading && (
        <p className="m-0 mt-4 text-[0.9rem] text-muted">
          Filter UCLA&apos;s 4-year grade dataset to find courses that match.
          Leave department blank to search across all of UCLA.
        </p>
      )}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-[0.3rem]">
      <span className="text-[0.72rem] font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function ResultsList({ results }: { results: BrowseHit[] }) {
  if (results.length === 0) {
    return (
      <p className="m-0 mt-4 text-[0.9rem] text-muted">
        No courses match those filters. Try lowering the GPA floor.
      </p>
    );
  }
  return (
    <div className="mt-4">
      <div className="mb-[0.4rem] text-[0.75rem] font-medium uppercase tracking-wide text-muted">
        {results.length} match{results.length === 1 ? "" : "es"}
      </div>
      <div className="grid max-h-[28rem] gap-[0.3rem] overflow-auto pr-1">
        {results.map((c) => (
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
            <span className="w-14 shrink-0 text-right text-muted tabular-nums">
              {c.graded.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
