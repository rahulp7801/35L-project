"use client";

import { useEffect, useState } from "react";
import { parseEligible } from "../../lib/eligible";
import {
  fetchRecommendations,
  formatGpa,
  gpaColor,
  type RecommendResult,
} from "../../lib/grades";
import { CourseLink } from "../ui/CourseLink";

// rank a requirement's eligible courses by historical gpa, show the top few.
export function RecommendedCourses({
  eligible,
  planned,
  onTogglePlan,
}: {
  eligible: string;
  planned?: Set<string>;
  onTogglePlan?: (code: string) => Promise<void> | void;
}) {
  const [result, setResult] = useState<RecommendResult | null>(null);
  const [loading, setLoading] = useState(true);
  // which course is currently saving, so we only disable that one button
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    const groups = parseEligible(eligible);
    if (groups.length === 0) return;
    let alive = true;
    fetchRecommendations(groups, 5)
      .then((r) => {
        if (alive) setResult(r);
      })
      .catch(() => {
        if (alive) setResult(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [eligible]);

  // hide the section while loading or when nothing has grade data
  if (loading || !result || result.courses.length === 0) return null;

  const { courses, total_with_data } = result;

  let note: string | null = null;
  if (total_with_data > courses.length) {
    note = `top ${courses.length} of ${total_with_data} with grade data`;
  } else if (total_with_data < 5) {
    note = `${total_with_data} with grade data (list may be incomplete)`;
  }

  async function handleToggle(code: string) {
    if (!onTogglePlan) return;
    setPending(code);
    try {
      await onTogglePlan(code);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-[0.6rem]">
      <div className="mb-[0.35rem] text-[0.75rem] font-medium uppercase tracking-wide text-success">
        Top courses by GPA
      </div>
      <ol className="m-0 grid list-none gap-[0.3rem] p-0">
        {courses.map((c) => {
          const code = `${c.dept} ${c.number}`;
          let isPlanned = false;
          if (planned) isPlanned = planned.has(code);
          const isPending = pending === code;

          let buttonClass =
            "shrink-0 rounded-md border px-2 py-[0.2rem] text-[0.72rem] font-semibold transition-colors ";
          if (isPlanned) {
            buttonClass +=
              "border-[var(--planned)] bg-[var(--planned-soft)] text-[var(--planned)]";
          } else {
            buttonClass += "border-border bg-card text-muted hover:text-text";
          }

          return (
            <li key={`${c.dept}-${c.number}`} className="text-[0.82rem]">
              <div className="flex items-center gap-2">
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
                {onTogglePlan && (
                  <button
                    type="button"
                    onClick={() => handleToggle(code)}
                    disabled={isPending}
                    aria-pressed={isPlanned}
                    className={buttonClass}
                  >
                    {isPlanned ? "Planned" : "Add to plan"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {note && (
        <p className="m-0 mt-[0.3rem] text-[0.72rem] text-muted">{note}</p>
      )}
    </div>
  );
}
