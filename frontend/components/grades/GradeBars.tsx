import { gradeBuckets, type GradeStats } from "../../lib/grades";

// A/B/C/D/F horizontal bars showing each band's share of graded students.
export function GradeBars({ stats }: { stats: GradeStats }) {
  const buckets = gradeBuckets(stats);
  return (
    <div className="grid gap-[0.4rem]">
      {buckets.map((b) => (
        <div key={b.label} className="flex items-center gap-2 text-[0.82rem]">
          <span className="w-3 font-mono font-semibold">{b.label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full"
              style={{ width: `${b.pct}%`, background: b.color }}
            />
          </div>
          <span className="w-9 text-right font-medium tabular-nums">
            {b.pct.toFixed(0)}%
          </span>
          <span className="w-12 text-right text-muted tabular-nums">
            {b.count.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}
