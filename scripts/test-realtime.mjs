import assert from "node:assert/strict";
import WebSocket from "ws";

const roomUrl = process.env.ROOM_URL || "ws://127.0.0.1:3102/ws";
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function player(id, displayName, team) {
  return {
    id,
    displayName,
    ready: false,
    joinedAt: Date.now(),
    hero: {
      id: `hero-${id}`,
      name: `${displayName} Hero`,
      title: "Test Oath",
      role: "Scout",
      skill: "Test Skill",
      skillText: "Used only by the realtime integration test.",
      hp: 8,
      maxHp: 8,
      team,
      color: "#a78bfa",
      initials: displayName.slice(0, 2).toUpperCase()
    },
    skillDeck: [{ id: `card-${id}`, name: "Test Skill", type: "Wit", description: "Test", bonus: 4, risk: 1, effect: "check", target: "none", value: 0, unique: true }]
  };
}

function connect(sessionId) {
  const socket = new WebSocket(roomUrl);
  const waiters = [];
  let latest = null;

  socket.on("message", (raw) => {
    const message = JSON.parse(String(raw));
    if (message.type !== "state") return;
    latest = message.state;
    for (const waiter of [...waiters]) {
      if (waiter.predicate(latest)) {
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.resolve(latest);
      }
    }
  });

  const opened = new Promise((resolve, reject) => {
    socket.once("open", () => {
      socket.send(JSON.stringify({ type: "hello", sessionId }));
      resolve();
    });
    socket.once("error", reject);
  });

  return {
    socket,
    opened,
    send(message) {
      socket.send(JSON.stringify(message));
    },
    waitFor(predicate, timeoutMs = 5000) {
      if (latest && predicate(latest)) return Promise.resolve(latest);
      return new Promise((resolve, reject) => {
        const waiter = { predicate, resolve };
        waiters.push(waiter);
        setTimeout(() => {
          const index = waiters.indexOf(waiter);
          if (index >= 0) waiters.splice(index, 1);
          reject(new Error(`Timed out waiting for shared room state. Latest state: ${JSON.stringify(latest)}`));
        }, timeoutMs);
      });
    }
  };
}

const firstId = `browser-first-${runId}`;
const secondId = `browser-second-${runId}`;
const thirdId = `browser-third-${runId}`;
const first = connect(firstId);
const second = connect(secondId);
const third = connect(thirdId);

try {
  await Promise.all([first.opened, second.opened, third.opened]);
  first.send({ type: "join", player: player(firstId, `First ${runId}`, "veil") });
  await first.waitFor((state) => state.players.some((item) => item.id === firstId));

  second.send({ type: "join", player: player(secondId, `Second ${runId}`, "ember") });
  const [firstView, secondView] = await Promise.all([
    first.waitFor((state) => state.players.some((item) => item.id === secondId)),
    second.waitFor((state) => state.players.some((item) => item.id === firstId) && state.players.some((item) => item.id === secondId))
  ]);
  assert.equal(firstView.players.length, secondView.players.length);

  first.send({ type: "remove-player", sessionId: firstId, targetSessionId: secondId });
  await Promise.all([
    first.waitFor((state) => !state.players.some((item) => item.id === secondId)),
    second.waitFor((state) => !state.players.some((item) => item.id === secondId))
  ]);
  second.send({ type: "join", player: player(secondId, `Second ${runId}`, "ember") });
  await first.waitFor((state) => state.players.some((item) => item.id === secondId));
  third.send({ type: "join", player: player(thirdId, `Third ${runId}`, "veil") });
  await first.waitFor((state) => state.players.some((item) => item.id === thirdId));

  first.send({ type: "ready", sessionId: firstId, ready: true });
  second.send({ type: "ready", sessionId: secondId, ready: true });
  third.send({ type: "ready", sessionId: thirdId, ready: true });
  await Promise.all([
    first.waitFor((state) => state.players.filter((item) => [firstId, secondId, thirdId].includes(item.id)).length === 3 && state.players.filter((item) => [firstId, secondId, thirdId].includes(item.id)).every((item) => item.ready)),
    second.waitFor((state) => state.players.filter((item) => [firstId, secondId, thirdId].includes(item.id)).length === 3 && state.players.filter((item) => [firstId, secondId, thirdId].includes(item.id)).every((item) => item.ready))
  ]);

  const game = {
    adventure: { seed: "TEST", realm: {}, chapter: 1, maxChapters: 18, story: "Test", event: "Test", target: 12, worldDoom: 0, veilInfluence: 0, emberInfluence: 0 },
    activePlayerIndex: 0,
    completedTurns: 0,
    roll: null,
    outcome: null,
    playerStates: {
      [firstId]: { sessionId: firstId, hp: 8, maxHp: 8, shield: 0, hand: [`card-${firstId}`], drawPile: [], discardPile: [] },
      [secondId]: { sessionId: secondId, hp: 8, maxHp: 8, shield: 0, hand: [`card-${secondId}`], drawPile: [], discardPile: [] },
      [thirdId]: { sessionId: thirdId, hp: 8, maxHp: 8, shield: 0, hand: [`card-${thirdId}`], drawPile: [], discardPile: [] }
    },
    turnStartedAt: Date.now(),
    turnDeadline: Date.now() + 400,
    turnSeconds: 1,
    maxTurns: 36,
    ended: false,
    endReason: null
  };
  second.send({ type: "start", game });
  await Promise.all([
    first.waitFor((state) => state.phase === "game"),
    second.waitFor((state) => state.phase === "game")
  ]);

  const timedOut = await first.waitFor((state) => state.game?.completedTurns === 1);
  assert.equal(timedOut.game.activePlayerIndex, 1);
  assert.match(timedOut.game.outcome.label, /ran out of time/);

  first.send({ type: "remove-player", sessionId: firstId, targetSessionId: thirdId });
  const removedDuringGame = await first.waitFor((state) => !state.players.some((item) => item.id === thirdId));
  assert.equal(removedDuringGame.game.ended, false);
  assert.equal(removedDuringGame.game.playerStates[thirdId], undefined);

  second.send({ type: "end-game", sessionId: secondId });
  await first.waitFor((state) => state.game?.ended === true);
  second.send({ type: "leave-game", sessionId: secondId });
  await first.waitFor((state) => !state.players.some((item) => item.id === secondId));

  console.log("Realtime test passed: shared lobby, player removal, timed auto-pass, end game, and leave game.");
} finally {
  first.send({ type: "return:lobby" });
  await first.waitFor((state) => state.phase === "lobby").catch(() => {});
  first.send({ type: "leave", sessionId: firstId });
  second.send({ type: "leave", sessionId: secondId });
  third.send({ type: "leave", sessionId: thirdId });
  first.socket.close();
  second.socket.close();
  third.socket.close();
}
