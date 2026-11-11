# Unbound — project continuity

This file preserves the decisions and working context from the earlier AI analyst / Retail BI project conversation so work can continue from this repository if the old chat folder is removed. The full product specification and phased roadmap are in [PROJECT_PLAN.md](PROJECT_PLAN.md); setup and current prototype limits are in [README.md](README.md).

## Project identity and origin

- The AI analyst product began under the provisional name **DashTide** and is now named **Unbound**. Treat Unbound as the current name; the old DashTide name is historical context.
- The product generalizes the user's **BlueMart Retail Intelligence** reference project into a reusable CSV analytics workspace.
- Reference app: <https://retail-bi.priyanshu.cv/>
- Reference repository: <https://github.com/priyanshwho/Retail-Analysis>
- This implementation is a separate project and must not disrupt the live BlueMart app.
- This repository currently lives on the user's Desktop at `/Users/priyanshu/Desktop/Projects & Apps/Projects/AI/Unbound`.
- GitHub repository and configured `origin`: <https://github.com/priyanshwho/Unbound>.

## User's project workflow requirements

- Keep projects on the Desktop in theme-specific folders. This project belongs in `Desktop/Projects/AI/Unbound`.
- Commit and push each small, reviewable project change to the configured GitHub repository. Do not leave completed changes only in the local working tree.
- Keep secrets out of Git; use environment configuration and `.env.example` placeholders.

## Product goal and scope

Unbound should let a creator upload one to five CSVs, inspect their quality and relationships, ask questions in natural language, create editable dashboards, and publish a safe dashboard snapshot. Public or unlisted viewers should be able to open a published dashboard when the creator's laptop and local AI are offline. The first release publishes approved aggregates and chart definitions, not raw CSV rows or arbitrary query access.

Key product behaviors and guardrails are specified in [PROJECT_PLAN.md](PROJECT_PLAN.md), including:

- Profile rows, columns, inferred types, missing values, and sample values; let the creator correct ambiguous dates, measures, currencies, IDs, and relationships.
- Preview proposed joins with match rates and row-multiplication warnings.
- Have AI interpret questions and return a constrained analysis plan; have the backend validate and calculate every metric.
- Use consistent metric definitions across chat answers, KPIs, and charts. Show calculation details and supporting results.
- Generate editable dashboards from supported KPI, chart, table, and filter components.
- Preview the exact content to publish; support visibility, versioned republish, revocation, and optional expiry. Never publish raw rows by default.
- Keep CSV contents untrusted. Never execute model-generated Python or arbitrary SQL.
- Keep private datasets, chats, and records owner-scoped. Do not expose provider secrets in the browser.

## Reference data and analytics

BlueMart uses React/TypeScript/Recharts, a FastAPI/PostgreSQL analytics API, and four prepared retail CSVs. Its six views are Executive Overview, Sales & Trends, Stores & Categories, Risk Analysis, Pareto, and Data Explorer. Use it as a reference for relevant UI components and verified totals; Unbound must also work with arbitrary user CSVs and must not claim a metric that the available columns cannot support.

## Planned technical direction

- Frontend: React, TypeScript, Vite, Tailwind CSS; Recharts for validated visual specs.
- Backend: FastAPI, Pydantic, SQLAlchemy/Alembic as hosted features are introduced.
- Local file analysis: DuckDB with validated, read-only operations.
- Local AI: Ollama, initially `gemma3:4b`; optional hosted provider adapter (Groq) later, with server-side secrets and quotas.
- Accounts and metadata: a separate Neon project with managed auth/Postgres; do not reuse BlueMart's production data or credentials.
- Hosting direction: Vercel frontend and hosted FastAPI service; immutable aggregate snapshots for published dashboards.
- Local analysis service: if needed, expose a small paired local companion restricted to allowed origins and necessary operations. Test hosted HTTPS to localhost early; a locally served creator UI is the documented fallback if browser local-network restrictions block this.

## Current implementation snapshot

The earlier prototype UI and API were removed during the clean scaffold requested by the user. The repository now has:

- A Vite React and TypeScript frontend with Tailwind CSS 4, React Router, and the planned forest, ivory, and clay palette.
- Landing, product, sign-in, and sign-up routes. The account screens are UI previews and do not send or store credentials.
- A local workspace route that uploads one CSV and displays its profiled schema.
- A FastAPI local API with versioned health and CSV upload/profile endpoints. DuckDB reads CSV data and stores uploads under `backend/data/datasets/`.

Not implemented yet: account verification or Google OIDC; Neon persistence; local companion pairing; Ollama analysis; chat and dashboard creation; cloud sync and publication; public/private viewer routes; share revocation or republishing. The detailed order remains in [PROJECT_PLAN.md](PROJECT_PLAN.md), and local run instructions are in [README.md](README.md).

## Local model setup already confirmed

The user reported an M4 MacBook Air with 16 GB unified memory and 256 GB storage. On 11 November 2026, Ollama 0.14.3 and `gemma3:4b` were present. A supplied log showed Ollama bound to localhost, all 35 Gemma layers offloaded to Apple M4 Metal, about 4 GiB model runtime memory, a successful `/api/generate` HTTP 200 response, and a 4,096-token context setting. Keep prompts compact; do not send entire CSVs to the model. Manual startup is documented in [README.md](README.md).

## Roadmap and acceptance checks

The ordered plan remains Phase 0 (foundation and local companion/API contracts), Phase 1 (accounts and datasets), Phase 2 (ask-the-data with auditable calculations), Phase 3 (editable dashboard builder), Phase 4 (versioned publish/share), and Phase 5 (broader hosted access). The detailed checklists are in [PROJECT_PLAN.md](PROJECT_PLAN.md).

First-release acceptance means:

1. Email or Google sign-in scopes chats and drafts to their owner.
2. One CSV and the four BlueMart CSVs import; proposed joins are confirmed and totals match.
3. Highest-monthly-sales questions return reproducible calculations and sensible charts.
4. Generated dashboards contain multiple editable views supported by the actual data.
5. A published share URL works on another device while the creator's Mac is off.
6. Revocation blocks further access; republishing produces a clear new version.

## Source and preservation note

The previous project plan was saved under the historical DashTide name. Its complete product requirements, AI/data boundary, auth and publication design, local model state, phased roadmap, acceptance criteria, and reference links are preserved in this repository's [PROJECT_PLAN.md](PROJECT_PLAN.md). This note captures continuity and the current implementation boundary; it is not a verbatim export of the old conversation transcript.
