import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";

const {
  POSTGRES_HOST = "db",
  POSTGRES_PORT = "5432",
  POSTGRES_USER = "ft_user",
  POSTGRES_PASSWORD = "ft_password",
  POSTGRES_DB = "ft_interview",
} = process.env;

const connectionString = `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`;

export const sql = postgres(connectionString, { max: 10 });
export const db = drizzle(sql, { schema });
export { schema };
