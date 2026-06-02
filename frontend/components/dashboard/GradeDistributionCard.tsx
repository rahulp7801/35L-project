import { Card } from "../ui/Card";
import { GradeBars } from "../grades/GradeBars";
import { formatGpa, gpaColor } from "../../lib/grades";
import { completedGradeStats } from "../../lib/stats";
import type { Course } from "../../lib/types";

// A/B/C/D/F breakdown of the user's completed courses with the cumulative
// gpa as a colored headline.
export function GradeDistributionCard({
  completed,
  cumulativeGpa,
}: {
  completed: Course[];
  // ucla's official gpa from the audit. when set we use it instead of our
  // own calculation so the number lines up with the Cum. GPA tile at the top.
  cumulativeGpa?: number | null;
}) {
  const stats = completedGradeStats(completed);
  let headlineGpa: number | null;
  if (cumulativeGpa !== null && cumulativeGpa !== undefined) {
    headlineGpa = cumulativeGpa;
  } else {
    headlineGpa = stats.avg_gpa;
  }

  return (
    <Card className="flex h-full flex-col">
      <div className="mb-[0.85rem] flex items-baseline justify-between border-b border-border pb-[0.6rem]">
        <h2 className="m-0 text-base font-semibold">Grade distribution</h2>
        <span className="text-[0.8rem] text-muted">
          {stats.graded} graded
        </span>
      </div>

      {stats.graded === 0 ? (
        <p className="m-0 text-[0.9rem] text-muted">
          No letter-graded courses yet.
        </p>
      ) : (
        <>
          <div className="mb-[0.85rem] flex items-baseline justify-between">
            <span
              className="text-2xl font-semibold tabular-nums"
              style={{ color: gpaColor(headlineGpa) }}
            >
              {formatGpa(headlineGpa)}
            </span>
            <span className="text-[0.75rem] text-muted">cumulative GPA</span>
          </div>
          <GradeBars stats={stats} />
          {stats.total > stats.graded && (
            <p className="m-0 mt-2 text-[0.75rem] text-muted">
              + {stats.total - stats.graded} non-letter mark
              {stats.total - stats.graded === 1 ? "" : "s"} (P/NP/IP, not in GPA)
            </p>
          )}
        </>
      )}
    </Card>
  );
}
