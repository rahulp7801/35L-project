import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import type { Needs, Section } from "../../lib/types";
import type { PaceForecast } from "../../lib/stats";

type Totals = { fulfilled: number; inProgress: number; unfulfilled: number };

function tallySections(sections: Section[]): Totals {
  const totals: Totals = { fulfilled: 0, inProgress: 0, unfulfilled: 0 };
  for (const s of sections) {
    if (s.status === "fulfilled") totals.fulfilled++;
    else if (s.status === "in_progress") totals.inProgress++;
    else if (s.status === "unfulfilled") totals.unfulfilled++;
  }
  return totals;
}

function tallyOutstanding(sections: Section[]): Needs {
  const out: Needs = {};
  for (const s of sections) {
    if (s.status !== "unfulfilled") continue;
    for (const n of s.needs) {
      if (n.needs.units) out.units = (out.units ?? 0) + n.needs.units;
      if (n.needs.courses) out.courses = (out.courses ?? 0) + n.needs.courses;
    }
  }
  return out;
}

type Props = {
  sections: Section[];
  pace?: PaceForecast | null;
  // section titles where the user has at least one course in their plan
  plannedSections?: Set<string>;
};

export function ProgressCard({ sections, pace, plannedSections }: Props) {
  const total = sections.length;
  const tally = tallySections(sections);
  const fulfilled = tally.fulfilled;
  const inProgress = tally.inProgress;

  // count unfulfilled sections that the user has planned a course for
  let planned = 0;
  if (plannedSections) {
    for (const s of sections) {
      if (s.status === "unfulfilled" && plannedSections.has(s.title)) planned++;
    }
  }
  const unfulfilled = Math.max(0, tally.unfulfilled - planned);

  let pctFulfilled = 0;
  let pctPlanned = 0;
  let pctInProgress = 0;
  if (total > 0) {
    pctFulfilled = (fulfilled / total) * 100;
    pctPlanned = (planned / total) * 100;
    pctInProgress = (inProgress / total) * 100;
  }
  // count fulfilled + planned together for the headline percentage
  const pctTowardDone = pctFulfilled + pctPlanned;

  const { units: unitsLeft = 0, courses: coursesLeft = 0 } = tallyOutstanding(sections);

  return (
    <Card>
      <div className="mb-[0.85rem] flex items-baseline justify-between border-b border-border pb-[0.6rem]">
        <h2 className="m-0 text-base font-semibold">Progress</h2>
        <span className="text-[0.85rem] font-semibold text-text">
          {pctTowardDone.toFixed(0)}% fulfilled
        </span>
      </div>

      <div className="mb-[0.7rem] flex h-2.5 overflow-hidden rounded-full bg-border">
        <div className="bg-success" style={{ width: `${pctFulfilled}%` }} />
        <div style={{ width: `${pctPlanned}%`, backgroundColor: "var(--planned)" }} />
        <div className="bg-accent" style={{ width: `${pctInProgress}%` }} />
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[0.85rem] text-muted">
        <span>
          <strong className="text-success">{fulfilled}</strong> fulfilled
        </span>
        {planned > 0 && (
          <span>
            <strong style={{ color: "var(--planned)" }}>{planned}</strong> planned
          </span>
        )}
        <span>
          <strong className="text-accent">{inProgress}</strong> in progress
        </span>
        <span>
          <strong className="text-error">{unfulfilled}</strong> unfulfilled
        </span>
        <span className="ml-auto">
          {total} requirement{total === 1 ? "" : "s"}
        </span>
      </div>

      {(coursesLeft > 0 || unitsLeft > 0) && (
        <div className="mt-[0.85rem] flex flex-wrap gap-2 border-t border-dashed border-border pt-[0.7rem]">
          {coursesLeft > 0 && (
            <Chip label={`${coursesLeft} course${coursesLeft === 1 ? "" : "s"} to go`} />
          )}
          {unitsLeft > 0 && <Chip label={`${unitsLeft.toFixed(1)} units to go`} />}
        </div>
      )}

      {pace && pace.quartersRemaining > 0 && (
        <p className="m-0 mt-[0.6rem] text-[0.82rem] text-muted">
          At your pace ({pace.avgUnitsPerQuarter.toFixed(1)} units/qtr), about{" "}
          <strong className="text-text">
            {pace.quartersRemaining} quarter{pace.quartersRemaining === 1 ? "" : "s"}
          </strong>{" "}
          left ({pace.unitsRemaining.toFixed(0)} units to go).
        </p>
      )}
    </Card>
  );
}
