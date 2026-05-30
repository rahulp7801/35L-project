import type { Needs } from "./types";

export function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

export function describeNeed(n: Needs): string[] {
  const out: string[] = [];
  if (n.courses) out.push(`${n.courses} course${n.courses === 1 ? "" : "s"}`);
  if (n.units) out.push(`${n.units.toFixed(1)} units`);
  if (n.sub_groups) out.push(`${n.sub_groups} sub-group${n.sub_groups === 1 ? "" : "s"}`);
  if (n.gpa) out.push(`${n.gpa.toFixed(3)} GPA`);
  return out;
}
