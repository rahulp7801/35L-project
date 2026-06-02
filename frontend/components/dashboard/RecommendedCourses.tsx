"use client";

import { useEffect, useState } from "react";
import { parseEligible } from "../../lib/eligible";
import {
  fetchRecommendations,
  formatGpa,
  gpaColor,
  titleCaseName,
  type CourseTiming,
  type RecommendResult,
} from "../../lib/grades";
import { CourseLink } from "../ui/CourseLink";

// for one unfulfilled requirement, rank its eligible courses by historical GPA and show the top few.
export function RecommendedCourses({ eligible }: { eligible: string }) {
  const [result, setResult] = useState<RecommendResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const groups = parseEligible(eligible);
    if (groups.length === 0) return;
    let alive = true;
    fetchRecommendations(groups, 5)
      .then((r) => alive && setResult(r))
      .catch(() => alive && setResult(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [eligible]);

  // Stay quiet while loading or when nothing matched grade data
  if (loading || !result || result.courses.length === 0) return null;

  const { courses, total_with_data } = result;
  const note =
    total_with_data > courses.length
      ? `top ${courses.length} of ${total_with_data} with grade data`
      : total_with_data < 5
      ? `${total_with_data} with grade data (list may be incomplete)`
      : null;

  return (
    <div className="mt-[0.6rem]">
      <div className="mb-[0.35rem] text-[0.75rem] font-medium uppercase tracking-wide text-success">
        Top courses by GPA
      </div>
      <ol className="m-0 grid list-none gap-[0.3rem] p-0">
        {courses.map((c) => (
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
            </div>
            {c.timing?.favorable && <TimingFlag timing={c.timing} />}
          </li>
        ))}
      </ol>
      {note && (
        <p className="m-0 mt-[0.3rem] text-[0.72rem] text-muted">{note}</p>
      )}
    </div>
  );
}

// Highlights a course whose upcoming-term instructor grades meaningfully higher than the course's all-time baseline
function TimingFlag({ timing }: { timing: CourseTiming }) {
  return (
    <div className="mt-[0.25rem] flex flex-wrap items-center gap-x-[0.45rem] gap-y-[0.15rem] text-[0.72rem]">
      <span className="inline-flex items-center gap-[0.25rem] rounded-full border border-success/40 bg-success/10 px-[0.45rem] py-[0.1rem] font-semibold text-success">
        <TrendIcon />
        Favorable timing +{timing.delta.toFixed(2)}
      </span>
      <span className="text-muted">
        Teaching {timing.term_label}: {titleCaseName(timing.instructor)} averages{" "}
        {timing.instructor_avg_gpa.toFixed(2)} vs {timing.baseline_avg_gpa.toFixed(2)}{" "}
        baseline
      </span>
    </div>
  );
}

// Small upward-trend mark; sized in em so it tracks the surrounding text.
function TrendIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="inline-block h-[0.85em] w-[0.85em]"
    >
      <path d="M3 17l6-6 4 4 8-8M21 7v5M21 7h-5" />
    </svg>
  );
}
