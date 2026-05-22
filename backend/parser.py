"""Parse a DARS PDF into two lists consisting of classes completed and what's left to graduate.

Returns a dict with the following:
    completed: list of {term, code, units, grade, title} courses the student has taken
    in_progress: list of {term, code, units, grade, title} courses currently in progress
    remaining: list of {section, needs_raw} unfulfilled requirements, one per "NEEDS:" line

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
            out.append({
                "section": section or "(unknown)",
                "needs_raw": m.group(1).strip(),
                "eligible": _collect_select_from(lines, i),
            })
    return out


def parse_pdf(source: Union[str, Path, bytes]) -> dict:
    lines = _extract_lines(source)
    completed, in_progress = _parse_courses(lines)
    return {
        "completed": completed,
        "in_progress": in_progress,
        "remaining": _parse_remaining(lines),
    }


if __name__ == "__main__":
    import json
    import sys

    if len(sys.argv) != 2:
        print("usage: python parser.py <dars.pdf>")
        sys.exit(1)
    print(json.dumps(parse_pdf(sys.argv[1]), indent=2))
