# Unbound persistence API

This TypeScript service stores workspace metadata and reviewed dashboard snapshots in Neon PostgreSQL through Drizzle ORM. The FastAPI companion calls private routes with `UNBOUND_SERVICE_TOKEN`. Browser code never receives the Neon URL or service token.

Uploaded CSV files and DuckDB tables stay in the local companion. The persistence service stores dataset names, row counts, column names/types/roles, chats, dashboard specs, revisions, and published aggregate snapshots. Do not add local file paths or raw CSV rows to these records.

## Local setup

1. Copy `.env.example` to `.env` and add `DATABASE_URL` and a long random `UNBOUND_SERVICE_TOKEN` when the Neon project is ready.
2. Run `npm install` and `npm run db:migrate` from this directory.
3. Use `npm run dev` for local development. The default host is `127.0.0.1`; set `HOST=0.0.0.0` in the deployment environment when the API must accept hosted requests.

`npm run db:generate` creates SQL migrations from `src/db/schema.ts`. Applying migrations requires a configured Neon URL.

## Route boundary

- `/v1/private/*` requires `x-unbound-service-token` and is called by the local companion.
- `/v1/share/:shareId` is read-only and returns only an approved snapshot that has not expired or been revoked.
- `/health` reports whether the service can reach the configured database.
