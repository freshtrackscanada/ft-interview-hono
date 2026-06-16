import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import health from "./routes/health.js";
import hotels from "./routes/hotels.js";
import { runMigrations } from "./db/migrate.js";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (process.env.CORS_ALLOWED_ORIGINS ?? "http://localhost:3000")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  }),
);

app.route("/api/health", health);
app.route("/api/hotels", hotels);

const port = Number(process.env.PORT ?? 8000);

(async () => {
  try {
    await runMigrations();
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }

  serve({ fetch: app.fetch, port, hostname: "0.0.0.0" });
  console.log(`▶ Hono listening on http://0.0.0.0:${port}`);
})();
