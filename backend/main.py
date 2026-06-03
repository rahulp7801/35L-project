from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from concurrent.futures import ThreadPoolExecutor

import soc
from parser import parse_pdf
from grades import get_grade_data
from planner import PlannerConfig, parse_dars_term, plan as run_plan


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load and aggregate the CPRA grade data once, at startup, so the first
    # request isn't slow and a bad data dir fails fast.
    get_grade_data()
    yield


app = FastAPI(lifespan=lifespan)

# our next.js frontend runs on port 3000, this server runs on 8000
# browsers block requests across different ports unless we explicitly allow it
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_BYTES = 10 * 1024 * 1024


@app.post("/parse")
async def parse(file: UploadFile = File(...)):
    if file.content_type != "application/pdf" and not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="only PDF files are allowed")
    contents = await file.read()
    if len(contents) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="file exceeds 10 MB limit")
    try:
        return parse_pdf(contents)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"could not parse pdf: {e}")


class BatchCourse(BaseModel):
    dept: str
    number: str


class BatchRequest(BaseModel):
    courses: list[BatchCourse] = []


@app.post("/grades/batch")
def grades_batch(req: BatchRequest):
    """Look up many courses at once and return their lightweight overview stats.

    Used by dashboard widgets (like the "how you compare" card) that need
    historical averages for every course on a student's transcript without
    paying for the full per-instructor and per-term breakdowns of GET /grades.

    Each requested course produces one row in the response (same order). When
    we have no data for a course the row is still emitted with avg_gpa=null
    so the client can render a "no data" marker without making a second call.
    """
    data = get_grade_data()
    out: list[dict] = []
    for c in req.courses:
        overview = data.course_overview(c.dept, c.number)
        if overview is None:
            out.append({
                "dept": c.dept, "number": c.number, "title": "",
                "avg_gpa": None, "graded": 0, "total": 0,
            })
        else:
            out.append(overview)
    return out


@app.get("/grades")
def grades(dept: str, number: str):
    """Historical grade distribution for one course

    Query params:
        dept
        number
    Returns overall + per-instructor + per-term distributions with average GPA,
    or 404 if we have no data for that course.
    """
    course = get_grade_data().course(dept, number)
    if course is None:
        raise HTTPException(status_code=404, detail=f"no grade data for {dept} {number}")
    return course


@app.get("/grades/search")
def grades_search(q: str, limit: int = 25):
    """Autocomplete-style lookup by 'DEPT NUMBER' or title fragment."""
    return get_grade_data().search(q, limit=limit)


_BROWSE_LEVELS = ("lower", "upper", "graduate")


@app.get("/grades/browse")
def grades_browse(
    dept: str | None = None,
    min_gpa: float | None = None,
    level: str | None = None,
    limit: int = 50,
):
    """Filter courses by department, level, and minimum average GPA.

    Query params (all optional):
        dept: department code, e.g. "COM SCI"
        min_gpa: only return courses with avg GPA >= this value
        level: "lower" (catalog # 0-99), "upper" (100-199), or "graduate" (200+)
        limit: max rows (default 50)

    Returns rows ranked by avg GPA descending."""
    if level is not None and level not in _BROWSE_LEVELS:
        raise HTTPException(
            status_code=400,
            detail=f"level must be one of {list(_BROWSE_LEVELS)}",
        )
    return get_grade_data().browse(
        dept=dept, min_gpa=min_gpa, level=level, limit=limit
    )


@app.get("/grades/departments")
def grades_departments():
    """Sorted list of every department code present in the grade data.

    Powers the department dropdown on the browse UI."""
    return get_grade_data().departments()


@app.get("/instructors/search")
def instructors_search(q: str, limit: int = 25):
    """Autocomplete-style lookup over instructor names ('LAST, FIRST M')."""
    return get_grade_data().instructor_search(q, limit=limit)


@app.get("/instructors")
def instructors_detail(name: str):
    """Every course taught by `name`, with per-course average GPA and distribution."""
    result = get_grade_data().instructor(name)
    if result is None:
        raise HTTPException(status_code=404, detail=f"no data for instructor {name!r}")
    return result


class EligibleGroup(BaseModel):
    dept: str
    numbers: list[str] = []


class RecommendRequest(BaseModel):
    groups: list[EligibleGroup] = []
    limit: int = 5
    timing_threshold: float = 0.2


@app.post("/recommend")
def recommend(req: RecommendRequest):
    """Rank a requirement's eligible courses by historical average GPA.

    We look up who's teaching each course next term on UCLA's public Schedule of Classes and, 
    when that instructor historically grades above the course baseline by
    `timing_threshold`, mark it a favorable offering. 
    """
    data = get_grade_data()
    groups = [g.model_dump() for g in req.groups]
    result = data.recommend(groups, limit=req.limit)

    term = soc.current_term()

    def enrich(course: dict) -> dict:
        names = soc.course_instructors(term, course["dept"], course["number"])
        course["timing"] = data.instructor_timing(
            course["dept"], course["number"], names, term,
            threshold=req.timing_threshold,
        )
        return course

    # Each lookup is one independent network call
    courses = result["courses"]
    if courses and soc.enabled():
        with ThreadPoolExecutor(max_workers=min(8, len(courses))) as pool:
            courses = list(pool.map(enrich, courses))
    else:
        for course in courses:
            course["timing"] = None
    result["courses"] = courses
    result["term"] = term
    return result


class PlannerRequirement(BaseModel):
    title: str
    needs: dict = {}
    candidates: list[dict] = []  # [{dept, number}, ...]


class PlannerExcluded(BaseModel):
    dept: str
    number: str


class PlannerConfigIn(BaseModel):
    pace_units: float = 16.0
    max_quarters: int = 8
    first_pass_cap: float = 10.0
    min_units: float = 12.0
    max_units: float = 22.0
    include_summer: bool = False
    typical_units: float = 4.0


class PlanRequest(BaseModel):
    requirements: list[PlannerRequirement] = []
    excluded: list[PlannerExcluded] = []
    start_term: str  # DARS code like "FA24"
    config: PlannerConfigIn = PlannerConfigIn()


@app.post("/plan")
def plan_endpoint(req: PlanRequest):
    """Multi-quarter course recommendation engine.

    Body shape:
        requirements: outstanding DARS sections, each with a needs dict and a
            list of eligible candidate {dept, number} pairs.
        excluded: courses already taken or in-progress (skipped as candidates).
        start_term: DARS quarter code we start recommending from (e.g. "FA24").
        config: optional planner tuning — pace, unit cap, first-pass cap, etc.

    Returns a list of quarters, each with first-pass and second-pass course
    picks tagged with the requirement they satisfy. See backend/planner.py for
    the full algorithm and its limits (no prereqs, no live offerings).
    """
    parsed = parse_dars_term(req.start_term)
    if parsed is None:
        raise HTTPException(
            status_code=400,
            detail=f"start_term must be a DARS code like 'FA24' (got {req.start_term!r})",
        )
    start_year, start_season = parsed
    return run_plan(
        get_grade_data(),
        requirements=[r.model_dump() for r in req.requirements],
        excluded=[e.model_dump() for e in req.excluded],
        start_year=start_year,
        start_season=start_season,
        config=PlannerConfig(**req.config.model_dump()),
    )
