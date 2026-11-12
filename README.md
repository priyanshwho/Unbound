# Unbound

Unbound is a local-first CSV analytics workspace. The landing page lives at `/`; its **Analytics** button opens `/analytics` directly, with no sign-in or sign-up flow.

## Features

- Responsive landing sections for product features, workflow, about, FAQ, contact, and footer.
- Dark and light blue themes with a lime accent; Manrope, DM Sans, and DM Mono typography.
- Upload up to five CSV files to the local companion, profile their schemas, review column roles, preview joins, and remove local data.
- Ask questions in plain language. Ollama returns a constrained analysis plan; DuckDB validates and calculates it locally.
- Create a dashboard from an answer, change chart styles, preview AI-requested analysis edits, and keep local drafts and revisions.
- Optionally sync chat, dataset, and dashboard metadata to Neon. Publish reviewed aggregate snapshots as read-only share links.

## Project structure

- `frontend/` contains the React, TypeScript, Vite, Tailwind CSS, and React Router app.
- `frontend/src/routes/` maps URLs to route screens.
- `frontend/src/sections/landing/` contains the scroll sections on `/`.
- `frontend/src/features/` contains analytics, dashboard, and chat behavior.
- `frontend/src/components/` contains shared UI and layout components.
- `backend/` contains the loopback-only FastAPI companion, local file handling, DuckDB, and Ollama calls.
- `persistence-api/` contains the TypeScript Fastify API, Drizzle schema/migrations, private metadata routes, and public snapshot route.

## Run the local workspace

Use Node.js 22.12 or newer and Python 3.11 or newer. Ollama should be running at `http://127.0.0.1:11434`; set `OLLAMA_MODEL` to a model installed on your machine if it is not `gemma3:4b`.

Start the local API:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Start the frontend in another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. Uploads and the DuckDB database are stored below `backend/data/`, which Git ignores. Deleting a dataset removes its local file, DuckDB table, and metadata.

## Optional Neon persistence

The persistence API stores workspace metadata and dashboard drafts; raw CSV contents stay local. It requires a Neon connection string before migrations or live persistence can run.

1. In `persistence-api/`, copy `.env.example` to `.env`, set `DATABASE_URL`, and generate a strong `UNBOUND_SERVICE_TOKEN`.
2. Apply the database schema and start the service:

   ```bash
   cd persistence-api
   npm install
   npm run db:migrate
   npm run dev
   ```

3. Put the same service token in `backend/.env` as `UNBOUND_SERVICE_TOKEN`, and set `PERSISTENCE_API_URL` to the service address. Restart FastAPI.

The browser never receives the Neon URL or service token. Private routes require the service token and are reached through the local companion. The unconfigured app continues to work locally with browser-stored chats and dashboard drafts.

## Public dashboard hosting

Share pages can be hosted separately from the creator’s computer. Deploy `persistence-api/` with `DATABASE_URL`, `UNBOUND_SERVICE_TOKEN`, `HOST=0.0.0.0`, and `PUBLIC_ORIGIN` set to the exact hosted frontend origin. Set `VITE_PUBLIC_PERSISTENCE_API_URL` in the frontend build environment to the public API origin, such as `https://api.example.com`. A share page then reads only `/v1/share/:shareId`; it does not contact Ollama, DuckDB, or the creator’s local files.

Unlisted links are accessible to anyone holding the link until expiry or revocation. Review the aggregate preview before publishing, especially when it contains fewer than five groups.

## Checks

```bash
cd frontend && npm run build && npm run lint
cd ../backend && PYTHONPATH=. .venv/bin/python -m unittest discover -s tests -v
cd ../persistence-api && npm test
```

Planning files `PROJECT_PLAN.md` and `docs/IMPLEMENTATION_PLAN.md` are intentionally ignored by Git and remain local-only. Keep `.env` files, CSVs, and DuckDB databases out of version control.
