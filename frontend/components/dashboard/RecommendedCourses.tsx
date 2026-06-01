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
          <li
            key={`${c.dept}-${c.number}`}
            className="flex items-center gap-2 text-[0.82rem]"
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
          </li>
        ))}
      </ol>
      {note && (
        <p className="m-0 mt-[0.3rem] text-[0.72rem] text-muted">{note}</p>
      )}
    </div>
  );
}
