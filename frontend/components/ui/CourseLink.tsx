import type { ReactNode } from "react";
import {
  courseCatalogUrl,
  courseCatalogUrlFromCode,
} from "../../lib/courseLink";

// Wraps a course code in a link to its UCLA catalog page. Renders a plain
// span when the code can't be parsed into dept + number, so we never emit a
// dead link.
//
// Two ways to call:
//   <CourseLink code="COM SCI 31">…</CourseLink>
//   <CourseLink dept="COM SCI" number="31">…</CourseLink>
//
// Children default to the code text when omitted.

type Props = {
  code?: string;
  dept?: string;
  number?: string;
  className?: string;
  children?: ReactNode;
};

export function CourseLink({ code, dept, number, className = "", children }: Props) {
  const url =
    dept && number
      ? courseCatalogUrl(dept, number)
      : code
      ? courseCatalogUrlFromCode(code)
      : null;

  const label = children ?? code ?? (dept && number ? `${dept} ${number}` : "");

  if (!url) return <span className={className}>{label}</span>;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Open UCLA catalog page"
      className={`hover:underline ${className}`}
    >
      {label}
      <ExternalLinkIcon />
    </a>
  );
}

// Subtle "opens in new tab" cue. Sized in em so it scales with whatever
// font-size the link inherits, and currentColor so it picks up the link's
// text color automatically.
function ExternalLinkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="ml-[0.25em] inline-block h-[0.8em] w-[0.8em] -translate-y-[0.05em] align-middle opacity-60"
    >
      <path d="M7 17L17 7M17 7H9M17 7v8" />
    </svg>
  );
}
