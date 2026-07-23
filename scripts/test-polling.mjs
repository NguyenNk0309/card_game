import assert from "node:assert/strict";

const roomUrl = process.env.ROOM_HTTP_URL || "http://127.0.0.1:3105/api/room";
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const firstId = `poll-first-${runId}`;
const secondId = `poll-second-${runId}`;

function player(id, displayName, team) {
  return {
    id,
    displayName,
    ready: false,
    joinedAt: Date.now(),
    hero: { id: `hero-${id}`, name: `${displayName} Hero`, title: "Test Oath", role: "Scout", skill: "Test Skill", skillText: "Test", hp: 8, maxHp: 8, team, color: "#a78bfa", initials: displayName.slice(0, 2).toUpperCase() },
    skillDeck: [{ id: `card-${id}`, name: "Test Skill", type: "Wit", description: "Test", bonus: 4, risk: 1 }]
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

try {
  await command(firstId, { type: "join", player: player(firstId, `First ${runId}`, "veil") });
  const joined = await command(secondId, { type: "join", player: player(secondId, `Second ${runId}`, "ember") });
  assert(joined.players.some((item) => item.id === firstId));
  assert(joined.players.some((item) => item.id === secondId));

  await command(firstId, { type: "ready" });
  const ready = await command(secondId, { type: "ready" });
  assert(ready.players.filter((item) => item.id === firstId || item.id === secondId).every((item) => item.ready));

  const game = {
    adventure: { seed: "POLL", realm: {}, chapter: 1, maxChapters: 18, story: "Test", event: "Test", target: 12, worldDoom: 0, veilInfluence: 0, emberInfluence: 0 },
    activePlayerIndex: 0,
    completedTurns: 0,
    roll: null,
    outcome: null
  };
  const started = await command(secondId, { type: "start", game });
  assert.equal(started.phase, "game");
  console.log("Polling test passed: separate sessions shared players, readiness, and game start.");
} finally {
  await command(firstId, { type: "return:lobby" }).catch(() => {});
  await command(firstId, { type: "leave" }).catch(() => {});
  await command(secondId, { type: "leave" }).catch(() => {});
}
