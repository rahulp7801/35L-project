from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# our next.js frontend runs on port 3000, this server runs on 8000
# browsers block requests across different ports unless we explicitly allow it
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# this endpoint runs whenever the frontend posts a file to /upload
@app.post("/upload")
async def upload(file: UploadFile = File(...)):

    # read the raw bytes of whatever pdf the user picked
    contents = await file.read()

    # save it inside the uploaded_dars folder using the original filename
    # "wb" = write binary (pdfs arent plain text)
    with open(f"uploaded_dars/{file.filename}", "wb") as f:
        f.write(contents)

    # send a confirmation back so the frontend can show "saved ___"
    return {"message": f"saved {file.filename}"}
