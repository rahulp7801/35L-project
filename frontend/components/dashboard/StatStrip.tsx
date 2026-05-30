import { Card } from "../ui/Card";
import type { Parsed } from "../../lib/types";

type StatProps = { label: string; value: string; accent?: string };

function Stat({ label, value, accent }: StatProps) {
  return (
    <Card className="!py-4">
      <div className="text-[0.72rem] font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold" style={{ color: accent }}>
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

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
      <Stat label="Fulfilled" value={pct === null ? "—" : `${pct}%`} />
    </div>
  );
}
