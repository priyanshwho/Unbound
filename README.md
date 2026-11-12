# Unbound

Unbound is a local-first CSV analytics workspace. The landing page introduces the product, and the Analytics button opens the creator workspace without sign-in or sign-up.

## Project structure

- `frontend/` contains the React, TypeScript, Vite, Tailwind CSS, and React Router application.
- `frontend/src/routes/` maps URLs to page screens.
- `frontend/src/sections/landing/` contains the scroll sections on `/`.
- `frontend/src/features/` owns analytics feature behavior and data contracts.
- `frontend/src/components/` contains shared UI and layout components.
- `backend/` contains the local FastAPI API and DuckDB CSV operations.

The landing page uses a dark blue palette with a coordinated light theme, lime as a contrasting accent, Manrope for headings, DM Sans for body copy, and DM Mono for labels.

## Run locally

Use Node.js 22.12 or newer and Python 3.11 or newer.

Start the local API in one terminal:

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

Open `http://127.0.0.1:5173`. The local API stores CSV uploads under `backend/data/datasets/`, which Git ignores. The workspace supports up to five CSVs, schema profiles, column-role review, join previews, and dataset deletion.

## Current boundaries

- There is no authentication flow. The Analytics route opens directly.
- Chats, AI analysis, editable dashboards, Neon persistence, and public snapshot publishing are future implementation steps.
- Keep the local API bound to loopback. Raw CSV files stay on this computer.
