"use client";

import { useMemo, useState } from "react";
import { countCourses, parseEligible, type EligibleGroup } from "../../lib/eligible";

const PREVIEW_LIMIT = 3;

export function EligibleCourses({ raw }: { raw: string }) {
  const groups = useMemo(() => parseEligible(raw), [raw]);
  const [expanded, setExpanded] = useState(false);

  if (groups.length === 0) {
    return <RawFallback raw={raw} />;
  }

  const total = countCourses(groups);
  const collapsible = groups.length > PREVIEW_LIMIT;
  const visible = expanded || !collapsible ? groups : groups.slice(0, PREVIEW_LIMIT);
  const hiddenDepts = groups.length - visible.length;
  const hiddenCourses = total - countCourses(visible);

  return (
    <div className="mt-[0.5rem]">
      <div className="mb-[0.3rem] text-[0.75rem] font-medium uppercase tracking-wide text-muted">
        Eligible courses · {total}
      </div>
      <dl className="m-0 grid gap-y-[0.35rem]">
        {visible.map((g) => (
          <DeptRow key={g.dept} group={g} />
        ))}
      </dl>
      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-[0.45rem] border-none bg-transparent p-0 text-[0.78rem] font-medium text-accent"
        >
          {expanded
            ? "Show fewer"
            : `Show ${hiddenDepts} more department${hiddenDepts === 1 ? "" : "s"} (${hiddenCourses} courses)`}
        </button>
      )}
    </div>
  );
}

function DeptRow({ group }: { group: EligibleGroup }) {
  return (
    <div className="grid grid-cols-[minmax(4.5rem,auto)_1fr] gap-x-3 text-[0.82rem] leading-snug">
      <dt className="font-mono font-semibold text-text">{group.dept}</dt>
      <dd className="m-0 text-muted">{group.numbers.join(", ")}</dd>
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
