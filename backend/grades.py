"""Load UCLA CPRA grade-distribution data and aggregate it per course.

Four academic-year exports live gzipped in data/grades/.
Each source row is a tally of how many students earned one grade in one (term, course, section, instructor).
We sum those tallies to build, per course, an overall grade distribution plus per-instructor and per-term breakdowns, 
each carrying an average GPA computed from the letter grades only.
"""

from __future__ import annotations

import csv
import gzip
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Optional, Union

# 4.0 scale. Only these count toward GPA
GPA_POINTS: dict[str, float] = {
    "A+": 4.0, "A": 4.0, "A-": 3.7,
    "B+": 3.3, "B": 3.0, "B-": 2.7,
    "C+": 2.3, "C": 2.0, "C-": 1.7,
    "D+": 1.3, "D": 1.0, "D-": 0.7,
    "F": 0.0,
}

# Order grades are presented in a distribution (known grades first, best to worst).
GRADE_DISPLAY_ORDER = [
    "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F",
    "P", "NP", "S", "U", "I", "IP", "NR", "DR", "NC", "R",
]

_DATA_DIR = Path(__file__).resolve().parent / "data" / "grades"

# Each schema maps our internal field name to that file's column header.
_SCHEMAS = [
    {
        "detect": "enrl_term_cd",
        "term": "enrl_term_cd", "dept": "subj_area_cd", "number": "disp_catlg_no",
        "section": "disp_sect_no", "grade": "grd_cd", "count": "num_grd",
        "instructor": "instr_nm", "title": "crs_long_ttl",
    },
    {
        "detect": "ENROLLMENT TERM",
        "term": "ENROLLMENT TERM", "dept": "SUBJECT AREA", "number": "CATLG NBR",
        "section": "SECT NBR", "grade": "GRD OFF", "count": "GRD COUNT",
        "instructor": "INSTR NAME", "title": "LONG CRSE TITLE",
    },
]

_TERM_LETTER = {"F": ("Fall", 4), "W": ("Winter", 1), "S": ("Spring", 2)}
_LETTER_TERM = re.compile(r"^(\d{2})([FWS])$")
_SUMMER_TERM = re.compile(r"^(\d{2})([12])$")


def decode_term(code: str) -> dict:
    """Turn a raw term code into {code, year, quarter, label, sort}.

    sort is an int that orders terms chronologically (Winter<Spring<Summer<Fall
    within a year). Unrecognized codes pass through with year/quarter None."""
    code = code.strip().upper()
    if m := _LETTER_TERM.match(code):
        yy, letter = m.groups()
        name, order = _TERM_LETTER[letter]
        year = 2000 + int(yy)
        return {"code": code, "year": year, "quarter": name,
                "label": f"{name} {year}", "sort": year * 10 + order}
    if m := _SUMMER_TERM.match(code):
        yy, sess = m.groups()
        year = 2000 + int(yy)
        return {"code": code, "year": year, "quarter": "Summer",
                "label": f"Summer {year} Session {sess}", "sort": year * 10 + 3}
    return {"code": code, "year": None, "quarter": None, "label": code, "sort": 0}


def normalize_dept(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().upper())


def normalize_number(value: str) -> str:
    return value.strip().upper()


_DIGITS = re.compile(r"\d+")


def _numeric(number: str) -> Optional[int]:
    """Numeric part of a catalog number."""
    m = _DIGITS.search(number)
    return int(m.group()) if m else None


def compute_stats(counts: Counter) -> dict:
    """Summarize a grade Counter into avg GPA, totals, and an ordered distribution."""
    total = sum(counts.values())
    points = 0.0
    graded = 0
    for grade, n in counts.items():
        if grade in GPA_POINTS:
            points += GPA_POINTS[grade] * n
            graded += n
    distribution: dict[str, int] = {}
    for grade in GRADE_DISPLAY_ORDER:
        if counts.get(grade):
            distribution[grade] = counts[grade]
    for grade, n in counts.items():  # any unexpected grade codes, appended as-is
        if grade not in distribution:
            distribution[grade] = n
    return {
        "avg_gpa": round(points / graded, 3) if graded else None,
        "total": total,
        "graded": graded,
        "distribution": distribution,
    }


class _CourseAgg:
    __slots__ = ("dept", "number", "title", "overall", "by_instructor", "by_term")

    def __init__(self, dept: str, number: str):
        self.dept = dept
        self.number = number
        self.title = ""
        self.overall: Counter = Counter()
        self.by_instructor: dict[str, Counter] = defaultdict(Counter)
        self.by_term: dict[str, Counter] = defaultdict(Counter)

    def add(self, instructor: str, term: str, grade: str, count: int, title: str):
        self.overall[grade] += count
        if instructor:
            self.by_instructor[instructor][grade] += count
        self.by_term[term][grade] += count
        if title and not self.title:
            self.title = title

    def render(self) -> dict:
        instructors = [
            {"instructor": name, **compute_stats(counts)}
            for name, counts in self.by_instructor.items()
        ]
        # Best average GPA first and no graded students sink to the bottom.
        instructors.sort(key=lambda r: (r["avg_gpa"] is not None, r["avg_gpa"] or 0), reverse=True)
        terms = [
            {"term": code, "label": decode_term(code)["label"],
             "sort": decode_term(code)["sort"], **compute_stats(counts)}
            for code, counts in self.by_term.items()
        ]
        terms.sort(key=lambda r: r["sort"])
        for t in terms:
            del t["sort"]
        return {
            "dept": self.dept,
            "number": self.number,
            "title": self.title,
            "overall": compute_stats(self.overall),
            "by_instructor": instructors,
            "by_term": terms,
        }


class GradeData:
    """Aggregated grade distributions keyed by (dept, number)."""

    def __init__(self) -> None:
        self._courses: dict[tuple[str, str], _CourseAgg] = {}
        self._by_dept: Optional[dict[str, list[str]]] = None

    def _slot(self, dept: str, number: str) -> _CourseAgg:
        key = (dept, number)
        agg = self._courses.get(key)
        if agg is None:
            agg = _CourseAgg(dept, number)
            self._courses[key] = agg
        return agg

    def course(self, dept: str, number: str) -> Optional[dict]:
        """Story #3: full distribution for one course, or None if unknown."""
        agg = self._courses.get((normalize_dept(dept), normalize_number(number)))
        return agg.render() if agg else None

    def search(self, query: str, limit: int = 25) -> list[dict]:
        """Lightweight lookup by 'DEPT NUMBER' or partial title; lightweight rows."""
        q = query.strip().upper()
        if not q:
            return []
        rows = []
        for (dept, number), agg in self._courses.items():
            code = f"{dept} {number}"
            if q in code or q in agg.title.upper():
                stats = compute_stats(agg.overall)
                rows.append({
                    "dept": dept, "number": number, "title": agg.title,
                    "avg_gpa": stats["avg_gpa"], "total": stats["total"],
                })
        rows.sort(key=lambda r: (q not in f"{r['dept']} {r['number']}", -(r["total"])))
        return rows[:limit]

    def _dept_numbers(self, dept: str) -> list[str]:
        """All catalog numbers we have data for in a department (cached)."""
        if self._by_dept is None:
            by_dept: dict[str, list[str]] = defaultdict(list)
            for (d, n) in self._courses:
                by_dept[d].append(n)
            self._by_dept = by_dept
        return self._by_dept.get(dept, [])

    def _resolve(self, dept: str, raw_number: str) -> list[tuple[str, str]]:
        """Resolve one eligible entry to the (dept, number) keys we actually have."""
        raw = raw_number.strip().upper()
        if re.search(r"[-–—]", raw):
            lo, hi = re.split(r"[-–—]", raw, maxsplit=1)
            lo_n, hi_n = _numeric(lo), _numeric(hi)
            if lo_n is None or hi_n is None:
                return []
            if lo_n > hi_n:
                lo_n, hi_n = hi_n, lo_n
            return [
                (dept, n) for n in self._dept_numbers(dept)
                if (v := _numeric(n)) is not None and lo_n <= v <= hi_n
            ]
        number = normalize_number(raw)
        return [(dept, number)] if (dept, number) in self._courses else []

    def recommend(self, groups: list[dict], limit: int = 5) -> dict:
        """Rank eligible courses for a requirement by historical average GPA."""
        candidates: dict[tuple[str, str], _CourseAgg] = {}
        for g in groups:
            dept = normalize_dept(g.get("dept", ""))
            if not dept:
                continue
            for raw in g.get("numbers", []):
                for key in self._resolve(dept, raw):
                    candidates[key] = self._courses[key]

        rows = []
        for (dept, number), agg in candidates.items():
            stats = compute_stats(agg.overall)
            rows.append({
                "dept": dept,
                "number": number,
                "title": agg.title,
                "avg_gpa": stats["avg_gpa"],
                "graded": stats["graded"],
                "total": stats["total"],
            })
        # Best GPA first; courses with no letter grades sink to the bottom.
        rows.sort(key=lambda r: (r["avg_gpa"] is not None, r["avg_gpa"] or 0), reverse=True)
        return {"total_with_data": len(rows), "courses": rows[:limit]}

    @property
    def course_count(self) -> int:
        return len(self._courses)


def _iter_rows(path: Path):
    with gzip.open(path, mode="rt", encoding="utf-8", errors="replace", newline="") as fh:
        reader = csv.DictReader(fh)
        fields = set(reader.fieldnames or [])
        schema = next((s for s in _SCHEMAS if s["detect"] in fields), None)
        if schema is None:
            raise ValueError(f"{path.name}: unrecognized grade-data schema")
        for raw in reader:
            yield schema, raw


def load(data_dir: Union[str, Path, None] = None) -> GradeData:
    """Read every grades_*.csv.gz under data_dir into a GradeData index."""
    directory = Path(data_dir) if data_dir else _DATA_DIR
    files = sorted(directory.glob("grades_*.csv.gz"))
    if not files:
        raise FileNotFoundError(f"no grades_*.csv.gz found in {directory}")

    data = GradeData()
    for path in files:
        for schema, raw in _iter_rows(path):
            dept = normalize_dept(raw[schema["dept"]])
            number = normalize_number(raw[schema["number"]])
            grade = raw[schema["grade"]].strip().upper()
            count_raw = raw[schema["count"]].strip()
            if not dept or not number or not grade or not count_raw:
                continue
            try:
                count = int(count_raw)
            except ValueError:
                continue
            data._slot(dept, number).add(
                instructor=raw[schema["instructor"]].strip(),
                term=raw[schema["term"]].strip(),
                grade=grade,
                count=count,
                title=raw[schema["title"]].strip(),
            )
    return data


# Lazy module-level singleton so the server loads the data once.
_SINGLETON: Optional[GradeData] = None


def get_grade_data() -> GradeData:
    global _SINGLETON
    if _SINGLETON is None:
        _SINGLETON = load()
    return _SINGLETON


if __name__ == "__main__":
    import json
    import sys

    gd = load()
    if len(sys.argv) >= 3:
        dept, number = sys.argv[1], sys.argv[2]
        result = gd.course(dept, number)
        print(json.dumps(result, indent=2) if result else f"no data for {dept} {number}")
    else:
        print(f"loaded {gd.course_count} courses")
        print("usage: python grades.py <DEPT> <NUMBER>   e.g. python grades.py 'COM SCI' 31")
