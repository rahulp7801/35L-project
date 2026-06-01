import { Card } from "../ui/Card";
import { CardHeader } from "../ui/CardHeader";
import { Chip } from "../ui/Chip";
import { EligibleCourses } from "./EligibleCourses";
import { RecommendedCourses } from "./RecommendedCourses";
import { describeNeed } from "../../lib/format";
import type { Needs, Remaining, Section } from "../../lib/types";

type OutstandingItem = {
  title: string;
  chips: string[];
  rawLine?: string;
  eligible?: string;
};

function sectionToItem(s: Section): OutstandingItem {
  // Aggregate chips across all NEEDS lines so the user sees
  // "Need 2 courses · Need 8.0 units" instead of three separate lines.
  const totals: Needs = {};
  for (const n of s.needs) {
    if (n.needs.courses) totals.courses = (totals.courses ?? 0) + n.needs.courses;
    if (n.needs.units) totals.units = (totals.units ?? 0) + n.needs.units;
    if (n.needs.sub_groups) totals.sub_groups = (totals.sub_groups ?? 0) + n.needs.sub_groups;
    if (n.needs.gpa) totals.gpa = n.needs.gpa;
  }
  const eligible = s.needs
    .map((n) => n.eligible)
    .filter(Boolean)
    .join(" / ");
  return {
    title: s.title,
    chips: describeNeed(totals).map((c) => `Need ${c}`),
    eligible: eligible || undefined,
  };
}

function remainingToItem(r: Remaining): OutstandingItem {
  return {
    title: r.section,
    chips: [],
    rawLine: r.needs_raw,
    eligible: r.eligible,
  };
}

type Props =
  | { sections: Section[]; remaining?: never }
  | { sections?: never; remaining: Remaining[] };

export function OutstandingCard(props: Props) {
  const items: OutstandingItem[] = props.sections
    ? props.sections.map(sectionToItem)
    : props.remaining.map(remainingToItem);

  return (
    <Card>
      <CardHeader title="Outstanding" count={items.length} accent="var(--error)" />
      {items.length === 0 ? (
        <p className="m-0 text-[0.9rem] text-muted">All requirements satisfied.</p>
      ) : (
        <ul className="m-0 grid list-none gap-[0.85rem] p-0">
          {items.map((item, i) => (
            <OutstandingItemRow key={i} item={item} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function OutstandingItemRow({ item }: { item: OutstandingItem }) {
  return (
    <li className="rounded-lg border border-border bg-accent-soft px-[0.85rem] py-3">
      <p className="m-0 text-[0.92rem] font-semibold">{item.title}</p>

      {item.chips.length > 0 && (
        <div className="mt-[0.45rem] flex flex-wrap gap-[0.4rem]">
          {item.chips.map((c, j) => (
            <Chip key={j} label={c} />
          ))}
        </div>
      )}

      {item.rawLine && (
        <p className="m-0 mt-[0.3rem] text-[0.8rem] font-medium text-error">
          Needs · {item.rawLine}
        </p>
      )}

      {item.eligible && <RecommendedCourses eligible={item.eligible} />}
      {item.eligible && <EligibleCourses raw={item.eligible} />}
    </li>
  );
}
