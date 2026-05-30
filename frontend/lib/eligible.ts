// Parse a DARS "SELECT FROM" body into department-grouped course lists.
//
// Real eligible strings look like
//   "COM SCI 111 TO 187,188(FA21-9999),C111 TO C174 STATS 100A OR C&EE 110"
// so the tokenizer has to handle: parenthetical date ranges, multi-letter
// prefixes/suffixes (M152A, 165EW, 113DA), ampersands in dept names (C&EE),
// single-letter tokens in multi-word dept names (AN N EA), connector words
// (OR/TO/AND), and number ranges like "111 TO 187".

export type EligibleGroup = { dept: string; numbers: string[] };

const DEPT_TOKEN = /^[A-Z][A-Z&]*$/;
const NUMBER_TOKEN = /^[A-Z]*\d+[A-Z]*(?:\([^)]*\))?$/;

// Words that appear between depts/numbers but are not themselves either.
// Encountering one means "the next dept token starts a new department".
const CONNECTORS = new Set([
  "TO",
  "OR",
  "AND",
  "OF",
  "FROM",
  "NOT",
  "ONE",
  "THROUGH",
]);

function normalizeNumber(raw: string): string {
  // Drop parenthetical metadata (date ranges, alternate-articulation hints)
  // and strip leading zeros from the numeric portion.
  const stripped = raw.replace(/\([^)]*\)/g, "");
  const m = stripped.match(/^([A-Z]*)0*(\d+[A-Z]*)$/);
  return m ? m[1] + m[2] : stripped;
}

export function parseEligible(raw: string): EligibleGroup[] {
  if (!raw) return [];
  const tokens = raw.replace(/,/g, " ").split(/\s+/).filter(Boolean);

  const byDept = new Map<string, string[]>();
  let dept: string[] = [];
  let pendingReset = false;

  function pushNumber(num: string) {
    const key = dept.join(" ");
    const list = byDept.get(key);
    if (!list) {
      byDept.set(key, [num]);
    } else if (!list.includes(num)) {
      list.push(num);
    }
  }

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (CONNECTORS.has(t)) {
      pendingReset = true;
      continue;
    }

    if (DEPT_TOKEN.test(t)) {
      if (pendingReset) {
        dept = [];
        pendingReset = false;
      }
      dept.push(t);
      continue;
    }

    if (NUMBER_TOKEN.test(t) && dept.length > 0) {
      let num = normalizeNumber(t);
      // Detect "N TO M" range and collapse to a single "N–M" entry.
      const next = tokens[i + 1];
      const after = tokens[i + 2];
      if (next === "TO" && after && NUMBER_TOKEN.test(after)) {
        num = `${num}–${normalizeNumber(after)}`;
        i += 2;
      }
      pushNumber(num);
      pendingReset = true;
      continue;
    }

    // Punctuation, label fragments (NON-LAB, LAB/DEM, ":"), truncated tails.
    // Treat as a hard break in the dept→number flow.
    pendingReset = true;
  }

  return Array.from(byDept, ([dept, numbers]) => ({ dept, numbers }));
}

export function countCourses(groups: EligibleGroup[]): number {
  return groups.reduce((sum, g) => sum + g.numbers.length, 0);
}
