from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from parser import parse_pdf
from grades import get_grade_data


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


class EligibleGroup(BaseModel):
    dept: str
    numbers: list[str] = []


class RecommendRequest(BaseModel):
    groups: list[EligibleGroup] = []
    limit: int = 5


@app.post("/recommend")
def recommend(req: RecommendRequest):
    """Rank a requirement's eligible courses by historical average GPA."""
    groups = [g.model_dump() for g in req.groups]
    return get_grade_data().recommend(groups, limit=req.limit)
