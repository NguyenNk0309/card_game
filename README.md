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
2. Each browser chooses an unclaimed hero and reviews that hero's 15-card deck before joining.
3. Every deck has five character-specific skill cards and ten common interaction cards; teams are balanced on join.
4. Once everyone is ready, any player can press **Enter the game**. Every connected browser moves into the same adventure.
5. On each 30-second turn, the active player chooses one of five cards in hand, selects a valid target, and rolls.
6. Cards can heal allies, damage rivals, grant shields, support the realm, or resolve story checks.
7. Played cards enter the graveyard. When the draw pile empties, the graveyard is shuffled into a new draw pile.
8. An expired turn passes automatically and raises World Doom. Players may leave, end the run, or remove another player after confirmation.
9. Both factions gain influence while failure raises shared World Doom; the realm must survive before either team can win.

The shared room is authoritative and in-memory: separate browser sessions see
the same players, readiness, start event, turns, dice results, and story state in
real time. Restarting the server or deployment clears the room. `db/schema.sql`
defines the durable room/player model for a future persistent adapter.

To exercise the multi-client protocol while the development server is running,
point `ROOM_URL` or `ROOM_HTTP_URL` at its port and run `npm run test:realtime`
or `npm run test:polling` in another terminal.

## Free internet deployment

The complete UI and shared realtime backend can deploy as one Cloudflare Worker.
Cloudflare's free plan is suitable for this hobby game. The first anonymous
preview deployment can be created with:

```bash
npm run redeploy:temporary
```

Wrangler prints the playable URL and a claim link. Claim it within 60 minutes.
After claiming the Worker or signing in once with `npx wrangler login`, redeploy
every future code change with the single command:

```bash
npm run redeploy
```

Both commands run TypeScript validation, create the production build, start that
build locally, and exercise the WebSocket and HTTP multiplayer protocols before
uploading anything.
