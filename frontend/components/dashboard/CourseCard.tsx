import { Card } from "../ui/Card";
import { CardHeader } from "../ui/CardHeader";
import type { Course } from "../../lib/types";

type Props = {
  title: string;
  accent: string;
  courses: Course[];
};

export function CourseCard({ title, accent, courses }: Props) {
  return (
    <Card>
      <CardHeader title={title} count={courses.length} accent={accent} />
      {courses.length === 0 ? (
        <p className="m-0 text-[0.9rem] text-muted">Nothing here yet.</p>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0">
          {courses.map((c, i) => (
            <li
              key={`${c.term}-${c.code}-${i}`}
              className="flex justify-between gap-3 text-[0.9rem]"
            >
              <span className="min-w-0 flex-1">
                <span className="mr-[0.4rem] text-muted">{c.term}</span>
                <span className="font-medium">{c.code}</span>
                <span className="ml-2 text-muted">{c.title}</span>
              </span>
              <span
                className="flex-shrink-0 text-[0.85rem] font-semibold tabular-nums"
                style={{ color: accent }}
              >
                {c.grade}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
