# Shattered Oath

Shattered Oath is a playable web prototype for a 30–45 minute fantasy
roguelike. Up to ten players are split between two rival teams. The teams need
each other to keep World Doom below 100, but pursue different faction objectives
and compete for influence.

## Repository layout

- `ui/` — interactive React game interface and UI components
- `backend/` — deterministic game catalog, run generation, dice/card resolution
- `db/` — persistence boundary and PostgreSQL schema
- `shared/` — types shared by UI, backend, and storage
- `app/` — thin Next.js routes and framework entry points
- `public/art/` — original generated game artwork

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Prototype loop

1. A random realm, weather, story, party, skills, and faction contest are dealt.
2. Players choose an action card together.
3. A d20 plus the selected card bonus resolves the chapter.
4. Both factions gain influence, while failure raises shared World Doom.
5. After five chapters, the realm must survive and one faction wins the oath.

The current repository adapter is in-memory for local play. `db/schema.sql`
defines the durable room/player model for a hosted Postgres adapter.
