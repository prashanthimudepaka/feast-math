# Feast Math 🍛

**"Feeding 60 people — how much rice do I actually cook?"**

Feast Math answers the question every Indian household faces before a function.
Give it your event — guest count, menu, region, serving style — and it produces
per-dish cooking quantities, an aggregated shopping list rounded to real pack
sizes, a backwards-planned cooking timeline, and a leftover plan. Knowledge that
normally lives only in a caterer's head.

## Why it's built the way it is

LLMs are good at *judgment* and bad at *arithmetic*, so Feast Math splits the job:

- **An LLM (Gemini, structured JSON output)** provides per-average-adult
  consumption *rates* per dish — never final quantities — adjusted for menu
  breadth, region, and per-dish "enrichment" notes (e.g. *extra ghee, less spicy*).
- **A deterministic TypeScript engine** does all the math: guest counts, kid
  factors, appetite/serving-style multipliers, a caterer-style safety buffer,
  shopping-friendly rounding, and cross-dish ingredient aggregation.
- **An anchor table** of bulk-cooking norms clamps any rate the model proposes
  outside sane caterer ranges, and every number renders with its full
  derivation — *"Why this number?"* is a first-class UI feature.

Every plan is versioned; regenerating after a menu change creates a new version
instead of overwriting history.

## Stack

Next.js 16 (App Router, TypeScript, Tailwind 4) · Better Auth (email/password +
optional Google) · Drizzle ORM · PostgreSQL 17 (Docker) · Gemini API · Zod

## Local development

```bash
cp .env.example .env.local   # fill in secrets (see comments inside)
docker compose up -d db      # Postgres 17 with a named volume
npm install
npm run db:migrate
npm run dev                  # http://localhost:3000
```

Real AI plans need a free Gemini key from [aistudio.google.com](https://aistudio.google.com)
(`GEMINI_API_KEY` in `.env.local`). Or set `FEAST_MOCK_PLAN=1` for an offline
demo mode that exercises the entire engine and UI with zero API calls.

## Status

- ✅ Phase 1 — scaffold, Dockerized Postgres, schema & migrations
- ✅ Phase 2 — authentication (adversarially reviewed & hardened)
- ✅ Phase 3 — event wizard, AI parameter generation, quantity engine,
  menu customization with enrichment notes, plan versioning, shopping checklist
- ⏳ Phase 4 — share links, print view, polish
- ⏳ Phase 5 — deploy to Vercel
- ⏳ Phase 6 — multi-stage Dockerfile + one-command compose stack
- 🔭 v2 — post-event feedback loop: predicted vs. actual consumption per dish
