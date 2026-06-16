import { sql } from "./index.js";

/**
 * Tiny idempotent migration. Keeps the boilerplate self-contained — no
 * separate `db:push` step needed before `docker compose up` works.
 *
 * Candidates can swap this for drizzle-kit migrations any time (`npm run
 * db:generate` to produce SQL files, then a proper migrator at boot).
 */
export async function runMigrations(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS hotel_searches (
      id            SERIAL PRIMARY KEY,
      city_code     VARCHAR(8) NOT NULL,
      check_in_date DATE NOT NULL,
      check_out_date DATE NOT NULL,
      adults        INTEGER NOT NULL DEFAULT 1,
      result_count  INTEGER NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}
