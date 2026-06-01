import { Card } from "../ui/Card";
import { GradeBars } from "../grades/GradeBars";
import { formatGpa, gpaColor } from "../../lib/grades";
import { completedGradeStats } from "../../lib/stats";
import type { Course } from "../../lib/types";

// A/B/C/D/F breakdown of the user's completed courses, with the cumulative
// GPA as a colored headline. Reuses the GradeBars chart from the grade
// explorer so the visual language stays consistent across the app.
export function GradeDistributionCard({ completed }: { completed: Course[] }) {
  const stats = completedGradeStats(completed);

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
              style={{ color: gpaColor(stats.avg_gpa) }}
            >
              {formatGpa(stats.avg_gpa)}
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
