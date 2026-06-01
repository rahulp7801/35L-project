import { CourseLink } from "../ui/CourseLink";
import { formatGpa, gpaColor, titleCaseName } from "../../lib/grades";
import type { PlanCourse } from "../../lib/planner";

// A single recommended course row inside a quarter card. Shared between
// first-pass and second-pass lists; the only visual difference between the
// two lists lives one level up.
export function PlanCourseRow({ course }: { course: PlanCourse }) {
  const topProf = course.top_instructors[0];
  return (
    <li className="rounded-md border border-border bg-bg px-3 py-[0.65rem]">
      <div className="flex items-center gap-2 text-[0.88rem]">
        <CourseLink
          dept={course.dept}
          number={course.number}
          className="shrink-0 font-mono font-semibold"
        />
        <span className="min-w-0 flex-1 truncate text-muted">
          {course.title || "—"}
        </span>
        <span
          className="shrink-0 text-[0.85rem] font-semibold tabular-nums"
          style={{ color: gpaColor(course.avg_gpa) }}
          title="Historical course GPA"
        >
          {formatGpa(course.avg_gpa)}
        </span>
      </div>

      <div className="mt-[0.35rem] flex flex-wrap items-baseline gap-x-3 gap-y-[0.2rem] text-[0.76rem] text-muted">
        <span title="DARS requirement this satisfies" className="truncate">
          ↳ {course.requirement}
        </span>
        {course.seasons.length > 0 && (
          <span className="shrink-0">
            Offered: {course.seasons.map((s) => s.slice(0, 2)).join(", ")}
          </span>
        )}
        {topProf && (
          <span className="shrink-0">
            Best prof:{" "}
            <span className="font-medium text-text">
              {titleCaseName(topProf.instructor)}
            </span>{" "}
            <span style={{ color: gpaColor(topProf.avg_gpa) }}>
              ({formatGpa(topProf.avg_gpa)})
            </span>
          </span>
        )}
      </div>
    </li>
  );
}
