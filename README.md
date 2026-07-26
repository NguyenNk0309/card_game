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

## Battle loop

1. Each browser chooses any character (duplicates are allowed), enters a saved player name, and clicks one of five slots on Veilbound or Embercourt to join.
2. Every character has a public 10-card deck: 3 character specials, 2 common attacks, 1 common shield, 1 common heal, and 3 no-effect cards. Private card-zone contents and order remain visible only to their owner.
3. Before pressing Ready, a player may switch teams by clicking an empty slot on the other side. Ready locks the player’s team. The battle can start only when every player is ready and each team has at least one player.
4. Living players act from highest Speed to lowest. After every living player resolves a turn, the next phase begins. The match lasts 30 phases and world events occur after every fifth completed phase.
5. Every active turn starts with no card selected. Click a card to select it, click it again to unselect it, then choose a target when required. Inactive hands cannot select cards.
6. Roll against the fresh random target for that turn. A modified total equal to or above the target succeeds. Each failed normal roll immediately grants 1 cumulative pity point.
7. Every card shows a pity cost. **Pity Roll** spends that cost to guarantee the selected card succeeds; no-effect cards cost 0. Every buff and debuff expires at the end of its target's next turn, including a pity, discarded, skipped, cancelled, or timed-out turn.
8. Playing or manually discarding a card moves it to discard and ends the turn. A random replacement is drawn into the same hand slot while draw has cards. Manual Skip and timeout preserve all card zones.
9. Only when both hand and draw are empty does the entire discard pile return to draw, shuffle, and deal up to 4 cards. Graveyard cards are permanently removed from circulation.
10. Returning Light enters Brother Orren's graveyard after its first use. Tactical Purge moves one chosen ally's no-effect common to that ally's graveyard and enters Ione Mire's graveyard after its third use.
11. Eliminate the opposing team to win immediately. Otherwise, after phase 30, the team with more total HP wins, with living players, shield, and influence used for ties.

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
