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
    hero: { id: `hero-${id}`, name: `${displayName} Hero`, title: "Test Oath", role: "Scout", classId: "ranger", className: "Xạ thủ", passiveName: "Ngắm chuẩn", passiveText: "Đòn đánh đơn gây thêm 1 sát thương.", skill: "Test Skill", skillText: "Test", summary: "Test hero", strength: "Attack", weakness: "Defense", impact: "Polling test", hp: 8, maxHp: 8, team, color: "#a78bfa", initials: displayName.slice(0, 2).toUpperCase() },
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

async function readRoom() {
  const response = await fetch(roomUrl, { cache: "no-store" });
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
  const timedOut = await waitForRoom((state) => state.game?.completedTurns === 1);
  assert.equal(timedOut.game.completedTurns, 1);
  assert.equal(timedOut.game.activePlayerIndex, 1);
  assert.equal(timedOut.game.outcome.kind, 'timeout');
  assert.equal(timedOut.game.history.at(-1).kind, 'timeout');
  assert.equal(timedOut.game.playerStates[firstId].diceBuff, 0);
  assert.equal(timedOut.game.playerStates[firstId].dicePenalty, 0);
  assert.equal(timedOut.game.turnOrder[0], secondId);

  const removedDuringGame = await command(firstId, { type: "remove-player", targetSessionId: thirdId });
  assert(!removedDuringGame.players.some((item) => item.id === thirdId));
  assert.equal(removedDuringGame.game.ended, false);
  assert.equal(removedDuringGame.game.playerStates[thirdId], undefined);
  assert(!removedDuringGame.game.turnOrder.includes(thirdId));

  const ended = await command(secondId, { type: "end-game" });
  assert.equal(ended.game.ended, true);
  const left = await command(secondId, { type: "leave-game" });
  assert(!left.players.some((item) => item.id === secondId));
  console.log("Polling test passed: shared lobby, player removal, timed auto-pass, end game, and leave game.");
} finally {
  await command(firstId, { type: "return:lobby" }).catch(() => {});
  await command(firstId, { type: "leave" }).catch(() => {});
  await command(secondId, { type: "leave" }).catch(() => {});
  await command(thirdId, { type: "leave" }).catch(() => {});
}
