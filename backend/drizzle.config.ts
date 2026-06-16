import type { Config } from "drizzle-kit";

const {
  POSTGRES_HOST = "localhost",
  POSTGRES_PORT = "5432",
  POSTGRES_USER = "ft_user",
  POSTGRES_PASSWORD = "ft_password",
  POSTGRES_DB = "ft_interview",
} = process.env;

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`,
  },
} satisfies Config;
