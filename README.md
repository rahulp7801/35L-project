# CS 35L Final Project

Web app for UCLA students to upload their DARS pdf and see what classes they still need to take. 

## What works rn

You can upload a DARS pdf on the frontend and the backend saves it to a folder.

## Stack

- frontend: next.js (react)
- backend: fastapi (python)

## Folders

```
backend/
  main.py             - the python server
  uploaded_dars/      - where uploaded pdfs go (not in git)
frontend/
  app/
    page.tsx          - the upload page
    layout.tsx        - sets the tab title etc
    globals.css       - styling
```

## How to run it

Need two terminals.

backend:
```
cd backend
pip install fastapi uvicorn python-multipart
uvicorn main:app --reload --port 8000
```

frontend:
```
cd frontend
npm install
npm run dev
```

Then go to http://localhost:3000
