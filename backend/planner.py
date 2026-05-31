"""Multi-quarter course recommendation engine.

Given a student's outstanding DARS requirements + their completed/in-progress
list + a pace estimate, propose a quarter-by-quarter set of courses that:

1. Fulfills every outstanding requirement
2. Maximizes historical avg GPA among eligible options
3. Splits each quarter into a first-pass batch (capped at 10 units by default
   to mirror UCLA's first-pass cap) and a second-pass batch (fills the rest of
   the quarter up to a target pace)
4. Prioritizes courses by *scarcity* — a course that's one of only a few
   eligible options for its requirement is treated as more urgent than a
   course from a 30-option pool, because the user has less flexibility there.

This is intentionally a heuristic, not an optimizer. It does NOT model
prerequisites, registration caps, or actual offering schedules — only the
quarter-season signal the grades dataset can support. Output ships with a
disclaimer; the UI surfaces it.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional

from grades import GradeData, normalize_dept, normalize_number

# Defaults applied when the caller doesn't specify. The cap mirrors UCLA's
# College of L&S first-pass cap; HSSEAS uses 11. The caller can override.
DEFAULT_FIRST_PASS_CAP = 10.0
DEFAULT_MAX_QUARTERS = 8
DEFAULT_MIN_UNITS = 12.0
DEFAULT_MAX_UNITS = 22.0
DEFAULT_PACE_UNITS = 16.0
DEFAULT_TYPICAL_UNITS = 4.0
DEFAULT_INCLUDE_SUMMER = False

# UCLA DARS uses a "season-code + 2-digit calendar year" term format (e.g.
# "FA24" = Fall 2024). Different from CPRA's "24F", so we keep a local parser
# rather than re-using decode_term().
_DARS_CODE_TO_SEASON = {"WI": "Winter", "SP": "Spring", "SU": "Summer", "FA": "Fall"}
_SEASON_TO_DARS_CODE = {v: k for k, v in _DARS_CODE_TO_SEASON.items()}


def parse_dars_term(code: str) -> Optional[tuple[int, str]]:
    """Parse 'FA23' into (2023, 'Fall'). Returns None on malformed input."""
    code = code.strip().upper()
    if len(code) != 4:
        return None
    season = _DARS_CODE_TO_SEASON.get(code[:2])
    yy = code[2:]
    if season is None or not yy.isdigit():
        return None
    return (2000 + int(yy), season)


def format_dars_term(year: int, season: str) -> str:
    return f"{_SEASON_TO_DARS_CODE[season]}{year % 100:02d}"


def advance_term(year: int, season: str, include_summer: bool) -> tuple[int, str]:
    """Next quarter after (year, season). Fall rolls into next calendar year's
    Winter; Summer is skipped unless include_summer is True."""
    if season == "Fall":
        return (year + 1, "Winter")
    if season == "Winter":
        return (year, "Spring")
    if season == "Spring":
        return (year, "Summer") if include_summer else (year, "Fall")
    if season == "Summer":
        return (year, "Fall")
    raise ValueError(f"unknown season: {season!r}")


def format_term_label(year: int, season: str) -> str:
    return f"{season} {year}"


def estimate_courses_needed(needs: dict) -> int:
    """Best-effort count of how many more courses a NEEDS line takes.

    DARS NEEDS lines come in a few flavors:
      - NEEDS: 2 COURSES  -> the count itself
      - NEEDS: 8 UNITS    -> estimated from units / typical course size
      - NEEDS: 1 SUB-GROUPS -> one course per subgroup (rough)
      - NEEDS: 3.0 GPA    -> GPA-only, no courses to pick
    Returns 0 when no course pick is implied; the planner skips those reqs."""
    if "courses" in needs:
        return int(needs["courses"])
    if "sub_groups" in needs:
        return int(needs["sub_groups"])
    if "units" in needs:
        return max(1, math.ceil(needs["units"] / DEFAULT_TYPICAL_UNITS))
    return 0


# Used when a candidate course isn't in the grades dataset. We still include
# it so the recommendation is requirement-complete; just deprioritize.
def _no_data_info(dept: str, number: str) -> dict:
    return {
        "dept": dept, "number": number, "title": "",
        "avg_gpa": None, "graded": 0, "seasons": [], "top_instructors": [],
    }


@dataclass
class _ReqState:
    title: str
    needed: int
    satisfied: int = 0
    # Indexes (into the candidates list) eligible to satisfy this requirement.
    eligible_keys: set[tuple[str, str]] = field(default_factory=set)

    @property
    def remaining(self) -> int:
        return max(0, self.needed - self.satisfied)


def _pick_assignment(
    candidate_reqs: list[int], reqs: list[_ReqState]
) -> Optional[int]:
    """Choose which still-open requirement to attribute a course to.

    A course can sit in multiple requirements' eligible pools. We always credit
    it to the one with the highest scarcity (smallest remaining slack), so
    requirements with few options get satisfied first."""
    open_indexes = [i for i in candidate_reqs if reqs[i].remaining > 0]
    if not open_indexes:
        return None
    # Scarcity = remaining / |eligible still available for that req|.
    # Smaller pool -> higher scarcity -> picked first.
    return max(
        open_indexes,
        key=lambda i: reqs[i].remaining / max(1, len(reqs[i].eligible_keys)),
    )


def _scarcity_score(req_index: int, reqs: list[_ReqState]) -> float:
    r = reqs[req_index]
    if r.remaining <= 0:
        return 0.0
    # Bigger when there's less slack between need and available pool.
    return r.remaining / max(1, len(r.eligible_keys))


def _candidate_priority(
    candidate_reqs: list[int],
    reqs: list[_ReqState],
    avg_gpa: Optional[float],
) -> float:
    """Combined priority score. Scarcity dominates; GPA breaks ties."""
    open_reqs = [i for i in candidate_reqs if reqs[i].remaining > 0]
    if not open_reqs:
        return -math.inf
    scarcity = max(_scarcity_score(i, reqs) for i in open_reqs)
    gpa = avg_gpa if avg_gpa is not None else 2.0
    # Scarcity weighted heavily; GPA is a tie-breaker on the [0, 4] scale.
    return scarcity * 10.0 + gpa


def _season_compatible(course_seasons: list[str], current_season: str) -> bool:
    """True if the course has historically been offered in this season — or
    if we have no offering history (in which case we don't penalize it)."""
    return not course_seasons or current_season in course_seasons


@dataclass
class PlannerConfig:
    pace_units: float = DEFAULT_PACE_UNITS
    max_quarters: int = DEFAULT_MAX_QUARTERS
    first_pass_cap: float = DEFAULT_FIRST_PASS_CAP
    min_units: float = DEFAULT_MIN_UNITS
    max_units: float = DEFAULT_MAX_UNITS
    include_summer: bool = DEFAULT_INCLUDE_SUMMER
    typical_units: float = DEFAULT_TYPICAL_UNITS


def plan(
    data: GradeData,
    requirements: list[dict],
    excluded: list[dict],
    start_year: int,
    start_season: str,
    config: Optional[PlannerConfig] = None,
) -> dict:
    """Run the recommendation engine.

    `requirements` is the list of outstanding DARS sections. Each entry is
        {"title": str, "needs": {...}, "candidates": [{"dept", "number"}, ...]}
    `excluded` is the list of courses already taken or in-progress.
    """
    cfg = config or PlannerConfig()

    excluded_set = {
        (normalize_dept(c["dept"]), normalize_number(c["number"]))
        for c in excluded
    }

    # candidates: keyed (dept_norm, number_norm). Each entry stores the
    # planner info + the requirement-indexes it can satisfy.
    candidates: dict[tuple[str, str], dict] = {}
    req_states: list[_ReqState] = []

    for ri, req in enumerate(requirements):
        needs = req.get("needs") or {}
        count = estimate_courses_needed(needs)
        if count <= 0:
            continue
        state = _ReqState(title=req["title"], needed=count)
        req_states.append(state)
        local_index = len(req_states) - 1
        for c in req.get("candidates") or []:
            key = (normalize_dept(c["dept"]), normalize_number(c["number"]))
            if key in excluded_set:
                continue
            state.eligible_keys.add(key)
            entry = candidates.get(key)
            if entry is None:
                info = data.course_planning(c["dept"], c["number"]) or _no_data_info(
                    c["dept"], c["number"]
                )
                entry = {"info": info, "possible_reqs": []}
                candidates[key] = entry
            if local_index not in entry["possible_reqs"]:
                entry["possible_reqs"].append(local_index)

    # Quarter loop.
    quarters: list[dict] = []
    year, season = start_year, start_season
    used: set[tuple[str, str]] = set()

    for _ in range(cfg.max_quarters):
        if all(r.remaining == 0 for r in req_states):
            break

        # Build the pool of (key, entry) available this quarter.
        pool: list[tuple[tuple[str, str], dict, float]] = []
        for key, entry in candidates.items():
            if key in used:
                continue
            if not _season_compatible(entry["info"]["seasons"], season):
                continue
            priority = _candidate_priority(
                entry["possible_reqs"], req_states, entry["info"]["avg_gpa"]
            )
            if priority == -math.inf:
                continue  # all its parent reqs are already satisfied
            pool.append((key, entry, priority))

        # Highest priority first; pure GPA breaks ties via the priority score.
        pool.sort(key=lambda t: t[2], reverse=True)

        first_pass: list[dict] = []
        second_pass: list[dict] = []
        fp_units = 0.0
        total_units = 0.0

        # First pass: pack until we'd exceed the cap.
        for key, entry, _priority in pool:
            if fp_units + cfg.typical_units > cfg.first_pass_cap:
                continue  # can't fit; try later candidates that might
            assigned = _pick_assignment(entry["possible_reqs"], req_states)
            if assigned is None:
                continue
            first_pass.append(_emit_pick(entry, req_states[assigned].title, "first"))
            req_states[assigned].satisfied += 1
            used.add(key)
            fp_units += cfg.typical_units
            total_units += cfg.typical_units
            if fp_units >= cfg.first_pass_cap:
                break

        # Second pass: fill up to pace_units (clamped to [min_units, max_units]).
        target = max(cfg.min_units, min(cfg.pace_units, cfg.max_units))
        for key, entry, _priority in pool:
            if key in used:
                continue
            if total_units + cfg.typical_units > cfg.max_units:
                break
            if total_units >= target:
                break
            assigned = _pick_assignment(entry["possible_reqs"], req_states)
            if assigned is None:
                continue
            second_pass.append(_emit_pick(entry, req_states[assigned].title, "second"))
            req_states[assigned].satisfied += 1
            used.add(key)
            total_units += cfg.typical_units

        # If we placed nothing this quarter (e.g. season-mismatched courses
        # only), still advance the calendar so we don't loop forever.
        if not first_pass and not second_pass:
            year, season = advance_term(year, season, cfg.include_summer)
            continue

        quarters.append({
            "index": len(quarters),
            "year": year,
            "season": season,
            "term_code": format_dars_term(year, season),
            "label": format_term_label(year, season),
            "first_pass_units": fp_units,
            "total_units": total_units,
            "first_pass": first_pass,
            "second_pass": second_pass,
        })

        year, season = advance_term(year, season, cfg.include_summer)

    unsatisfied = [
        {"title": r.title, "still_needed": r.remaining}
        for r in req_states
        if r.remaining > 0
    ]

    return {
        "quarters": quarters,
        "unsatisfied": unsatisfied,
        "config": {
            "pace_units": cfg.pace_units,
            "max_quarters": cfg.max_quarters,
            "first_pass_cap": cfg.first_pass_cap,
            "min_units": cfg.min_units,
            "max_units": cfg.max_units,
            "include_summer": cfg.include_summer,
            "typical_units": cfg.typical_units,
            "start_term": format_dars_term(start_year, start_season),
        },
    }


def _emit_pick(entry: dict, requirement_title: str, pass_label: str) -> dict:
    """Project a candidate entry into the API-facing per-course shape."""
    info = entry["info"]
    return {
        "dept": info["dept"],
        "number": info["number"],
        "title": info["title"],
        "avg_gpa": info["avg_gpa"],
        "seasons": info["seasons"],
        "top_instructors": info["top_instructors"],
        "requirement": requirement_title,
        "pass": pass_label,
    }
