import { Card } from "../ui/Card";
import { gpaColor, formatGpa } from "../../lib/grades";
import {
  UNITS_TO_GRADUATE,
  cumulativeGpa,
  totalUnits,
} from "../../lib/stats";
import type { Parsed } from "../../lib/types";

// Six-tile "transcript at a glance" strip. The first two tiles (GPA, Units)
// are the headline academic numbers; the next four roll up DARS requirement
// progress and course counts.

type StatProps = { label: string; value: string; accent?: string };

function Stat({ label, value, accent }: StatProps) {
  return (
    <Card className="!px-4 !py-3">
      <div className="truncate text-[0.7rem] font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
      <div
        className="mt-1 truncate text-xl font-semibold tabular-nums"
        style={{ color: accent }}
      >
        {value}
      </div>
    </Card>
  );
}

export function StatStrip({ parsed }: { parsed: Parsed }) {
  const sections = parsed.sections ?? [];
  const total = sections.length;
  const fulfilled = sections.filter((s) => s.status === "fulfilled").length;
  const outstanding = sections.length
    ? sections.filter((s) => s.status === "unfulfilled").length
    : parsed.remaining.length;
  const pct = total ? Math.round((fulfilled / total) * 100) : null;

  const gpa = cumulativeGpa(parsed.completed);
  const unitsDone = totalUnits(parsed.completed);
  const unitsInProgress = totalUnits(parsed.in_progress);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <Stat label="Cum. GPA" value={formatGpa(gpa)} accent={gpaColor(gpa)} />
      <Stat
        label="Units"
        value={`${formatUnits(unitsDone)}/${UNITS_TO_GRADUATE}`}
        accent={unitsDone >= UNITS_TO_GRADUATE ? "var(--success)" : undefined}
      />
      <Stat label="Fulfilled" value={pct === null ? "—" : `${pct}%`} />
      <Stat
        label="Completed"
        value={String(parsed.completed.length)}
        accent="var(--success)"
      />
      <Stat
        label="In progress"
        value={String(parsed.in_progress.length)}
        accent="var(--accent)"
      />
      <Stat label="Outstanding" value={String(outstanding)} accent="var(--error)" />
    </div>
  );
}

// Trim a trailing ".0" so 16.0 renders as 16 but 16.5 stays 16.5.
function formatUnits(units: number): string {
  return Number.isInteger(units) ? String(units) : units.toFixed(1);
}
