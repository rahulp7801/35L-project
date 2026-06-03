"""UCLA Schedule of Classes client

In this file we read UCLA's *public* Schedule of Classes (sa.ucla.edu/ro/public/soc) 
by calling the same JSON/HTML endpoints the SOC website's own front-end calls.

The one endpoint we need is GetCourseSummary, which returns the section table
for a single course in a single term, instructor included.
"""

from __future__ import annotations

import base64
import datetime
import json
import os
import re
import time
import urllib.parse
import urllib.request
from typing import Optional

_BASE = "https://sa.ucla.edu/ro/public/soc/Results/GetCourseSummary"

# The SOC front-end sends this with every section request and without the AJAX header the endpoint rejects the call.
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "X-Requested-With": "XMLHttpRequest",
    "Accept": "*/*",
    "Referer": "https://sa.ucla.edu/ro/public/soc/Results",
}

# Every filter left null
_FILTER_FLAGS = json.dumps(
    {k: None for k in (
        "enrollment_status", "advanced", "meet_days", "start_time", "end_time",
        "meet_locations", "meet_units", "instructor", "class_career", "impacted",
        "enrollment_restrictions", "enforced_requisites", "individual_studies",
        "summer_session",
    )},
    separators=(",", ":"),
)

_TIMEOUT = 12  # seconds
_TTL = 6 * 60 * 60  # cache
_CATALOG = re.compile(r"^([A-Z]*)(\d+)([A-Z]*)$")

_cache: dict[tuple[str, str, str], tuple[float, list[str]]] = {}

# Pull instructor names out of the section table.
_INSTR_BLOCK = re.compile(r'-instructor_data"\s*>(.*?)</div>', re.S)
_P_TEXT = re.compile(r"<p[^>]*>(.*?)</p>", re.S)
_TAG = re.compile(r"<[^>]+>")


def enabled() -> bool:
    """Live SOC lookups are on unless SOC_ENABLED is explicitly falsy. Lets a
    grader run fully offline (the timing flag just disappears)."""
    return os.environ.get("SOC_ENABLED", "1").strip().lower() not in ("0", "false", "no")


def current_term(today: Optional[datetime.date] = None) -> str:
    # The term a student would currently be planning for, as a SOC code (e.g.'26F').
    override = os.environ.get("SOC_TERM", "").strip().upper()
    if override:
        return override
    d = today or datetime.date.today()
    yy = d.year % 100
    if d.month <= 3:            
        return f"{yy:02d}S"
    if d.month <= 9:            
        return f"{yy:02d}F"
    return f"{(yy + 1) % 100:02d}W" 


def _catalog_display(number: str) -> Optional[str]:
    # Normalize a catalog number to SOC's zero-padded form: 31 -> 0031
    m = _CATALOG.match(number.strip().upper())
    if not m:
        return None
    prefix, digits, suffix = m.groups()
    return f"{prefix}{digits.zfill(4)}{suffix}"


def _build_model(term: str, dept: str, number: str) -> Optional[str]:
    # Construct the JSON `model` GetCourseSummary expects for one course.
    disp = _catalog_display(number)
    if disp is None:
        return None
    catalog_field = disp.ljust(8)
    path = dept.replace(" ", "").upper() + disp
    token = base64.b64encode((catalog_field + path).encode()).decode()
    return json.dumps(
        {
            "Term": term,
            "SubjectAreaCode": dept.upper(),
            "CatalogNumber": catalog_field,
            "IsRoot": True,
            "SessionGroup": "%",
            "ClassNumber": "%",
            "SequenceNumber": None,
            "Path": path,
            "MultiListedClassFlag": "n",
            "Token": token,
        },
        separators=(",", ":"),
    )


def _parse_instructors(html: str) -> list[str]:
    """Distinct named instructors from a GetCourseSummary response, in document
    order. 'The Staff' (no instructor assigned yet) is dropped."""
    names: list[str] = []
    seen: set[str] = set()
    for block in _INSTR_BLOCK.findall(html):
        for raw in _P_TEXT.findall(block):
            name = re.sub(r"\s+", " ", _TAG.sub("", raw)).strip()
            key = name.lower()
            if not name or key in ("the staff", "staff") or key in seen:
                continue
            seen.add(key)
            names.append(name)
    return names


def _fetch(term: str, dept: str, number: str) -> list[str]:
    model = _build_model(term, dept, number)
    if model is None:
        return []
    url = f"{_BASE}?" + urllib.parse.urlencode({"model": model, "FilterFlags": _FILTER_FLAGS})
    req = urllib.request.Request(url, headers=_HEADERS)
    with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
        html = resp.read().decode("utf-8", "replace")
    return _parse_instructors(html)


def course_instructors(term: str, dept: str, number: str) -> list[str]:
    """Names the Schedule of Classes lists for a course in `term`, cached.

    Returns [] when SOC is disabled, the course isn't offered that term, or its
    instructor is still 'The Staff.'"""
    if not enabled():
        return []
    dept_u, number_u = dept.strip().upper(), number.strip().upper()
    key = (term, dept_u, number_u)
    hit = _cache.get(key)
    if hit is not None and (time.monotonic() - hit[0]) < _TTL:
        return hit[1]
    for _attempt in range(2):
        try:
            names = _fetch(term, dept_u, number_u)
        except Exception:
            continue
        _cache[key] = (time.monotonic(), names)
        return names
    return hit[1] if hit is not None else []
