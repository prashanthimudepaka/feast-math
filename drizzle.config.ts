import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load .env.local too (Next.js convention, where the README puts secrets) —
// plain dotenv reads only .env. Pre-set env vars still take precedence, so
// inline DATABASE_URL=... overrides (docs/DEPLOY.md step 4) keep working.
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
