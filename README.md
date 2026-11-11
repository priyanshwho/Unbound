# Unbound

Unbound is a local-first CSV analytics workspace. The project plan is in [PROJECT_PLAN.md](PROJECT_PLAN.md). The current starter implements the public landing and product pages, sign-in and sign-up UI, a local CSV upload and schema review, and the versioned FastAPI health and profile endpoints.

## Project structure

- `frontend/` — React 19, TypeScript, Vite, Tailwind CSS 4, and React Router.
- `backend/` — FastAPI local API with DuckDB CSV profiling.
- `PROJECT_PLAN.md` — product requirements and phased roadmap.
- `PROJECT_CONTEXT.md` — project decisions and continuity notes.

The app uses forest ink and warm ivory as its main colors, with a small clay accent. Manrope is used for headings, DM Sans for body text, and DM Mono for labels.

## Run locally

Use Node.js 22.12 or newer and Python 3.11 or newer.

Start the API in one terminal:

```bash
cd backend
python3 -m venv .venv
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

- Email and Google account forms are UI previews. They do not send or store credentials. Neon Auth and Google OIDC setup are not configured.
- The workspace can upload and profile one CSV at a time. Natural-language analysis, dashboard generation, saved records, and publishing are next in the project plan.
- Keep the API bound to localhost. Uploaded CSVs stay on this Mac.
