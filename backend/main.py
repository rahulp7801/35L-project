from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from parser import parse_pdf

app = FastAPI()

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
