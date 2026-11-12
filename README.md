# Unbound

Unbound is a local-first CSV analytics workspace. The landing page has product sections and an Analytics link. There is no sign-in or sign-up flow. The local workspace supports CSV upload, schema review, and multi-dataset join previews through FastAPI and DuckDB.

## Project structure

- `frontend/` — React 19, TypeScript, Vite, Tailwind CSS 4, and React Router.
- `backend/` — FastAPI local API with DuckDB CSV profiling.
- `PROJECT_CONTEXT.md` — project decisions and continuity notes.

The app uses forest ink and warm ivory as its main colors, with a small clay accent. Manrope is used for headings, DM Sans for body text, and DM Mono for labels. Workspace motion uses transitions.dev duration and easing tokens, with reduced motion support.

## Run locally

Use Node.js 22.12 or newer and Python 3.11 or newer.

Start the API in one terminal:

```bash
cd backend
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Start the frontend in another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. The CSV upload posts to the local API, which stores files under `backend/data/datasets/` and returns row counts, column types, null counts, distinct counts, and sample values. OpenAPI docs are at `http://127.0.0.1:8000/api/v1/docs`.

## Current implementation boundary

- The app has no authentication routes or account forms. Analytics opens directly for the local creator.
- The workspace can upload up to five CSVs, profile their schemas, assign temporary column roles, preview exact text joins, and remove files from local storage. Saved chats, persistent schema corrections, dashboard generation, and publishing are next in the project plan.
- Keep the API bound to localhost. Uploaded CSVs stay on this Mac.
