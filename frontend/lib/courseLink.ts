// URL builder for UCLA registrar catalog pages.
//
// Pattern (verified against the live catalog):
//   https://catalog.registrar.ucla.edu/course/{year}/{slug}?siteYear={year}
//
// Slug rule: concatenate dept + number, lowercase, strip every non-alphanumeric
// character. Confirmed for "COM SCI 31" -> "comsci31" and "MATH 32A" ->
// "math32a". Catalog year is the UCLA academic-year identifier; bump this
// constant when UCLA publishes a newer catalog.

import { splitCourseCode } from "./stats";

export const CATALOG_YEAR = 2024;

const BASE = "https://catalog.registrar.ucla.edu/course";

function slug(dept: string, number: string): string {
  return (dept + number).toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function courseCatalogUrl(dept: string, number: string): string {
  return `${BASE}/${CATALOG_YEAR}/${slug(dept, number)}?siteYear=${CATALOG_YEAR}`;
}

// Convenience for callers that only have the DARS-style joined code string
// (e.g. "COM SCI 31"). Returns null when the code can't be split — callers
// use that to render a plain span instead of a broken link.
export function courseCatalogUrlFromCode(code: string): string | null {
  const parts = splitCourseCode(code);
  if (!parts) return null;
  return courseCatalogUrl(parts.dept, parts.number);
}
