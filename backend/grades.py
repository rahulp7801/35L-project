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

# Catalog-number ranges per academic level. Half-open [lo, hi).
# The browse() filter uses the numeric portion of the catalog number,
# so suffixes like 'M152A' or 'C111' map to 152 and 111 respectively.
_LEVELS: dict[str, tuple[int, int]] = {
    "lower": (0, 100),
    "upper": (100, 200),
    "graduate": (200, 10_000),
}


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
        # Both indexes are lazy: built on first access, reused thereafter.
        self._by_dept: Optional[dict[str, list[str]]] = None
        self._by_instructor: Optional[dict[str, list[tuple[str, str]]]] = None
        # Latest calendar year observed across all terms; computed once.
        self._latest_year: Optional[int] = None

    def latest_year(self) -> Optional[int]:
        """Most recent calendar year present in any term across the dataset.

        Used as the anchor for "recent" season windows so we don't count a
        course as Fall-offered just because it ran in Fall 2014."""
        if self._latest_year is None:
            best = 0
            for agg in self._courses.values():
                for term in agg.by_term:
                    y = decode_term(term)["year"]
                    if y and y > best:
                        best = y
            self._latest_year = best or None
        return self._latest_year

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

    def course_overview(self, dept: str, number: str) -> Optional[dict]:
        """Lightweight per-course stats: avg GPA + counts only, no instructor or
        term breakdowns. Used by batch lookups (e.g. the dashboard's
        comparison card) where we'd otherwise pay for per-course renderings
        that just get discarded."""
        agg = self._courses.get((normalize_dept(dept), normalize_number(number)))
        if agg is None:
            return None
        stats = compute_stats(agg.overall)
        return {
            "dept": agg.dept, "number": agg.number, "title": agg.title,
            "avg_gpa": stats["avg_gpa"],
            "graded": stats["graded"], "total": stats["total"],
        }

    def course_planning(
        self,
        dept: str,
        number: str,
        top_instructors: int = 2,
        min_graded_for_instructor: int = 50,
    ) -> Optional[dict]:
        """Planner-friendly per-course rollup.

        Returns avg GPA, the set of quarters this course has historically been
        offered in (used as a soft "offered in season X" signal), and the top-N
        instructors by avg GPA among those with enough graded students to be a
        meaningful signal (small samples sort by luck, not difficulty).

        Returns None when the course isn't in the dataset; the planner falls
        back to a no-data placeholder so the candidate still appears in the
        recommendation, just deprioritized."""
        agg = self._courses.get((normalize_dept(dept), normalize_number(number)))
        if agg is None:
            return None
        overall = compute_stats(agg.overall)
        # Only count offerings from the most recent 2 academic years in the
        # dataset, so the "Offered: …" signal reflects what's actually being
        # taught now rather than what ran a decade ago. min_year is inclusive.
        latest = self.latest_year()
        min_year = (latest - 1) if latest is not None else None
        seasons_seen: set[str] = set()
        for term in agg.by_term:
            decoded = decode_term(term)
            if not decoded["quarter"]:
                continue
            if min_year is not None and (decoded["year"] or 0) < min_year:
                continue
            seasons_seen.add(decoded["quarter"])
        season_order = ["Fall", "Winter", "Spring", "Summer"]
        seasons = [s for s in season_order if s in seasons_seen]
        instructors: list[dict] = []
        for name, counts in agg.by_instructor.items():
            stats = compute_stats(counts)
            if (
                stats["avg_gpa"] is not None
                and stats["graded"] >= min_graded_for_instructor
            ):
                instructors.append({
                    "instructor": name,
                    "avg_gpa": stats["avg_gpa"],
                    "graded": stats["graded"],
                })
        instructors.sort(key=lambda r: r["avg_gpa"], reverse=True)
        return {
            "dept": agg.dept,
            "number": agg.number,
            "title": agg.title,
            "avg_gpa": overall["avg_gpa"],
            "graded": overall["graded"],
            "seasons": seasons,
            "top_instructors": instructors[:top_instructors],
        }

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

    def _ensure_by_dept(self) -> dict[str, list[str]]:
        """Build the dept → catalog-numbers index on first access."""
        if self._by_dept is None:
            by_dept: dict[str, list[str]] = defaultdict(list)
            for (d, n) in self._courses:
                by_dept[d].append(n)
            self._by_dept = by_dept
        return self._by_dept

    def _dept_numbers(self, dept: str) -> list[str]:
        """All catalog numbers we have data for in a department (cached)."""
        return self._ensure_by_dept().get(dept, [])

    def _ensure_by_instructor(self) -> dict[str, list[tuple[str, str]]]:
        """Build the instructor → list of (dept, number) keys on first access.

        Each _CourseAgg already tallies by_instructor, so this index is just an
        inversion: for every (dept, number) we record which instructors taught
        it, then flip the relation."""
        if self._by_instructor is None:
            idx: dict[str, list[tuple[str, str]]] = defaultdict(list)
            for key, agg in self._courses.items():
                for instructor in agg.by_instructor:
                    idx[instructor].append(key)
            self._by_instructor = idx
        return self._by_instructor

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

    def departments(self) -> list[str]:
        """Sorted list of every department code present in the data."""
        return sorted(self._ensure_by_dept().keys())

    def browse(
        self,
        dept: Optional[str] = None,
        min_gpa: Optional[float] = None,
        level: Optional[str] = None,
        limit: int = 50,
    ) -> list[dict]:
        """Filter courses by department, level, and minimum average GPA.

        Args:
            dept: optional department code, normalized before comparison.
            min_gpa: optional inclusive floor on the course's overall avg GPA.
                Courses with no letter grades (avg_gpa is None) are excluded
                whenever this filter is set.
            level: optional one of 'lower' (catalog # 0-99), 'upper' (100-199),
                or 'graduate' (200+). Inferred from the numeric portion of the
                catalog number, so 'M152A' counts as upper.
            limit: maximum rows to return.

        Rows are ranked by avg GPA descending; courses with no letter grades
        sink to the bottom (matched the behavior of recommend()).
        """
        dept_norm = normalize_dept(dept) if dept else None
        bounds = _LEVELS.get(level) if level else None
        rows: list[dict] = []
        for (d, n), agg in self._courses.items():
            if dept_norm and d != dept_norm:
                continue
            if bounds is not None:
                num = _numeric(n)
                if num is None or not (bounds[0] <= num < bounds[1]):
                    continue
            stats = compute_stats(agg.overall)
            if min_gpa is not None and (
                stats["avg_gpa"] is None or stats["avg_gpa"] < min_gpa
            ):
                continue
            rows.append({
                "dept": d, "number": n, "title": agg.title,
                "avg_gpa": stats["avg_gpa"],
                "graded": stats["graded"], "total": stats["total"],
            })
        rows.sort(key=lambda r: (r["avg_gpa"] is not None, r["avg_gpa"] or 0), reverse=True)
        return rows[:limit]

    def instructor_search(self, query: str, limit: int = 25) -> list[dict]:
        """Substring search over instructor names. Lightweight rows for autocomplete.

        Names in the CPRA data are uppercase 'LAST, FIRST M' — the same format
        we store. Match is case-insensitive substring. Rows whose name starts
        with the query rank above pure substring matches; ties break on total
        students taught (most-experienced first)."""
        q = query.strip().upper()
        if not q:
            return []
        rows: list[dict] = []
        for name, keys in self._ensure_by_instructor().items():
            if q not in name:
                continue
            overall: Counter = Counter()
            for key in keys:
                overall.update(self._courses[key].by_instructor[name])
            stats = compute_stats(overall)
            rows.append({
                "instructor": name,
                "course_count": len(keys),
                "avg_gpa": stats["avg_gpa"],
                "graded": stats["graded"],
                "total": stats["total"],
            })
        rows.sort(key=lambda r: (not r["instructor"].startswith(q), -r["total"]))
        return rows[:limit]

    def instructor(self, name: str) -> Optional[dict]:
        """Every course taught by `name`, with per-course stats and a career aggregate.

        Match is case-insensitive equality against the stored 'LAST, FIRST M'
        form. Returns None when the instructor isn't in our data."""
        target = name.strip().upper()
        index = self._ensure_by_instructor()
        keys = index.get(target)
        if keys is None:
            return None
        courses: list[dict] = []
        overall: Counter = Counter()
        for (dept, number) in keys:
            agg = self._courses[(dept, number)]
            per_course = agg.by_instructor.get(target, Counter())
            overall.update(per_course)
            stats = compute_stats(per_course)
            courses.append({
                "dept": dept, "number": number, "title": agg.title,
                "avg_gpa": stats["avg_gpa"],
                "graded": stats["graded"], "total": stats["total"],
                "distribution": stats["distribution"],
            })
        # Best GPA first; courses with no letter grades sink to the bottom.
        courses.sort(key=lambda r: (r["avg_gpa"] is not None, r["avg_gpa"] or 0), reverse=True)
        return {
            "instructor": target,
            "course_count": len(courses),
            "overall": compute_stats(overall),
            "courses": courses,
        }

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
