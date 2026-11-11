# DashTide — project plan

**Status:** Working name and implementation plan, 11 November 2026  
**One-line idea:** Upload CSVs, ask questions, build interactive dashboards, and share a published dashboard without requiring viewers to run AI.

## Starting point

- Existing reference: [BlueMart Retail Intelligence](https://retail-bi.priyanshu.cv/) and its [Retail-Analysis repository](https://github.com/priyanshwho/Retail-Analysis).
- BlueMart has React/TypeScript/Recharts views and a FastAPI/PostgreSQL analytics API over four prepared retail CSVs. Its six views are Executive Overview, Sales & Trends, Stores & Categories, Risk Analysis, Pareto, and Data Explorer.
- DashTide generalizes the workflow to one or several user-provided CSVs. Reuse appropriate UI components and analytics patterns, while developing in a separate project or branch so the live BlueMart application is not disrupted.
- **Name:** DashTide is provisional. Check domain and trademark availability before launch.

## Product behavior

### Creator

1. Sign up with email/password or **Continue with Google**; sign in, reset password, and sign out.
2. Click **New Chat** in the left sidebar, upload 1–5 CSVs initially, and see file status, row counts, columns, detected types, missing values, and sample values.
3. Review proposed date fields, numeric measures, currency, identifiers, and relationships. Correct ambiguities before analysis. A join preview must show match rates and potential row multiplication.
4. Ask a question such as “Which month had the highest sales?” The answer states the chosen measure, period, filters, and calculation; displays a suitable chart or table; and can reveal the supporting result rows.
5. Click **Create Dashboard**. AI proposes a page layout from supported KPI, chart, table, and filter components. The data engine calculates every value. The creator can refine the draft in chat and save revisions.
6. Click **Share** and review the exact dashboard and data that will be published. Choose unlisted/public or private access, publish a version, copy its URL, and later revoke or republish it.

### Viewer

- Open a published URL from another device, even when the creator's Mac and Ollama are off.
- View saved charts, tooltips, sorting, and the predefined filters supported by the published aggregate data.
- No local model, API key, or sign-in is required for an unlisted/public link. A private dashboard requires authorized sign-in.
- The first release publishes **a snapshot of dashboard definitions and prepared aggregates**. Arbitrary drill-down into raw rows requires a later hosted dataset and query service.

## Recommended technology stack

| Layer | Recommendation | Reason |
| --- | --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS | Continue the current project's approach. |
| Navigation and data fetching | React Router, TanStack Query | Routes for chats/dashboards/share pages; cache and request state. |
| Visuals | Recharts and existing BlueMart components | Render validated chart specifications; no model-generated executable chart code. |
| Backend | FastAPI, Pydantic, SQLAlchemy, Alembic | Keep Python analytics and add authenticated APIs, schema validation, and migrations. |
| CSV query engine | DuckDB | Profile CSVs and execute controlled joins, filters, and aggregations locally. |
| Local AI | Ollama, initially the installed `gemma3:4b` | No per-request fee; used for intent, explanations, and dashboard plans. |
| Optional hosted AI | Groq free tier through a backend provider adapter | Creation for users without a local model, subject to quotas. Gemini free tier can be evaluated separately. |
| Accounts and metadata | Separate Neon project: Postgres + managed Better Auth | Reuse the database ecosystem, store users, chats, ownership, metric definitions, and dashboard versions. |
| Published assets | Neon Object Storage or compact JSON records in Postgres | Store immutable snapshot payloads; keep raw CSVs private and upload them only for features needing remote analysis. |
| Deployment | Vercel frontend; hosted FastAPI server, potentially the existing OCI setup | Shared links and account APIs remain available when a creator's laptop is off. |

Free plans are suitable for a prototype but have storage, compute, and AI-rate limits. Do not promise unlimited free use. Keep the AI provider behind one interface and never expose its secret key in the browser.

## AI and data boundary

- **The model interprets; the backend calculates.** Send the model a compact, permission-filtered schema, metric catalog, question, and small result summaries. Do not send entire CSVs to fit a model context window.
- Return a validated analysis specification, such as `{measure, aggregation, group_by, filters, date_grain, chart_type}`. The backend checks column names, joins, data types, row limits, and allowed operations before running a query.
- Define each measure once (e.g., revenue, order count, gross profit) with its formula and row granularity. Use the same definition in chat and dashboards.
- Use deterministic rules to select sensible default charts: time + measure → line/bar; category + measure → ranked bar; small shares → donut; detailed records → table. Let the model revise choices within supported component types.
- Prompt content from CSVs is untrusted data. Do not run generated Python or arbitrary SQL against application tables.

## Local creation and online sharing

The creator's Mac runs an Ollama server bound to `127.0.0.1:11434`. A small **local companion service** will provide the authenticated website a controlled path to local model and CSV analysis. Restrict allowed website origins, require an explicit connection/pairing step, and expose only the necessary operations. Test browser access from the hosted HTTPS site early; if browser local-network restrictions impede this route, serve the creator UI locally from the companion and use the same account and publishing API.

When **Share** is clicked, the cloud service saves a versioned dashboard specification and the aggregate data needed by its supported filters. Viewer requests read that snapshot from the hosted service. No viewer request calls the creator's localhost model. A snapshot remains stable until the owner republishes it.

For public creators who lack Ollama, enable the Groq provider with request quotas and a clear exhausted-quota state. Public viewers never consume AI quota.

## Authentication and sharing

- Neon Auth manages email/password and Google social sign-in; FastAPI validates the issued token and scopes each private record to the authenticated user ID.
- For Google OIDC, create a **Web application** OAuth client in Google Cloud Console, configure Branding/Audience, and request only `openid`, `email`, and `profile` for login. Copy the **exact Neon Auth callback URL** for the target branch into Google's authorized redirect URIs; configure client ID/secret in Neon, not the frontend.
- Use separate test and production OAuth configurations. Register the app domains in Neon and test sign-in, sign-out, expired sessions, and the existing-email account-linking policy.
- A share record has an owner, opaque random identifier, visibility, publication version, creation time, and optional expiry/revocation. The public endpoint serves only approved snapshot fields; private datasets and chats remain owner-scoped.
- The publish preview warns if a chart exposes sensitive categories or small groups. Do not publish raw rows by default.

## Local installation state

- Checked on the user's M4 MacBook Air (16 GB unified memory, 256 GB storage): Ollama `0.14.3` is installed; `gemma3:4b` is present locally.
- User-provided server log on 11 November 2026 shows Ollama listening on localhost, all 35 Gemma layers offloaded to Apple M4 Metal, about 4 GiB model runtime memory, and a successful `POST /api/generate` response (HTTP 200).
- Current context setting shown in that log is 4,096 tokens. Build compact prompts; do not pass whole files.
- For manual use: keep `ollama serve` running in one Terminal, then run `ollama run gemma3:4b` in another. No Ollama account or API key is needed.

## Recommended tasks in build order

### Phase 0 — Foundation

- [ ] Create a separate DashTide repository/project, reuse selected BlueMart design components, and define frontend/backend/local-companion boundaries.
- [ ] Add environment configuration without committing secrets; establish local and deployed API health checks.
- [ ] Prototype the hosted HTTPS website ↔ local companion connection on the M4 Mac; select the fallback local-creator UI if necessary.
- [ ] Define versioned API contracts for datasets, analysis plans, chart specs, dashboards, and publications.

### Phase 1 — Accounts and datasets

- [ ] Create a separate Neon project; enable managed auth and email/password flows.
- [ ] Create Google Cloud test OAuth project/client, configure basic OIDC scopes and Neon's exact callback, and test Google sign-in.
- [ ] Add FastAPI token verification and owner-scoped database records.
- [ ] Implement New Chat, multiple CSV upload, ingestion status, profiling, schema review, and safe join previews.

### Phase 2 — Ask the data

- [ ] Integrate local Ollama through the companion and implement the model-provider adapter.
- [ ] Define metric catalog and read-only query planner with validation, limits, and auditable calculations.
- [ ] Return answers with calculation details, chart suggestions, and supporting table values.
- [ ] Save chat history and dataset references; verify questions against known BlueMart numbers and small synthetic edge cases.

### Phase 3 — Dashboard builder

- [ ] Create reusable chart and KPI specifications with validation; map them to Recharts components.
- [ ] Generate overview and trends pages first; add comparisons, diagnostics, Pareto, and explorer only when their source columns exist.
- [ ] Support chat-driven edits, dashboard filters, saved drafts, and version history.
- [ ] Check totals across chat answers, KPI cards, and visualizations for the same filters.

### Phase 4 — Publish and share

- [ ] Build publication preview and snapshot generation from approved, aggregated data.
- [ ] Add opaque share URLs, read-only public/private viewer pages, revoke/republish, and optional expiry.
- [ ] Open a shared URL on another device with Ollama stopped and confirm charts and supported filters still work.
- [ ] Create the production Google OAuth client/configuration and complete release checks.

### Phase 5 — Broader access

- [ ] Add Groq-backed creation for users without local Ollama, with server-side key storage and per-user quotas.
- [ ] Offer remote dataset persistence and fully queryable shared dashboards only if that richer interactivity is needed.
- [ ] Measure usage, storage, and model quality before expanding free-tier capacity.

## First-release acceptance criteria

1. A new user can sign up with email or Google and see only their own chats and drafts.
2. One CSV and the four BlueMart CSVs can be imported; proposed joins are confirmed and totals are correct.
3. A question about highest monthly sales yields a reproducible answer with an appropriate chart and calculation description.
4. Create Dashboard generates multiple editable, data-appropriate views without claiming metrics unsupported by the CSVs.
5. A published share link works on another laptop while the creator's Mac is off; no local AI or API key is needed to view it.
6. Revoking a share link prevents further access, and republishing creates a clear new version.

## References to verify during implementation

- [Google OpenID Connect setup](https://developers.google.com/identity/openid-connect/openid-connect)
- [Google OAuth production policy](https://developers.google.com/identity/verification/authentication-policy-compliance)
- [Neon Auth overview](https://neon.com/blog/handling-auth-in-a-staging-environment)
- [Neon free backend limits](https://neon.com/blog/neon-free-plan-1-gb-per-project)
- [DuckDB CSV ingestion](https://duckdb.org/docs/stable/data/csv/overview)
- [Ollama Gemma 3](https://ollama.com/library/gemma3)
- [Groq rate limits](https://console.groq.com/docs/rate-limits)
