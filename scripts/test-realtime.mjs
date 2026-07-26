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
      classId: "ranger",
      className: "Ranger",
      passiveName: "Deadeye",
      passiveText: "Single-target attacks deal 1 additional damage.",
      skill: "Test Skill",
      skillText: "Used only by the realtime integration test.",
      summary: "Test hero",
      strength: "Attack",
      weakness: "Defense",
      impact: "Realtime test",
      hp: 8,
      maxHp: 8,
      team,
      color: "#a78bfa",
      initials: displayName.slice(0, 2).toUpperCase()
    },
    skillDeck: [{ id: `card-${id}`, name: "Test Skill", type: "Wit", description: "Test", bonus: 4, effect: "damage", target: "enemy", value: 2, unique: true }]
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
      if (socket.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify(message));
      return true;
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
    },
    waitForNext(predicate, timeoutMs = 5000) {
      return new Promise((resolve, reject) => {
        const waiter = { predicate, resolve };
        waiters.push(waiter);
        setTimeout(() => {
          const index = waiters.indexOf(waiter);
          if (index >= 0) waiters.splice(index, 1);
          reject(new Error(`Timed out waiting for the next shared room state. Latest state: ${JSON.stringify(latest)}`));
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
  const slottedTeams = await first.waitFor((state) => state.players.some((item) => item.id === thirdId));
  assert.equal(slottedTeams.players.find((item) => item.id === secondId).hero.team, "ember", "the clicked join slot assigns the requested team");
  second.send({ type: "team", sessionId: secondId, team: "veil" });
  const switchedTeam = await first.waitFor((state) => state.players.find((item) => item.id === secondId)?.hero.team === "veil");
  assert.equal(switchedTeam.players.find((item) => item.id === secondId).ready, false, "a not-ready player can switch through an empty team slot");
  second.send({ type: "team", sessionId: secondId, team: "ember" });
  await first.waitFor((state) => state.players.find((item) => item.id === secondId)?.hero.team === "ember");

  first.send({ type: "ready", sessionId: firstId, ready: true });
  second.send({ type: "ready", sessionId: secondId, ready: true });
  third.send({ type: "ready", sessionId: thirdId, ready: true });
  await Promise.all([
    first.waitFor((state) => state.players.filter((item) => [firstId, secondId, thirdId].includes(item.id)).length === 3 && state.players.filter((item) => [firstId, secondId, thirdId].includes(item.id)).every((item) => item.ready)),
    second.waitFor((state) => state.players.filter((item) => [firstId, secondId, thirdId].includes(item.id)).length === 3 && state.players.filter((item) => [firstId, secondId, thirdId].includes(item.id)).every((item) => item.ready))
  ]);

  const game = {
    adventure: { seed: "TEST", realm: {}, chapter: 1, maxChapters: 30, story: "Test", event: "Test", target: 12, worldDoom: 0, veilInfluence: 0, emberInfluence: 0 },
    activePlayerIndex: 0,
    completedTurns: 0,
    completedPhases: 0,
    roll: null,
    outcome: null,
    playerStates: {
      [firstId]: { sessionId: firstId, hp: 8, maxHp: 8, shield: 0, attackBuff: 0, diceBuff: 2, dicePenalty: 2, hand: [`card-${firstId}`], drawPile: [], discardPile: [], graveyard: ["buried-first"], cardUses: {} },
      [secondId]: { sessionId: secondId, hp: 8, maxHp: 8, shield: 0, attackBuff: 0, diceBuff: 0, dicePenalty: 0, hand: [`card-${secondId}`], drawPile: [], discardPile: [], graveyard: [], cardUses: {} },
      [thirdId]: { sessionId: thirdId, hp: 8, maxHp: 8, shield: 0, attackBuff: 0, diceBuff: 0, dicePenalty: 0, hand: [`card-${thirdId}`], drawPile: [], discardPile: [], graveyard: [], cardUses: {} }
    },
    turnOrder: [firstId, secondId, thirdId],
    turnStartedAt: Date.now(),
    turnDeadline: Date.now() + 400,
    turnSeconds: 1,
    maxTurns: 30,
    maxPhases: 30,
    ended: false,
    endReason: null,
    winnerTeam: null,
    history: [],
    worldEvent: null
  };
  second.send({ type: "start", game });
  const [firstStarted, secondStarted] = await Promise.all([
    first.waitFor((state) => state.phase === "game"),
    second.waitFor((state) => state.phase === "game")
  ]);
  assert.deepEqual(firstStarted.game.playerStates[firstId].hand, [`card-${firstId}`], "a WebSocket client receives its own hand");
  assert.deepEqual(firstStarted.game.playerStates[firstId].graveyard, ["buried-first"], "a WebSocket client receives its own graveyard");
  assert.deepEqual(firstStarted.game.playerStates[secondId].hand, [], "a WebSocket client cannot receive another player's hand");
  assert.deepEqual(secondStarted.game.playerStates[secondId].hand, [`card-${secondId}`], "each WebSocket view is personalized");
  assert.deepEqual(secondStarted.game.playerStates[firstId].hand, [], "other draw and hand data stays private");
  assert.deepEqual(secondStarted.game.playerStates[firstId].graveyard, [], "another player's graveyard remains private");
  assert.equal(firstStarted.viewerSessionId, firstId, "WebSocket snapshots identify the session whose private zones they contain");
  assert.equal(firstStarted.game.turnSeconds, 60, "the room overrides every client timer with a constant 60 seconds");
  assert(firstStarted.game.turnDeadline - firstStarted.game.turnStartedAt === 60_000, "every battle turn receives exactly 60 seconds");

  const expiryProbePromise = first.waitForNext((state) => state.phase === "game");
  first.send({ type: "expire-turn", sessionId: firstId });
  const expiryProbe = await expiryProbePromise;
  assert.equal(expiryProbe.viewerSessionId, firstId, "an expiry check remains personalized for its requesting browser");
  assert.deepEqual(expiryProbe.game.playerStates[firstId].hand, [`card-${firstId}`], "an early expiry check cannot replace the owner's hand with a privacy-filtered empty snapshot");

  const controlledGame = structuredClone(firstStarted.game);
  controlledGame.completedTurns = 1;
  controlledGame.completedPhases = 0;
  controlledGame.activePlayerIndex = 1;
  controlledGame.turnOrder = [secondId, thirdId, firstId];
  controlledGame.roundNumber = 1;
  controlledGame.roundOrder = [firstId, secondId, thirdId];
  controlledGame.actedThisRound = [firstId];
  controlledGame.playerStates[firstId].hand = [];
  controlledGame.playerStates[firstId].discardPile = [`card-${firstId}`];
  controlledGame.playerStates[secondId].skipTurns = 1;
  controlledGame.playerStates[secondId].shield = 4;
  controlledGame.playerStates[secondId].attackBuff = 2;
  controlledGame.playerStates[secondId].diceBuff = 2;
  controlledGame.playerStates[secondId].dicePenalty = 1;
  controlledGame.playerStates[thirdId].shield = 3;
  controlledGame.outcome = { kind: "card", success: true, total: 20, target: 12, label: "Test control", detail: "The next enemy turn will be cancelled.", actorName: firstStarted.players.find((item) => item.id === firstId).displayName, cardName: "Test Skill", targetName: firstStarted.players.find((item) => item.id === secondId).displayName };
  controlledGame.history = [{ id: `control-${runId}`, turn: 1, kind: "support", actorName: "First", message: "Applied a turn-cancel effect.", success: true, createdAt: Date.now() }];
  first.send({ type: "game:update", game: controlledGame });
  const forcedSkipped = await first.waitFor((state) => state.game?.completedTurns === 2 && state.game?.outcome?.kind === "forced-skip");
  const forcedSkippedOwnerView = await second.waitFor((state) => state.game?.completedTurns === 2 && state.game?.outcome?.kind === "forced-skip");
  assert.equal(forcedSkipped.game.turnOrder[0], thirdId, "a cancelled enemy turn passes immediately to the next player");
  assert.equal(forcedSkipped.game.history.at(-1).kind, "forced-skip");
  assert.equal(forcedSkipped.game.completedPhases, 0, "a phase remains open until every player has acted");
  assert.deepEqual(forcedSkippedOwnerView.game.playerStates[secondId].hand, [`card-${secondId}`], "forced skip preserves the affected player's private hand");
  assert.equal(forcedSkippedOwnerView.game.playerStates[secondId].skipTurns, 0);
  assert.deepEqual(
    ["shield", "attackBuff", "diceBuff", "dicePenalty"].map((field) => forcedSkippedOwnerView.game.playerStates[secondId][field]),
    [0, 0, 0, 0],
    "a cancelled turn still expires every timed buff and debuff"
  );

  third.send({ type: "skip-turn", sessionId: thirdId });
  const manuallySkipped = await third.waitFor((state) => state.game?.completedTurns === 3);
  assert.equal(manuallySkipped.game.outcome.kind, "skip");
  assert.equal(manuallySkipped.game.history.at(-1).kind, "skip");
  assert.equal(manuallySkipped.game.completedPhases, 1, "the phase completes after all three players act");
  assert.equal(manuallySkipped.game.playerStates[thirdId].shield, 0, "a manual skip still expires shield at turn end");
  assert.deepEqual(manuallySkipped.game.playerStates[thirdId].hand, [`card-${thirdId}`], "manual skip preserves the hand");
  assert.deepEqual(manuallySkipped.game.playerStates[thirdId].drawPile, [], "manual skip preserves the draw pile");
  assert.deepEqual(manuallySkipped.game.playerStates[thirdId].discardPile, [], "manual skip preserves the discard pile");
  assert.equal(manuallySkipped.game.turnOrder[0], firstId);

  first.send({ type: "remove-player", sessionId: firstId, targetSessionId: thirdId });
  const removedDuringGame = await first.waitFor((state) => !state.players.some((item) => item.id === thirdId));
  assert.equal(removedDuringGame.game.ended, false);
  assert.equal(removedDuringGame.game.playerStates[thirdId], undefined);
  assert(!removedDuringGame.game.turnOrder.includes(thirdId));

  second.send({ type: "end-game", sessionId: secondId });
  const manuallyEnded = await first.waitFor((state) => state.game?.ended === true);
  assert.equal(manuallyEnded.game.winnerTeam, "ember", "manual end uses the phase-30 judgment and the ending player's team resolves a complete tie");
  assert.match(manuallyEnded.game.endReason, /Embercourt wins\. Total HP: Veilbound 8 — Embercourt 8\./);
  second.send({ type: "leave-game", sessionId: secondId });
  await first.waitFor((state) => !state.players.some((item) => item.id === secondId));

  console.log("Realtime test passed: private hands, 60-second timer, forced/manual skips, preserved cards, player removal, end game, and leave game.");
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
