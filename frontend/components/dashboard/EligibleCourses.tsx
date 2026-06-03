"use client";

import { useEffect, useMemo, useState } from "react";
import {
  countCourses,
  parseEligible,
  type EligibleGroup,
} from "../../lib/eligible";
import {
  fetchRecommendations,
  formatGpa,
  gpaColor,
  type Recommendation,
} from "../../lib/grades";
import { CourseLink } from "../ui/CourseLink";

const PREVIEW_LIMIT = 3;

export function EligibleCourses({
  raw,
  planned,
  onTogglePlan,
}: {
  raw: string;
  planned?: Set<string>;
  onTogglePlan?: (code: string) => Promise<void> | void;
}) {
  const groups = useMemo(() => parseEligible(raw), [raw]);
  const [expanded, setExpanded] = useState(false);

  if (groups.length === 0) {
    return <RawFallback raw={raw} />;
  }

  const total = countCourses(groups);
  const collapsible = groups.length > PREVIEW_LIMIT;
  const hiddenDepts = groups.length - PREVIEW_LIMIT;
  const hiddenCourses = total - countCourses(groups.slice(0, PREVIEW_LIMIT));

  let toggleLabel = "Show fewer";
  if (!expanded) {
    let deptWord = "departments";
    if (hiddenDepts === 1) deptWord = "department";
    toggleLabel = `Show ${hiddenDepts} more ${deptWord} (${hiddenCourses} courses)`;
  }

  return (
    <div className="mt-[0.5rem]">
      <div className="mb-[0.3rem] text-[0.75rem] font-medium uppercase tracking-wide text-muted">
        Eligible courses · {total}
      </div>

      {expanded ? (
        <ExpandedList
          groups={groups}
          planned={planned}
          onTogglePlan={onTogglePlan}
        />
      ) : (
        <CompactList groups={groups.slice(0, PREVIEW_LIMIT)} />
      )}

      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-[0.45rem] border-none bg-transparent p-0 text-[0.78rem] font-medium text-accent"
        >
          {toggleLabel}
        </button>
      )}
    </div>
  );
}

// short view: one line per dept, comma-separated numbers
function CompactList({ groups }: { groups: EligibleGroup[] }) {
  return (
    <dl className="m-0 grid gap-y-[0.35rem]">
      {groups.map((g) => (
        <div
          key={g.dept}
          className="grid grid-cols-[minmax(4.5rem,auto)_1fr] gap-x-3 text-[0.82rem] leading-snug"
        >
          <dt className="font-mono font-semibold text-text">{g.dept}</dt>
          <dd className="m-0 text-muted">{g.numbers.join(", ")}</dd>
        </div>
      ))}
    </dl>
  );
}

// full view: one row per course with gpa and add-to-plan button.
// number ranges like "111-187" can't be planned so they go in a footnote.
function ExpandedList({
  groups,
  planned,
  onTogglePlan,
}: {
  groups: EligibleGroup[];
  planned?: Set<string>;
  onTogglePlan?: (code: string) => Promise<void> | void;
}) {
  const [gpas, setGpas] = useState<Map<string, Recommendation>>(new Map());
  const [pending, setPending] = useState<string | null>(null);

  // pull gpas for the whole eligible list at once
  useEffect(() => {
    let alive = true;
    fetchRecommendations(groups, 500)
      .then((r) => {
        if (!alive) return;
        const next = new Map<string, Recommendation>();
        for (const c of r.courses) next.set(`${c.dept} ${c.number}`, c);
        setGpas(next);
      })
      .catch(() => {
        if (alive) setGpas(new Map());
      });
    return () => {
      alive = false;
    };
  }, [groups]);

  // split into individual courses vs ranges
  const concrete: { dept: string; number: string }[] = [];
  const ranges: { dept: string; range: string }[] = [];
  for (const g of groups) {
    for (const n of g.numbers) {
      if (n.includes("–") || n.includes("-")) {
        ranges.push({ dept: g.dept, range: n });
      } else {
        concrete.push({ dept: g.dept, number: n });
      }
    }
  }

  // best gpa first, courses with no data go last
  concrete.sort((a, b) => {
    const ra = gpas.get(`${a.dept} ${a.number}`);
    const rb = gpas.get(`${b.dept} ${b.number}`);
    const ga = ra ? ra.avg_gpa : null;
    const gb = rb ? rb.avg_gpa : null;
    if (ga === null && gb === null) return 0;
    if (ga === null) return 1;
    if (gb === null) return -1;
    return gb - ga;
  });

  async function handleToggle(code: string) {
    if (!onTogglePlan) return;
    setPending(code);
    try {
      await onTogglePlan(code);
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <ol className="m-0 grid list-none gap-[0.3rem] p-0">
        {concrete.map(({ dept, number }) => {
          const code = `${dept} ${number}`;
          const row = gpas.get(code);
          let gpa: number | null = null;
          let title = "";
          if (row) {
            gpa = row.avg_gpa;
            title = row.title;
          }
          let isPlanned = false;
          if (planned) isPlanned = planned.has(code);
          const isPending = pending === code;

          let buttonClass =
            "shrink-0 rounded-md border px-2 py-[0.2rem] text-[0.72rem] font-semibold transition-colors ";
          if (isPlanned) {
            buttonClass +=
              "border-[var(--planned)] bg-[var(--planned-soft)] text-[var(--planned)]";
          } else {
            buttonClass += "border-border bg-card text-muted hover:text-text";
          }

          return (
            <li
              key={code}
              // [GenAI Use] Prompt: There is an issue on the dashboard page where the blue background is broken and it bleeds outside the bounding box for the Outstanding requirements. Find this obscure bug, explain why it occurs, and show me how to fix it.
              // [GenAI Use] LLM Response Start - bounding box issue
              className="flex min-w-0 items-center gap-2 text-[0.82rem]"
              // [GenAI Use] LLM Response End - bounding box issue
              // [GenAI Use] Reflection: I see the bug. The blue <li> in OutstandingCard.tsx:107 is bleeding because its child rows in RecommendedCourses / EligibleCourses use truncate on a flex child without min-w-0. By default, flex items have min-width: auto, which means the truncate doesn't actually shrink — a long course title forces the row wider than its parent, the <li> grows past the card, and the blue background paints into the overflow. Fix: 1. RecommendedCourses.tsx:94,100 — added min-w-0 to the flex row and min-w-0 flex-1 to the title span so the truncate can actually engage. 2. EligibleCourses.tsx:186,195 — same fix for the expanded eligible list rows (the <li> itself is the flex container there). 3. OutstandingCard.tsx:107 — defensively added min-w-0 overflow-hidden to the blue <li> so any future child that misbehaves can't bleed past the requirement card.
            >
              <CourseLink
                dept={dept}
                number={number}
                className="shrink-0 font-mono font-semibold"
              />
              {/* [GenAI Use] LLM Response Start - bounding box issue */}
              {title && <span className="min-w-0 flex-1 truncate text-muted">{title}</span>}
              {/* [GenAI Use] LLM Response End - bounding box issue */}
              {gpa !== null ? (
                <span
                  className="ml-auto shrink-0 font-semibold tabular-nums"
                  style={{ color: gpaColor(gpa) }}
                >
                  {formatGpa(gpa)}
                </span>
              ) : (
                <span className="ml-auto shrink-0 text-[0.72rem] text-muted">
                  no data
                </span>
              )}
              {onTogglePlan && (
                <button
                  type="button"
                  onClick={() => handleToggle(code)}
                  disabled={isPending}
                  aria-pressed={isPlanned}
                  className={buttonClass}
                >
                  {isPlanned ? "Planned" : "Add to plan"}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {ranges.length > 0 && (
        <p className="m-0 mt-[0.45rem] text-[0.75rem] text-muted">
          Plus ranges:{" "}
          {ranges.map((r, i) => (
            <span key={i}>
              {i > 0 && ", "}
              <span className="font-mono">
                {r.dept} {r.range}
              </span>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

function RawFallback({ raw }: { raw: string }) {
  return (
    <p className="m-0 mt-[0.5rem] font-mono text-[0.82rem] leading-relaxed text-muted">
      <span className="font-medium text-text">From: </span>
      {raw}
    </p>
  );
}
