# ft-interview-hono

Take-home / pairing boilerplate for a **Fresh Tracks Canada** interview.

A working end-to-end hotel search:

- **Backend** — [Hono](https://hono.dev) on Node.js (TypeScript), with [Drizzle ORM](https://orm.drizzle.team) talking to Postgres. Calls the [Amadeus Hotel Search API](https://developers.amadeus.com/self-service/category/hotels) sandbox.
- **Frontend** — Next.js 14 (App Router) + Tailwind, with a search form and a results list.
- **Database** — PostgreSQL 16. Hotel searches are persisted so you have something concrete to extend.
- **Everything boots with one command.**

---

## Quick start

```bash
# 1. Get free Amadeus sandbox credentials (takes 2 min)
#    → https://developers.amadeus.com/register
#    Create a "Self-Service" app, copy its API Key + Secret.

cp .env.example .env
# Open .env and paste your AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET.

# 2. Boot it.
docker compose up --build
```

Then open:

- Frontend → <http://localhost:3000>
- Backend health → <http://localhost:8000/api/health>

Try a search with `cityCode=PAR` (Paris) — the Amadeus sandbox has the richest test data there.

---

## What's wired up

| Endpoint | What it does |
| --- | --- |
| `GET /api/health` | Liveness check. |
| `GET /api/hotels/search?cityCode=PAR&checkInDate=YYYY-MM-DD&checkOutDate=YYYY-MM-DD&adults=1` | Resolves hotels in `cityCode`, then fetches Amadeus offers for them. Logs the search to Postgres. |
| `GET /api/hotels/history` | Last 20 searches from Postgres. |

The Amadeus client lives at [`backend/src/amadeus.ts`](backend/src/amadeus.ts) — it handles OAuth token caching and batches hotel-IDs into 20-at-a-time offer requests. The route is in [`backend/src/routes/hotels.ts`](backend/src/routes/hotels.ts).

The Postgres schema is defined with Drizzle in [`backend/src/db/schema.ts`](backend/src/db/schema.ts) and a tiny idempotent migration runs on boot ([`backend/src/db/migrate.ts`](backend/src/db/migrate.ts)). Feel free to swap in `drizzle-kit` migrations if your task calls for it (`npm run db:generate` / `db:push` are wired up).

---

## Project layout

```
.
├── docker-compose.yml          # postgres + backend + frontend
├── .env.example                # copy → .env, fill in Amadeus creds
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── drizzle.config.ts
│   └── src/
│       ├── index.ts            # Hono app entrypoint
│       ├── amadeus.ts          # Amadeus REST client
│       ├── routes/
│       │   ├── health.ts
│       │   └── hotels.ts       # /search + /history endpoints
│       └── db/
│           ├── index.ts        # drizzle + postgres-js
│           ├── schema.ts       # hotel_searches table
│           └── migrate.ts      # idempotent boot migration
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── app/
    │   ├── layout.tsx
    │   └── page.tsx            # search form + results list
    └── lib/
        └── api.ts              # typed fetch client
```

---

## Suggested extensions for the interview

The boilerplate is intentionally thin. Pick whichever your interviewer suggests, or whichever feels most natural to you:

- Add a **hotel detail page** that hits a `/api/hotels/:hotelId` route.
- **Persist favorites** — let the user star a hotel and list them on `/favorites`. (New Drizzle table.)
- Add **filters** (price range, board type, rating) on the results page.
- Add **input validation** with Zod / `@hono/zod-validator`.
- Add **tests** (Vitest on the backend, Playwright on the frontend).
- Cache Amadeus responses — the sandbox is rate-limited.
- Add **observability**: structured logs, an OpenTelemetry exporter, traces.
- Switch from Hono's `hono/logger` to `pino` and a request-id middleware.

---

## Local development without Docker

The Docker compose is the supported path. If you really want to run things locally:

```bash
# Postgres
docker compose up db

# Backend
cd backend
npm install
export POSTGRES_HOST=localhost
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

---

## Notes on Amadeus

- The sandbox lives at `https://test.api.amadeus.com`.
- Tokens are valid ~30 minutes; the client caches them in-process.
- Hotel data is sparse outside major cities. **PAR / LON / NYC / MAD** are the most reliable for testing.
- If a search returns 0 results, try a date 1–2 weeks in the future — past dates always 400.
