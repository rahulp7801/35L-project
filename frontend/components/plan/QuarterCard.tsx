import { Card } from "../ui/Card";
import { PlanCourseRow } from "./PlanCourseRow";
import type { PlanQuarter } from "../../lib/planner";

// One quarter of the recommendation: header with units, then two clearly
// separated pass lists. First-pass is what the user grabs at the start of
// their enrollment window; second-pass rounds out the schedule.
export function QuarterCard({
  quarter,
  firstPassCap,
}: {
  quarter: PlanQuarter;
  firstPassCap: number;
}) {
  return (
    <Card>
      <header className="mb-[0.85rem] flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-[0.55rem]">
        <h2 className="m-0 text-base font-semibold">{quarter.label}</h2>
        <span className="text-[0.8rem] text-muted">
          {quarter.total_units} units total
        </span>
      </header>

      <PassSection
        label="First pass"
        hint={`${quarter.first_pass_units} / ${firstPassCap} units cap`}
        accent="var(--accent)"
        courses={quarter.first_pass}
        emptyText="Nothing critical to grab first pass."
      />

      <div className="my-4 border-t border-dashed border-border" />

      <PassSection
        label="Second pass"
        hint={`${quarter.total_units - quarter.first_pass_units} units`}
        accent="var(--muted)"
        courses={quarter.second_pass}
        emptyText="No second-pass picks this quarter."
      />
    </Card>
  );
}

function PassSection({
  label,
  hint,
  accent,
  courses,
  emptyText,
}: {
  label: string;
  hint: string;
  accent: string;
  courses: PlanQuarter["first_pass"];
  emptyText: string;
}) {
  return (
    <section>
      <div className="mb-[0.55rem] flex items-baseline justify-between">
        <span
          className="text-[0.75rem] font-semibold uppercase tracking-wide"
          style={{ color: accent }}
        >
          {label}
        </span>
        <span className="text-[0.72rem] text-muted">{hint}</span>
      </div>
      {courses.length === 0 ? (
        <p className="m-0 text-[0.85rem] text-muted">{emptyText}</p>
      ) : (
        <ol className="m-0 grid list-none gap-[0.4rem] p-0">
          {courses.map((c) => (
            <PlanCourseRow key={`${c.dept}-${c.number}`} course={c} />
          ))}
        </ol>
      )}
    </section>
  );
}
