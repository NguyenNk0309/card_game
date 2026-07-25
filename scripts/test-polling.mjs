import assert from "node:assert/strict";

const roomUrl = process.env.ROOM_HTTP_URL || "http://127.0.0.1:3105/api/room";
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const firstId = `poll-first-${runId}`;
const secondId = `poll-second-${runId}`;
const thirdId = `poll-third-${runId}`;

function player(id, displayName, team) {
  return {
    id,
    displayName,
    ready: false,
    joinedAt: Date.now(),
    hero: { id: `hero-${id}`, name: `${displayName} Hero`, title: "Test Oath", role: "Scout", classId: "ranger", className: "Ranger", passiveName: "Deadeye", passiveText: "Single-target attacks deal 1 additional damage.", skill: "Test Skill", skillText: "Test", summary: "Test hero", strength: "Attack", weakness: "Defense", impact: "Polling test", hp: 8, maxHp: 8, team, color: "#a78bfa", initials: displayName.slice(0, 2).toUpperCase() },
    skillDeck: [{ id: `card-${id}`, name: "Test Skill", type: "Wit", description: "Test", bonus: 4, effect: "damage", target: "enemy", value: 2, unique: true }]
  };
}

async function command(sessionId, message) {
  const response = await fetch(roomUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...message, sessionId })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Room request failed with ${response.status}.`);
  return result.state;
}

async function readRoom(sessionId = firstId) {
  const url = new URL(roomUrl);
  url.searchParams.set("sessionId", sessionId);
  const response = await fetch(url, { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Room request failed with ${response.status}.`);
  return result.state;
}

async function waitForRoom(predicate, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await readRoom();
    if (predicate(state)) return state;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for the shared polling room state.");
}

try {
  await command(firstId, { type: "join", player: player(firstId, `First ${runId}`, "veil") });
  const joined = await command(secondId, { type: "join", player: player(secondId, `Second ${runId}`, "ember") });
  assert(joined.players.some((item) => item.id === firstId));
  assert(joined.players.some((item) => item.id === secondId));

  const removedFromLobby = await command(firstId, { type: "remove-player", targetSessionId: secondId });
  assert(!removedFromLobby.players.some((item) => item.id === secondId));
  await command(secondId, { type: "join", player: player(secondId, `Second ${runId}`, "ember") });
  await command(thirdId, { type: "join", player: player(thirdId, `Third ${runId}`, "veil") });

  await command(firstId, { type: "ready", ready: true });
  await command(secondId, { type: "ready", ready: true });
  const ready = await command(thirdId, { type: "ready", ready: true });
  assert.equal(ready.players.filter((item) => [firstId, secondId, thirdId].includes(item.id)).length, 3);
  assert(ready.players.filter((item) => [firstId, secondId, thirdId].includes(item.id)).every((item) => item.ready));

  const game = {
    adventure: { seed: "POLL", realm: {}, chapter: 1, maxChapters: 30, story: "Test", event: "Test", target: 12, worldDoom: 0, veilInfluence: 0, emberInfluence: 0 },
    activePlayerIndex: 0,
    completedTurns: 0,
    roll: null,
    outcome: null,
    playerStates: {
      [firstId]: { sessionId: firstId, hp: 8, maxHp: 8, shield: 0, attackBuff: 0, diceBuff: 2, dicePenalty: 2, hand: [`card-${firstId}`], drawPile: [], discardPile: [] },
      [secondId]: { sessionId: secondId, hp: 8, maxHp: 8, shield: 0, attackBuff: 0, diceBuff: 0, dicePenalty: 0, hand: [`card-${secondId}`], drawPile: [], discardPile: [] },
      [thirdId]: { sessionId: thirdId, hp: 8, maxHp: 8, shield: 0, attackBuff: 0, diceBuff: 0, dicePenalty: 0, hand: [`card-${thirdId}`], drawPile: [], discardPile: [] }
    },
    turnOrder: [firstId, secondId, thirdId],
    turnStartedAt: Date.now(),
    turnDeadline: Date.now() + 300,
    turnSeconds: 1,
    maxTurns: 30,
    ended: false,
    endReason: null,
    winnerTeam: null,
    history: [],
    worldEvent: null
  };
  const started = await command(secondId, { type: "start", game });
  assert.equal(started.phase, "game");
  assert.deepEqual(started.game.playerStates[secondId].hand, [`card-${secondId}`], "a polling client receives its own hand");
  assert.deepEqual(started.game.playerStates[firstId].hand, [], "a polling client cannot receive another player's hand");
  const firstStarted = await readRoom(firstId);
  assert.deepEqual(firstStarted.game.playerStates[firstId].hand, [`card-${firstId}`], "polling responses are personalized by session");
  assert.deepEqual(firstStarted.game.playerStates[secondId].hand, [], "other card zones remain private during polling");
  assert.equal(firstStarted.game.turnSeconds, 30, "the polling room enforces a constant 30-second timer");
  assert.equal(firstStarted.game.turnDeadline - firstStarted.game.turnStartedAt, 30_000, "every polling turn receives exactly 30 seconds");
  const controlledGame = structuredClone(firstStarted.game);
  controlledGame.completedTurns = 1;
  controlledGame.activePlayerIndex = 1;
  controlledGame.turnOrder = [secondId, thirdId, firstId];
  controlledGame.playerStates[firstId].hand = [];
  controlledGame.playerStates[firstId].discardPile = [`card-${firstId}`];
  controlledGame.playerStates[secondId].skipTurns = 1;
  controlledGame.outcome = { kind: "card", success: true, total: 20, target: 12, label: "Test control", detail: "The next enemy turn will be cancelled.", actorName: firstStarted.players.find((item) => item.id === firstId).displayName, cardName: "Test Skill", targetName: firstStarted.players.find((item) => item.id === secondId).displayName };
  controlledGame.history = [{ id: `control-${runId}`, turn: 1, kind: "support", actorName: "First", message: "Applied a turn-cancel effect.", success: true, createdAt: Date.now() }];
  const forcedSkipped = await command(firstId, { type: "game:update", game: controlledGame });
  const forcedOwnerView = await readRoom(secondId);
  assert(Number.isFinite(forcedSkipped.serverNow), "room responses include authoritative server time");
  assert.equal(forcedSkipped.game.completedTurns, 2);
  assert.equal(forcedSkipped.game.outcome.kind, "forced-skip");
  assert.equal(forcedSkipped.game.history.at(-1).kind, "forced-skip");
  assert.equal(forcedSkipped.game.turnOrder[0], thirdId);
  assert.deepEqual(forcedOwnerView.game.playerStates[secondId].hand, [`card-${secondId}`], "forced skip preserves the affected player's hand");
  assert.equal(forcedOwnerView.game.playerStates[secondId].skipTurns, 0);

  const manuallySkipped = await command(thirdId, { type: "skip-turn" });
  assert.equal(manuallySkipped.game.completedTurns, 3);
  assert.equal(manuallySkipped.game.outcome.kind, "skip");
  assert.equal(manuallySkipped.game.history.at(-1).kind, "skip");
  assert.deepEqual(manuallySkipped.game.playerStates[thirdId].hand, [`card-${thirdId}`], "manual skip preserves the hand");
  assert.deepEqual(manuallySkipped.game.playerStates[thirdId].drawPile, [], "manual skip preserves the draw pile");
  assert.deepEqual(manuallySkipped.game.playerStates[thirdId].discardPile, [], "manual skip preserves the discard pile");
  assert.equal(manuallySkipped.game.turnOrder[0], firstId);

  const removedDuringGame = await command(firstId, { type: "remove-player", targetSessionId: thirdId });
  assert(!removedDuringGame.players.some((item) => item.id === thirdId));
  assert.equal(removedDuringGame.game.ended, false);
  assert.equal(removedDuringGame.game.playerStates[thirdId], undefined);
  assert(!removedDuringGame.game.turnOrder.includes(thirdId));

  const ended = await command(secondId, { type: "end-game" });
  assert.equal(ended.game.ended, true);
  const left = await command(secondId, { type: "leave-game" });
  assert(!left.players.some((item) => item.id === secondId));
  console.log("Polling test passed: private hands, 30-second timer, forced/manual skips, preserved cards, player removal, end game, and leave game.");
} finally {
  await command(firstId, { type: "return:lobby" }).catch(() => {});
  await command(firstId, { type: "leave" }).catch(() => {});
  await command(secondId, { type: "leave" }).catch(() => {});
  await command(thirdId, { type: "leave" }).catch(() => {});
}
