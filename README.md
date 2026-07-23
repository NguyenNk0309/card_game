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

1. Each player enters a unique name and presses **Join** to create one session.
2. Every session receives a random hero, team, and personal three-card skill deck.
3. Players review their character, then each presses **Ready**.
4. Once everyone is ready, any player can press **Enter the game**. Every connected browser moves into the same adventure.
5. Every joined player chooses a character skill and rolls once per chapter.
6. The chapter count scales with party size to produce roughly 36–40 total turns per adventure.
7. Both factions gain influence while failure raises shared World Doom; the realm must survive before either team can win.

The shared room is authoritative and in-memory: separate browser sessions see
the same players, readiness, start event, turns, dice results, and story state in
real time. Restarting the server or deployment clears the room. `db/schema.sql`
defines the durable room/player model for a future persistent adapter.

To exercise the multi-client protocol while the development server is running
on port 3102, run `npm run test:realtime` in another terminal.
