"""Parse a DARS PDF into two lists consisting of classes completed and what's left to graduate.

Returns a dict with the following:
    completed: list of {term, code, units, grade, title} courses the student has taken
    in_progress: list of {term, code, units, grade, title} courses currently in progress
    remaining: list of {section, needs_raw, needs, eligible} unfulfilled requirements, one per "NEEDS:" line
    sections: list of {title, status, needs, completed, in_progress} per requirement category, used by the dashboard to compute fulfilled/unfulfilled percentages.

Method:
    pdfplumber gives us each word with its font + size.
    DARS uses bold-11pt for section headings and regular-9pt for body text, so we identify titles by the boldness and size.
    Much more robust than guessing with regex.
    Inside each section we use regex for the formatted course-history rows and "NEEDS:" lines.
"""

from __future__ import annotations

import re
from collections import defaultdict
from io import BytesIO
from pathlib import Path
from typing import Union

import pdfplumber

_PAGE_HEADER = re.compile(r"My Audit - Audit Results Tab")
_PAGE_FOOTER = re.compile(r"dars\.ucla\.edu")

# course-history row format as follows: TERM CODE UNITS GRADE TITLE
# Non-greedy regex
_GRADES = r"A\+|A-|A|B\+|B-|B|C\+|C-|C|D\+|D-|D|F|P|NP|S|U|IP|NR|TA|AP"
_COURSE = re.compile(
    rf"^(?P<term>(?:SP|FA|WI|SU)\d{{2}})\s+"
    rf"(?P<code>.+?)\s+"
    rf"(?P<units>\d+(?:\.\d+)?)\s+"
    rf"(?P<grade>{_GRADES})\s+"
    rf"(?P<title>.+)$"
)

_NEEDS = re.compile(r"^NEEDS:\s*(.+)$")
_SELECT = re.compile(r"^SELECT FROM:\s*(.*)$")
_NOT_FROM = re.compile(r"^->\s*NOT FROM:")

# Pieces inside a NEEDS line.
_NEEDS_UNITS = re.compile(r"(\d+(?:\.\d+)?)\s+UNITS?\b")
_NEEDS_COURSES = re.compile(r"(\d+)\s+COURSES?\b")
_NEEDS_SUBGROUPS = re.compile(r"(\d+)\s+SUB-?GROUPS?\b")
_NEEDS_GPA = re.compile(r"(\d+(?:\.\d+)?)\s+GPA\b")


def _parse_needs(raw: str) -> dict:
    """Turn a NEEDS body into structured fields. Missing keys are omitted."""
    out: dict = {}
    if m := _NEEDS_UNITS.search(raw):
        out["units"] = float(m.group(1))
    if m := _NEEDS_COURSES.search(raw):
        out["courses"] = int(m.group(1))
    if m := _NEEDS_SUBGROUPS.search(raw):
        out["sub_groups"] = int(m.group(1))
    if m := _NEEDS_GPA.search(raw):
        out["gpa"] = float(m.group(1))
    return out

# Font signature for DARS section titles: bold face at >=11pt.
_TITLE_MIN_SIZE = 11.0


def _is_title_font(word: dict) -> bool:
    return "Bold" in word["fontname"] and word["size"] >= _TITLE_MIN_SIZE


def _extract_lines(source: Union[str, Path, bytes]) -> list[dict]:
    """Return a list of {text, is_title} dicts in reading order.

    A line is a title iff every word on it uses the bold heading font and the line's letters are all uppercase
    """
    if isinstance(source, (bytes, bytearray)):
        opener = pdfplumber.open(BytesIO(source))
    else:
        opener = pdfplumber.open(source)

    lines: list[dict] = []
    with opener as pdf:
        for page in pdf.pages:
            words = page.extract_words(extra_attrs=["fontname", "size"])
            by_row: dict[int, list[dict]] = defaultdict(list)
            for w in words:
                by_row[round(w["top"])].append(w)
            for y in sorted(by_row):
                row = sorted(by_row[y], key=lambda w: w["x0"])
                text = " ".join(w["text"] for w in row)
                if _PAGE_HEADER.search(text) or _PAGE_FOOTER.search(text):
                    continue
                bold_big = all(_is_title_font(w) for w in row)
                letters = [c for c in text if c.isalpha()]
                is_title = bool(bold_big and letters and all(c.isupper() for c in letters))
                lines.append({"text": text, "is_title": is_title})
    return lines


def _parse_courses(lines: list[dict]) -> tuple[list[dict], list[dict]]:
    """Pull course-history rows out of every line, dedupe, split by status."""
    seen: set[tuple] = set()
    completed: list[dict] = []
    in_progress: list[dict] = []
    for ln in lines:
        m = _COURSE.match(ln["text"])
        if not m:
            continue
        code = m.group("code").strip()
        grade = m.group("grade")
        # Dedupe by (term, code-without-spaces, grade)
        key = (m.group("term"), re.sub(r"\s+", "", code), grade)
        if key in seen:
            continue
        seen.add(key)
        course = {
            "term": m.group("term"),
            "code": code,
            "units": float(m.group("units")),
            "grade": grade,
            "title": m.group("title").strip(),
        }
        if grade == "IP":
            in_progress.append(course)
        elif grade == "NR":
            continue 
        else:
            completed.append(course)
    return completed, in_progress


def _collect_select_from(lines: list[dict], start_idx: int) -> str:
    """After a NEEDS line, find the next SELECT FROM line and join its body
    with any wrapped continuation lines. Stops at the next requirement,
    a course-history row, or a sub-heading.

    Returns "" when there's no SELECT FROM before the next requirement
    (e.g. GPA-only or unit-total NEEDS lines)."""
    i = start_idx + 1
    while i < len(lines):
        text = lines[i]["text"]
        if lines[i]["is_title"] or _NEEDS.match(text):
            return ""
        m = _SELECT.match(text)
        if not m:
            i += 1
            continue
        parts = [m.group(1).strip()] if m.group(1).strip() else []
        j = i + 1
        while j < len(lines):
            nxt = lines[j]
            if nxt["is_title"]:
                break
            t = nxt["text"]
            if _NEEDS.match(t) or _SELECT.match(t) or _NOT_FROM.match(t):
                break
            # a course-history row means we've crossed into a new sub-block.
            if _COURSE.match(t):
                break
            # a non-bold sub-heading like "SEVEN COMPUTER SCIENCE REQUIRED COURSES"
            # (all-uppercase words, no digits) also marks a new sub-block.
            letters = [c for c in t if c.isalpha()]
            if letters and all(c.isupper() for c in letters) and not any(c.isdigit() for c in t):
                break
            parts.append(t.strip())
            j += 1
        return " ".join(parts)
    return ""


def _parse_remaining(lines: list[dict]) -> list[dict]:
    """Each NEEDS line becomes one entry. Section = most recent title above;
    eligible = the SELECT FROM body that follows."""
    out: list[dict] = []
    section = ""
    prev_was_title = False
    for i, ln in enumerate(lines):
        if ln["is_title"]:
            section = f"{section} {ln['text']}" if prev_was_title and section else ln["text"]
            prev_was_title = True
            continue
        prev_was_title = False
        m = _NEEDS.match(ln["text"])
        if m:
            raw = m.group(1).strip()
            out.append({
                "section": section or "(unknown)",
                "needs_raw": raw,
                "needs": _parse_needs(raw),
                "eligible": _collect_select_from(lines, i),
            })
    return out


# Section titles that look like headings but aren't graduation requirements
# These sections only re-list courses that already appear under their real requirement section above, so filtering them out doesn't lose any fulfillment.
_NON_REQUIREMENT_HINTS = (
    "IN PROGRESS COURSEWORK",
    "RESTRICTION",
    "AVAILABLE COURSES",
    "ADVANCED STANDING",
    "ALTERNATE ARTICULATIONS",
    "TRANSFER COURSES",
    "ACADEMIC RECORD",
    "UCLA COURSEWORK",
    "ACADEMIC RESIDENCE",
)

# Standalone titles that would be ambiguous as substrings — exact match only.
_NON_REQUIREMENT_EXACT = {
    "LOWER DIVISION COURSES",
    "UPPER DIVISION COURSES",
}


def _is_requirement_title(title: str) -> bool:
    up = title.upper().strip()
    if up in _NON_REQUIREMENT_EXACT:
        return False
    return not any(hint in up for hint in _NON_REQUIREMENT_HINTS)


def _parse_sections(lines: list[dict]) -> list[dict]:
    """Group everything under top-level section titles so the dashboard can show fulfilled vs unfulfilled categories. 
    A section is included if it has at least one NEEDS line or at least one course row."""
    sections: list[dict] = []
    by_title: dict[str, dict] = {}
    section = ""
    prev_was_title = False

    def slot(title: str) -> dict:
        if title not in by_title:
            entry = {
                "title": title,
                "needs": [],
                "completed": [],
                "in_progress": [],
            }
            by_title[title] = entry
            sections.append(entry)
        return by_title[title]

    for i, ln in enumerate(lines):
        if ln["is_title"]:
            section = f"{section} {ln['text']}" if prev_was_title and section else ln["text"]
            prev_was_title = True
            continue
        prev_was_title = False
        if not section:
            continue
        text = ln["text"]
        if m := _NEEDS.match(text):
            raw = m.group(1).strip()
            slot(section)["needs"].append({
                "needs_raw": raw,
                "needs": _parse_needs(raw),
                "eligible": _collect_select_from(lines, i),
            })
            continue
        if cm := _COURSE.match(text):
            grade = cm.group("grade")
            if grade == "NR":
                continue
            course = {
                "term": cm.group("term"),
                "code": cm.group("code").strip(),
                "units": float(cm.group("units")),
                "grade": grade,
                "title": cm.group("title").strip(),
            }
            slot(section)["in_progress" if grade == "IP" else "completed"].append(course)

    out: list[dict] = []
    for s in sections:
        if not _is_requirement_title(s["title"]):
            continue
        if not s["needs"] and not s["completed"] and not s["in_progress"]:
            continue
        if s["needs"]:
            status = "unfulfilled"
        elif s["completed"]:
            status = "fulfilled"
        elif s["in_progress"]:
            status = "in_progress"
        else:
            continue
        out.append({**s, "status": status})
    return out


def parse_pdf(source: Union[str, Path, bytes]) -> dict:
    lines = _extract_lines(source)
    completed, in_progress = _parse_courses(lines)
    return {
        "completed": completed,
        "in_progress": in_progress,
        "remaining": _parse_remaining(lines),
        "sections": _parse_sections(lines),
    }


if __name__ == "__main__":
    import json
    import sys

    if len(sys.argv) != 2:
        print("usage: python parser.py <dars.pdf>")
        sys.exit(1)
    print(json.dumps(parse_pdf(sys.argv[1]), indent=2))
