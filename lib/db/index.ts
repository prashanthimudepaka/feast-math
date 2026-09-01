import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Reuse one connection across Next.js dev hot-reloads.
const globalForDb = globalThis as unknown as { conn?: ReturnType<typeof postgres> };

// prepare:false keeps postgres.js compatible with transaction-mode poolers
// (Neon's pooled endpoint / pgbouncer) used in serverless deployments.
// Harmless locally against plain Postgres.
const conn =
  globalForDb.conn ?? postgres(process.env.DATABASE_URL!, { prepare: false });
if (process.env.NODE_ENV !== "production") globalForDb.conn = conn;

export const db = drizzle(conn, { schema });
