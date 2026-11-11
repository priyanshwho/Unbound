# Unbound

Unbound is a local-first CSV analytics workspace. This first implementation slice provides CSV upload and profiling, natural-language questions through Ollama, backend-calculated answers using DuckDB, and a Recharts dashboard generated from the selected file.

## Requirements

- Node.js 20 or newer
- Python 3.11 or newer
- Ollama with `gemma3:4b` installed

Ollama is already installed on the target Mac, and the provided terminal output showed `gemma3:4b` loaded successfully. If the model is missing, install it with `ollama pull gemma3:4b`.

## Run on macOS

Keep Ollama available in Terminal 1 (skip if it is already running):

```bash
ollama serve
```

In Terminal 2, start the API from the `Unbound` folder:

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

In Terminal 3, start the web app from the `Unbound` folder:

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. Upload one or more CSVs. The interface keeps each uploaded file in the recent-files list; chat and dashboard calculations currently run against the selected file. Uploads are stored under `backend/data/datasets/` on this Mac.

## Current prototype limits

- This is a local prototype. Sign-up/sign-in, Google OIDC, Neon persistence, cloud sync, publication, and public share links are not wired in yet.
- A dashboard's Share control is intentionally marked as coming later. Cloud publishing must store an approved dashboard snapshot so viewers can open it without your Mac or Ollama running.
- Uploading multiple CSVs is supported, but cross-file joins and questions spanning multiple files are not implemented yet.
- Uploaded CSVs remain on this Mac. Keep the API bound to localhost; do not expose the development API to the public internet.
- The model chooses a constrained analysis plan. The backend checks its selected columns and computes the result; it does not execute model-generated SQL or Python.
- Chat history is currently in browser memory and is cleared on reload.

See `PROJECT_PLAN.md` for the complete product flow, recommended hosted architecture, Google OIDC setup, and phased roadmap.
