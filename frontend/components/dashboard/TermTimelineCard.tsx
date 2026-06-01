import { Card } from "../ui/Card";
import { formatGpa, gpaColor } from "../../lib/grades";
import { summarizeByTerm, type TermSummary } from "../../lib/stats";
import type { Course } from "../../lib/types";

// Sparkline scale. GPAs below 2.0 clamp to the baseline so a single rough
// quarter doesn't compress the rest of the line.
const TREND_GPA_MIN = 2.0;
const TREND_GPA_MAX = 4.0;
const TREND_W = 200;
const TREND_H = 36;

// Horizontal strip of quarters. Each tile is one term with units, GPA, course
// count, and a small A/B/C/D/F mini-chart. Includes in-progress courses (no
// GPA on those tiles) so the user sees their current quarter on the right.
export function TermTimelineCard({
  completed,
  inProgress,
}: {
  completed: Course[];
  inProgress: Course[];
}) {
  // Tagging in-progress separately means we can render the current term
  // without a GPA value and still order it correctly on the timeline.
  const terms = summarizeByTerm([...completed, ...inProgress]);
  const inProgressTerms = new Set(inProgress.map((c) => c.term));

  if (terms.length === 0) {
    return (
      <Card>
        <div className="mb-[0.6rem] border-b border-border pb-[0.6rem]">
          <h2 className="m-0 text-base font-semibold">Term timeline</h2>
        </div>
        <p className="m-0 text-[0.9rem] text-muted">No terms on record yet.</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-[0.85rem] flex items-baseline justify-between border-b border-border pb-[0.6rem]">
        <h2 className="m-0 text-base font-semibold">Term timeline</h2>
        <span className="text-[0.8rem] text-muted">
          {terms.length} quarter{terms.length === 1 ? "" : "s"} on record
        </span>
      </div>

      <GpaTrendLine terms={terms} />

      {/* Outer div is the scroll viewport; inner flex row is wider than the
          viewport when there are many quarters, and scrolls horizontally
          inside the card without growing it. */}
      <div className="overflow-x-auto pb-1">
        <ol className="m-0 flex list-none gap-3 p-0">
          {terms.map((t) => (
            <li key={t.term} className="flex-shrink-0">
              <TermTile term={t} inProgress={inProgressTerms.has(t.term)} />
            </li>
          ))}
        </ol>
      </div>
    </Card>
  );
}

function TermTile({ term, inProgress }: { term: TermSummary; inProgress: boolean }) {
  const maxBand = Math.max(1, ...term.bands.map((b) => b.count));
  return (
    <div className="w-[160px] rounded-lg border border-border bg-bg px-3 py-[0.7rem]">
      <div className="text-[0.7rem] font-medium uppercase tracking-wide text-muted">
        {term.label}
      </div>

      <div className="mt-[0.35rem] flex items-baseline gap-2">
        {inProgress ? (
          <span className="text-[0.95rem] font-semibold text-accent">
            in progress
          </span>
        ) : (
          <span
            className="text-[1.35rem] font-semibold leading-none tabular-nums"
            style={{ color: gpaColor(term.gpa) }}
          >
            {formatGpa(term.gpa)}
          </span>
        )}
      </div>

      <div className="mt-[0.45rem] text-[0.75rem] text-muted">
        {term.units} units · {term.courseCount} course
        {term.courseCount === 1 ? "" : "s"}
      </div>

      {!inProgress && term.bands.some((b) => b.count > 0) && (
        <div className="mt-[0.55rem] flex h-5 items-end gap-[2px]">
          {term.bands.map((b) => (
            <div
              key={b.label}
              className="flex flex-1 flex-col items-center gap-[2px]"
              title={`${b.count} ${b.label}${b.count === 1 ? "" : "s"}`}
            >
              <div
                className="w-full rounded-sm"
                style={{
                  height: `${(b.count / maxBand) * 100}%`,
                  minHeight: b.count > 0 ? "2px" : "0",
                  background: BAND_COLOR[b.label],
                }}
              />
              <span className="text-[0.6rem] font-mono leading-none text-muted">
                {b.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const BAND_COLOR: Record<string, string> = {
  A: "#16a34a",
  B: "#84cc16",
  C: "#eab308",
  D: "#f97316",
  F: "#dc2626",
};

// Inline GPA trend line. Plots one point per letter-graded quarter (we skip
// quarters that are in-progress only, since they have no GPA yet). Stretches
// horizontally to fill the card via preserveAspectRatio="none"; the small
// circles still render correctly at the data points because the SVG is short
// enough that the aspect-ratio distortion isn't visible.
function GpaTrendLine({ terms }: { terms: TermSummary[] }) {
  const points = terms
    .map((t, idx) => ({ idx, gpa: t.gpa, label: t.label }))
    .filter((p): p is { idx: number; gpa: number; label: string } => p.gpa !== null);

  if (points.length < 2) return null;

  const spread = Math.max(1, terms.length - 1);
  const range = TREND_GPA_MAX - TREND_GPA_MIN;

  const positions = points.map((p) => {
    const x = (p.idx / spread) * TREND_W;
    const clamped = Math.max(TREND_GPA_MIN, Math.min(TREND_GPA_MAX, p.gpa));
    const y = TREND_H - ((clamped - TREND_GPA_MIN) / range) * TREND_H;
    return { x, y, gpa: p.gpa, label: p.label };
  });

  const path = positions
    .map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(2)},${pt.y.toFixed(2)}`)
    .join(" ");

  const midY = TREND_H - ((3.0 - TREND_GPA_MIN) / range) * TREND_H;

  return (
    <div className="mb-3">
      <div className="mb-1 flex items-baseline justify-between text-[0.7rem] text-muted">
        <span>GPA trend</span>
        <span className="tabular-nums">2.0 – 4.0</span>
      </div>
      <svg
        viewBox={`0 0 ${TREND_W} ${TREND_H}`}
        preserveAspectRatio="none"
        className="block h-9 w-full"
        role="img"
        aria-label="Cumulative GPA over completed quarters"
      >
        {/* 3.0 reference line */}
        <line
          x1="0"
          y1={midY}
          x2={TREND_W}
          y2={midY}
          stroke="var(--border)"
          strokeDasharray="2,2"
          strokeWidth="1"
        />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="1.6" />
        {positions.map((pt, i) => (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r="2"
            fill="var(--accent)"
          >
            <title>
              {pt.label}: {pt.gpa.toFixed(2)} GPA
            </title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
