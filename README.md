# ft-interview-hono

Take-home / pairing boilerplate for a **Fresh Tracks Canada** interview.

A working end-to-end hotel search:

- **Backend** — [Hono](https://hono.dev) on Node.js (TypeScript), with [Drizzle ORM](https://orm.drizzle.team) talking to Postgres. Ships with a mock hotel-search client that returns Amadeus-shaped data; swap in a real provider when you have credentials.
- **Frontend** — Next.js 14 (App Router) + Tailwind, with a search form and a results list.
- **Database** — PostgreSQL 16. Hotel searches are persisted so you have something concrete to extend.
- **Everything boots with one command.**

> **Heads up on Amadeus.** Amadeus is shutting down its self-service developer portal in July 2026. This boilerplate defaults to **mock mode** with in-process fixtures so the demo always works. The mock returns the same response shape as the real Amadeus API, so swapping in a real provider later is a one-file change.

---

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

Then open:

- Frontend → <http://localhost:3000>
- Backend health → <http://localhost:8000/api/health>

Try a search with `cityCode=PAR` (Paris). Mock cities available out of the box: **PAR, LON, NYC, MAD**. Other city codes return an empty list.

---

## What's wired up

| Endpoint | What it does |
| --- | --- |
| `GET /api/health` | Liveness check. |
| `GET /api/hotels/search?cityCode=PAR&checkInDate=YYYY-MM-DD&checkOutDate=YYYY-MM-DD&adults=1` | Resolves hotels in `cityCode`, then fetches Amadeus offers for them. Logs the search to Postgres. |
| `GET /api/hotels/history` | Last 20 searches from Postgres. |

The route in [`backend/src/routes/hotels.ts`](backend/src/routes/hotels.ts) calls `getClient()` from [`backend/src/amadeus.ts`](backend/src/amadeus.ts), which returns either:

- **MockAmadeusClient** ([`mock-amadeus.ts`](backend/src/mock-amadeus.ts)) — default. Reads fixtures from [`mock-data.ts`](backend/src/mock-data.ts) and synthesises Amadeus-shaped offer responses.
- **AmadeusClient** ([`amadeus.ts`](backend/src/amadeus.ts)) — handles OAuth token caching and batches hotel-IDs into 20-at-a-time offer requests. Activated by `AMADEUS_MODE=live` in `.env`. The class is provider-shaped so you can point `AMADEUS_BASE_URL` at any compatible API.

### Switching to a real provider

```bash
# .env
AMADEUS_MODE=live
AMADEUS_CLIENT_ID=…
AMADEUS_CLIENT_SECRET=…
AMADEUS_BASE_URL=https://your-provider.example.com
```

If your provider's response shape differs from Amadeus, edit the parsing in `amadeus.ts` — the rest of the stack (route, DB, frontend) stays the same.

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
│       ├── amadeus.ts          # AmadeusClient + getClient() factory
│       ├── mock-amadeus.ts     # MockAmadeusClient (default)
│       ├── mock-data.ts        # in-process hotel fixtures
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

## Notes

- The mock dataset lives in [`backend/src/mock-data.ts`](backend/src/mock-data.ts) — add cities or hotels by appending rows.
- Mock prices are deterministically jittered (±15%) by hotel-ID + check-in date, so prices look "real" but the same query always returns the same answer.
- The mock honors `adults` (small uplift) and `nights` (linear multiplier).
- If you turn on `AMADEUS_MODE=live` while the real Amadeus portal still exists, tokens are valid ~30 minutes and the client caches them in-process.
