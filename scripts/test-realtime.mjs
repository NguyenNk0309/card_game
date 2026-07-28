import assert from "node:assert/strict";
import WebSocket from "ws";

const roomUrl = process.env.ROOM_URL || "ws://127.0.0.1:3102/ws";
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function testSkillDeck(id) {
  const special = [
    { id: `card-${id}`, name: "Test Skill", type: "Wit", description: "Test", bonus: 0, effect: "damage", target: "enemy", value: 2, unique: true },
    { id: `purge-${id}`, name: "Tactical Purge", type: "Wit", description: "Temporarily purge a random enemy hand card.", bonus: 0, effect: "support", target: "enemy", value: 2, supportType: "purge-card", unique: true },
    { id: `pilfer-${id}`, name: "Pilfered Chance", type: "Wit", description: "Steal a random enemy hand card, preferring special cards.", bonus: 0, effect: "support", target: "enemy", value: 1, supportType: "steal-card", unique: true },
    { id: `favor-${id}`, name: "Favorable Omen", type: "Spirit", description: "Make one ally's next played card cost 0 pity.", bonus: 0, effect: "support", target: "ally", value: 2, supportType: "zero-pity", unique: true }
  ];
  const common = [
    { id: "heavy", name: "Heavy Blow", type: "Might", description: "Deal 4 damage.", effect: "damage", target: "enemy", value: 4 },
    { id: "brace", name: "Brace", type: "Spirit", description: "Gain 3 shield.", effect: "guard", target: "self", value: 3 },
    { id: "second-wind", name: "Second Wind", type: "Spirit", description: "Restore up to 4 HP.", effect: "heal", target: "self", value: 4 },
    { id: "empty-gesture", name: "Empty Gesture", type: "Spirit", description: "Upgrades to healing.", effect: "none", target: "self", value: 0 },
    { id: "broken-plan", name: "Broken Plan", type: "Wit", description: "Upgrades to shielding.", effect: "none", target: "self", value: 0 },
    { id: "lost-momentum", name: "Lost Momentum", type: "Might", description: "Upgrades to heavy damage.", effect: "none", target: "self", value: 0 }
  ].map((card) => ({ ...card, id: `${id}-common-${card.id}`, bonus: 0, unique: false }));
  return [...special, ...common];
}

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
      speed: id.includes("second") ? 10 : 5,
      team,
      color: "#a78bfa",
      initials: displayName.slice(0, 2).toUpperCase()
    },
    skillDeck: testSkillDeck(id)
  };
}

function connect(sessionId) {
  const socket = new WebSocket(roomUrl);
  const waiters = [];
  const errorWaiters = [];
  let latest = null;

  socket.on("message", (raw) => {
    const message = JSON.parse(String(raw));
    if (message.type === "error") {
      const errorMessage = String(message.message || "The room rejected the action.");
      for (const waiter of [...errorWaiters]) {
        if (waiter.predicate(errorMessage)) {
          errorWaiters.splice(errorWaiters.indexOf(waiter), 1);
          waiter.resolve(errorMessage);
        }
      }
      return;
    }
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
    },
    waitForError(predicate, timeoutMs = 5000) {
      return new Promise((resolve, reject) => {
        const waiter = { predicate, resolve };
        errorWaiters.push(waiter);
        setTimeout(() => {
          const index = errorWaiters.indexOf(waiter);
          if (index >= 0) errorWaiters.splice(index, 1);
          reject(new Error("Timed out waiting for a shared room error."));
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
  first.send({ type: "join", player: { ...player(firstId, `First ${runId}`, "veil"), randomHero: true } });
  const randomJoined = await first.waitFor((state) => state.players.some((item) => item.id === firstId));
  assert.equal(randomJoined.players.find((item) => item.id === firstId).randomHero, true, "a pending random character can join a realtime team slot");

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

  const changedSecond = player(secondId, `Second ${runId}`, "ember");
  changedSecond.hero.name = `Changed Hero ${runId}`;
  second.send({ type: "character", sessionId: secondId, player: changedSecond });
  const changedCharacter = await first.waitFor((state) => state.players.find((item) => item.id === secondId)?.hero.name === changedSecond.hero.name);
  assert.equal(changedCharacter.players.find((item) => item.id === secondId).hero.team, "ember", "changing character preserves the joined team");
  assert.equal(changedCharacter.players.find((item) => item.id === secondId).skillDeck.length, 10, "changing character replaces the joined player's deck");

  first.send({ type: "ready", sessionId: firstId, ready: true });
  second.send({ type: "ready", sessionId: secondId, ready: true });
  await first.waitFor((state) => state.players.find((item) => item.id === secondId)?.ready === true);
  const lockedSecond = player(secondId, `Second ${runId}`, "ember");
  lockedSecond.hero.name = `Locked Hero ${runId}`;
  second.send({ type: "character", sessionId: secondId, player: lockedSecond });
  third.send({ type: "ready", sessionId: thirdId, ready: true });
  const [readyState] = await Promise.all([
    first.waitFor((state) => state.players.filter((item) => [firstId, secondId, thirdId].includes(item.id)).length === 3 && state.players.filter((item) => [firstId, secondId, thirdId].includes(item.id)).every((item) => item.ready)),
    second.waitFor((state) => state.players.filter((item) => [firstId, secondId, thirdId].includes(item.id)).length === 3 && state.players.filter((item) => [firstId, secondId, thirdId].includes(item.id)).every((item) => item.ready))
  ]);
  assert.equal(readyState.players.find((item) => item.id === secondId).hero.name, changedSecond.hero.name, "Ready locks realtime character changes");

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
  const startingPlayers = readyState.players.map((item) => item.id === firstId ? { ...item, randomHero: false, hero: { ...item.hero, name: `Randomized ${runId}` } } : item);
  second.send({ type: "start", players: startingPlayers, game });
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
  assert.equal(secondStarted.game.playerStates[firstId].diceBuff, 2, "realtime observers receive the same public d20 buff value shown beneath the health bar");
  assert.equal(secondStarted.game.playerStates[firstId].dicePenalty, 2, "realtime observers receive the same public d20 penalty value shown beneath the health bar");
  assert.equal(firstStarted.players.find((item) => item.id === firstId).hero.name, `Randomized ${runId}`, "a realtime random character resolves at battle start");
  assert.equal(firstStarted.players.find((item) => item.id === firstId).randomHero, false, "the realtime random marker clears at battle start");
  assert.equal(firstStarted.viewerSessionId, firstId, "WebSocket snapshots identify the session whose private zones they contain");
  assert.equal(firstStarted.game.turnSeconds, 60, "the room overrides every client timer with a constant 60 seconds");
  assert(firstStarted.game.turnDeadline - firstStarted.game.turnStartedAt === 60_000, "every battle turn receives exactly 60 seconds");

  const expiryProbePromise = first.waitForNext((state) => state.phase === "game");
  first.send({ type: "expire-turn", sessionId: firstId });
  const expiryProbe = await expiryProbePromise;
  assert.equal(expiryProbe.viewerSessionId, firstId, "an expiry check remains personalized for its requesting browser");
  assert.deepEqual(expiryProbe.game.playerStates[firstId].hand, [`card-${firstId}`], "an early expiry check cannot replace the owner's hand with a privacy-filtered empty snapshot");

  const upgradeZoneIds = ["lost-momentum", "broken-plan", "empty-gesture"].map((suffix) => `${firstId}-common-${suffix}`);

  const controlledGame = structuredClone(firstStarted.game);
  controlledGame.completedTurns = 1;
  controlledGame.completedPhases = 0;
  controlledGame.activePlayerIndex = 1;
  controlledGame.turnOrder = [secondId, thirdId, firstId];
  controlledGame.roundNumber = 1;
  controlledGame.roundOrder = [firstId, secondId, thirdId];
  controlledGame.actedThisRound = [firstId];
  controlledGame.playerStates[firstId].hand = [`card-${firstId}`];
  controlledGame.playerStates[firstId].discardPile = [];
  controlledGame.playerStates[secondId].skipTurns = 1;
  controlledGame.playerStates[secondId].shield = 4;
  controlledGame.playerStates[secondId].attackBuff = 2;
  controlledGame.playerStates[secondId].diceBuff = 2;
  controlledGame.playerStates[secondId].dicePenalty = 1;
  controlledGame.playerStates[thirdId].shield = 3;
  controlledGame.outcome = { kind: "card", success: true, total: 20, target: 12, label: "Test control", detail: "The next enemy turn will be cancelled.", actorName: firstStarted.players.find((item) => item.id === firstId).displayName, cardId: `card-${firstId}`, cardName: "Test Skill", effect: "damage", targetName: firstStarted.players.find((item) => item.id === secondId).displayName };
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
  assert.equal(manuallySkipped.game.turnOrder[0], secondId, "a new realtime phase resets to the fastest living player");

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

  first.send({ type: "return:lobby" });
  const resetLobby = await first.waitForNext((state) => state.phase === "lobby");
  const resetDeck = resetLobby.players.find((item) => item.id === firstId).skillDeck;
  assert.equal(resetDeck.filter((card) => card.effect === "none").length, 3, "returning to the realtime lobby restores all three pre-upgrade cards");
  assert.deepEqual(upgradeZoneIds.map((id) => resetDeck.find((card) => card.id === id).name).sort(), ["Broken Plan", "Empty Gesture", "Lost Momentum"], "the restored realtime cards recover their original names and appearance");

  second.send({ type: "join", player: player(secondId, `Second ${runId}`, "ember") });
  await first.waitFor((state) => state.players.some((item) => item.id === secondId));
  first.send({ type: "ready", sessionId: firstId, ready: true });
  second.send({ type: "ready", sessionId: secondId, ready: true });
  await first.waitFor((state) => state.players.length === 2 && state.players.every((item) => item.ready));
  const initialPhaseFiveGame = structuredClone(game);
  delete initialPhaseFiveGame.playerStates[thirdId];
  initialPhaseFiveGame.completedTurns = 10;
  initialPhaseFiveGame.completedPhases = 5;
  initialPhaseFiveGame.roundNumber = 6;
  initialPhaseFiveGame.turnOrder = [firstId, secondId];
  initialPhaseFiveGame.roundOrder = [firstId, secondId];
  initialPhaseFiveGame.actedThisRound = [];
  initialPhaseFiveGame.outcome = null;
  initialPhaseFiveGame.history = [];
  initialPhaseFiveGame.worldEvent = null;
  second.send({ type: "start", game: initialPhaseFiveGame });
  const initialPhaseFiveState = await first.waitForNext((state) => state.phase === "game" && state.game?.completedPhases === 5);
  const initialPhaseFiveDeck = initialPhaseFiveState.players.find((item) => item.id === firstId).skillDeck;
  assert.deepEqual(upgradeZoneIds.map((id) => initialPhaseFiveDeck.find((card) => card.id === id).effect).sort(), ["damage", "guard", "heal"], "an initial realtime phase-5 snapshot is normalized before a player can act");
  first.send({ type: "discard-card", sessionId: firstId, cardId: `card-${firstId}` });
  const reshuffledAfterDiscard = await first.waitForNext((state) => state.game?.outcome?.kind === "discard");
  assert(reshuffledAfterDiscard.game.outcome.notices.some((notice) => notice.kind === "deck-reshuffle"), "realtime last-card discards emit a deck reshuffle notice");
  first.send({ type: "return:lobby" });
  const secondResetLobby = await first.waitForNext((state) => state.phase === "lobby");
  assert.equal(secondResetLobby.players.find((item) => item.id === firstId).skillDeck.filter((card) => card.effect === "none").length, 3, "a normalized realtime snapshot also restores cleanly for the next battle");

  first.send({ type: "ready", sessionId: firstId, ready: true });
  second.send({ type: "ready", sessionId: secondId, ready: true });
  await first.waitFor((state) => state.players.length === 2 && state.players.every((item) => item.ready));

  const firstTributeChoices = [`${firstId}-common-heavy`, `${firstId}-common-brace`];
  const secondTributeChoices = [`card-${secondId}`, `${secondId}-common-heavy`];
  const tributeGame = structuredClone(game);
  delete tributeGame.playerStates[thirdId];
  tributeGame.adventure.chapter = 2;
  tributeGame.completedTurns = 3;
  tributeGame.completedPhases = 1;
  tributeGame.roundNumber = 2;
  tributeGame.activePlayerIndex = 0;
  tributeGame.turnOrder = [firstId, secondId];
  tributeGame.roundOrder = [secondId, firstId];
  tributeGame.actedThisRound = [secondId];
  tributeGame.outcome = null;
  tributeGame.history = [];
  tributeGame.worldEvent = null;
  tributeGame.playerStates[firstId] = {
    ...tributeGame.playerStates[firstId],
    completedPlayerTurns: 1,
    zeroPityUntilTurn: 0,
    timedEffects: [],
    borrowedCards: [],
    purgedCards: [],
    pityPoints: 0,
    hand: [`card-${firstId}`, ...firstTributeChoices],
    drawPile: [`${firstId}-common-second-wind`, `${firstId}-common-empty-gesture`],
    discardPile: [],
    graveyard: [],
    cardUses: {}
  };
  tributeGame.playerStates[secondId] = {
    ...tributeGame.playerStates[secondId],
    completedPlayerTurns: 2,
    zeroPityUntilTurn: 0,
    timedEffects: [],
    borrowedCards: [],
    purgedCards: [],
    pityPoints: 0,
    hand: [...secondTributeChoices],
    drawPile: [`${secondId}-common-brace`, `${secondId}-common-second-wind`],
    discardPile: [],
    graveyard: [],
    cardUses: {}
  };

  const tributeStartedFirstPromise = first.waitForNext((state) => state.phase === "game" && state.game?.completedPhases === 1);
  const tributeStartedSecondPromise = second.waitForNext((state) => state.phase === "game" && state.game?.completedPhases === 1);
  second.send({ type: "start", game: tributeGame });
  const [tributeStartedFirst, tributeStartedSecond] = await Promise.all([tributeStartedFirstPromise, tributeStartedSecondPromise]);
  assert.deepEqual(tributeStartedFirst.game.playerStates[firstId].hand, [`card-${firstId}`, ...firstTributeChoices], "the phase-2 actor receives their complete private hand");
  assert.deepEqual(tributeStartedSecond.game.playerStates[secondId].hand, secondTributeChoices, "the other player receives only their own phase-2 hand");

  const tributeAdvance = structuredClone(tributeStartedFirst.game);
  tributeAdvance.adventure.chapter = 3;
  tributeAdvance.completedTurns = 4;
  tributeAdvance.completedPhases = 2;
  tributeAdvance.roundNumber = 3;
  tributeAdvance.activePlayerIndex = 1;
  tributeAdvance.turnOrder = [secondId, firstId];
  tributeAdvance.roundOrder = [secondId, firstId];
  tributeAdvance.actedThisRound = [];
  tributeAdvance.playerStates[firstId].completedPlayerTurns = 2;
  tributeAdvance.playerStates[firstId].hand = [...firstTributeChoices, `${firstId}-common-second-wind`];
  tributeAdvance.playerStates[firstId].drawPile = [`${firstId}-common-empty-gesture`];
  tributeAdvance.playerStates[firstId].discardPile = [`card-${firstId}`];
  tributeAdvance.outcome = {
    kind: "card",
    success: true,
    total: 20,
    target: tributeAdvance.adventure.target,
    label: `${tributeStartedFirst.players.find((item) => item.id === firstId).displayName} used Test Skill`,
    detail: "Phase 2 completed.",
    actorName: tributeStartedFirst.players.find((item) => item.id === firstId).displayName,
    cardId: `card-${firstId}`,
    cardName: "Test Skill",
    effect: "damage",
    targetIds: [secondId],
    targetName: tributeStartedFirst.players.find((item) => item.id === secondId).displayName,
    resolution: "roll"
  };
  tributeAdvance.history = [{
    id: `tribute-phase-two-${runId}`,
    turn: 4,
    phase: 2,
    kind: "damage",
    actorName: tributeAdvance.outcome.actorName,
    targetName: tributeAdvance.outcome.targetName,
    cardName: "Test Skill",
    message: "Phase 2 completed before Shattered Tribute.",
    success: true,
    createdAt: Date.now()
  }];

  const pendingFirstPromise = first.waitForNext((state) => state.game?.pendingWorldEvent?.eventKey === "shattered-tribute");
  const pendingSecondPromise = second.waitForNext((state) => state.game?.pendingWorldEvent?.eventKey === "shattered-tribute");
  first.send({ type: "game:update", game: tributeAdvance });
  const [pendingFirst, pendingSecond] = await Promise.all([pendingFirstPromise, pendingSecondPromise]);
  const pendingEventId = pendingFirst.game.pendingWorldEvent.id;
  assert.equal(pendingFirst.game.completedPhases, 2, "phase 2 completes before the phase-3 World Event begins");
  assert.equal(pendingFirst.game.pendingWorldEvent.phase, 3);
  assert.equal(pendingFirst.game.pendingWorldEvent.title, "Shattered Tribute");
  assert.deepEqual(new Set(pendingFirst.game.pendingWorldEvent.requiredPlayerIds), new Set([firstId, secondId]), "every living player is required to submit");
  assert.deepEqual(pendingFirst.game.pendingWorldEvent.submittedPlayerIds, []);
  assert.equal(pendingFirst.game.pendingWorldEvent.results, undefined, "pending private choice results are never synchronized");
  assert.equal(pendingSecond.game.pendingWorldEvent.id, pendingEventId, "both WebSocket clients observe the same stable pending event");
  assert.equal(pendingFirst.game.turnDeadline, 0, "normal turn timing pauses during Shattered Tribute");
  assert.equal(pendingFirst.game.pendingWorldEvent.deadlineAt - pendingFirst.game.pendingWorldEvent.startedAt, 60_000, "Shattered Tribute has a 60-second choice deadline");

  const blockedActionError = first.waitForError((message) => /pending World Event must be resolved/i.test(message));
  first.send({ type: "skip-turn", sessionId: firstId });
  assert.match(await blockedActionError, /pending World Event must be resolved/i, "normal actions are rejected while Shattered Tribute is pending");

  const crossSessionError = second.waitForError((message) => /only submit your own World Event choice/i.test(message));
  second.send({ type: "world-event:choose", sessionId: firstId, eventId: pendingEventId, cardIds: firstTributeChoices });
  assert.match(await crossSessionError, /only submit your own World Event choice/i, "another WebSocket session cannot submit for the required player");

  const firstProgressPromise = first.waitForNext((state) => state.game?.pendingWorldEvent?.submittedPlayerIds.includes(firstId));
  const secondProgressPromise = second.waitForNext((state) => state.game?.pendingWorldEvent?.submittedPlayerIds.includes(firstId));
  first.send({ type: "world-event:choose", sessionId: firstId, eventId: pendingEventId, cardIds: firstTributeChoices });
  const [firstProgress, secondProgress] = await Promise.all([firstProgressPromise, secondProgressPromise]);
  assert.deepEqual(firstProgress.game.pendingWorldEvent.submittedPlayerIds, [firstId], "the first valid choice synchronizes submission progress");
  assert.deepEqual(secondProgress.game.pendingWorldEvent.submittedPlayerIds, [firstId], "other clients see progress without seeing selected cards");
  assert.equal(firstProgress.game.pendingWorldEvent.results, undefined);
  assert(!JSON.stringify(secondProgress.game.pendingWorldEvent).includes(firstTributeChoices[0]), "pending state does not expose submitted card IDs");
  assert(firstProgress.game.playerStates[firstId].graveyard.includes(firstTributeChoices[0]), "the submitting owner sees their selected cards enter graveyard");
  assert.deepEqual(secondProgress.game.playerStates[firstId].graveyard, [], "other players cannot inspect the submitter's graveyard");

  const resolvedFirstPromise = first.waitForNext((state) => !state.game?.pendingWorldEvent && state.game?.worldEvent?.eventKey === "shattered-tribute");
  const resolvedSecondPromise = second.waitForNext((state) => !state.game?.pendingWorldEvent && state.game?.worldEvent?.eventKey === "shattered-tribute");
  second.send({ type: "world-event:choose", sessionId: secondId, eventId: pendingEventId, cardIds: secondTributeChoices });
  const [resolvedFirst, resolvedSecond] = await Promise.all([resolvedFirstPromise, resolvedSecondPromise]);
  const firstResolvedEvent = resolvedFirst.game.worldEvent;
  const secondResolvedEvent = resolvedSecond.game.worldEvent;
  assert.equal(firstResolvedEvent.phase, 3);
  assert.equal(resolvedFirst.game.adventure.chapter, 3, "phase 3 starts only after every required choice resolves");
  assert.equal(resolvedFirst.game.completedPhases, 2, "the World Event itself does not increment completed phases");
  assert.equal(resolvedFirst.game.turnDeadline - resolvedFirst.game.turnStartedAt, 60_000, "phase 3 receives a fresh 60-second turn after finalization");
  assert.equal(resolvedFirst.game.turnOrder[0], secondId, "normal Speed order resumes for phase 3");
  assert.equal(resolvedFirst.game.worldEventHistory.length, 1);

  const firstOwnResult = firstResolvedEvent.results.find((result) => result.playerId === firstId);
  const firstViewOfSecondResult = firstResolvedEvent.results.find((result) => result.playerId === secondId);
  const secondOwnResult = secondResolvedEvent.results.find((result) => result.playerId === secondId);
  const secondViewOfFirstResult = secondResolvedEvent.results.find((result) => result.playerId === firstId);
  assert.deepEqual(firstOwnResult.privateCardIds, firstTributeChoices, "the first owner receives their exact destroyed card IDs");
  assert.deepEqual(firstOwnResult.privateCardNames, ["Heavy Blow", "Brace"], "the first owner receives their exact destroyed card names");
  assert.equal(firstViewOfSecondResult.privateCardIds, undefined, "another player's private card IDs are sanitized");
  assert.equal(firstViewOfSecondResult.privateCardNames, undefined, "another player's private card names are sanitized");
  assert.deepEqual(secondOwnResult.privateCardIds, secondTributeChoices, "the second owner receives their exact destroyed card IDs");
  assert.deepEqual(secondOwnResult.privateCardNames, ["Test Skill", "Heavy Blow"], "the second owner receives their exact destroyed card names");
  assert.equal(secondViewOfFirstResult.privateCardIds, undefined);
  assert.equal(secondViewOfFirstResult.privateCardNames, undefined);
  const firstHistoryOwnResult = resolvedFirst.game.worldEventHistory.at(-1).results.find((result) => result.playerId === firstId);
  const firstHistoryOtherResult = resolvedFirst.game.worldEventHistory.at(-1).results.find((result) => result.playerId === secondId);
  assert.deepEqual(firstHistoryOwnResult.privateCardIds, firstTributeChoices, "World Event history preserves the owner's private result");
  assert.equal(firstHistoryOtherResult.privateCardIds, undefined, "World Event history sanitizes every other player's private result");

  const publicWorldHistory = resolvedFirst.game.history.find((entry) => entry.kind === "world" && entry.phase === 3);
  assert(publicWorldHistory, "Shattered Tribute creates one public World Event history entry");
  assert.equal(resolvedFirst.game.history.filter((entry) => entry.kind === "world" && entry.phase === 3).length, 1, "Shattered Tribute creates only one public history entry");
  assert.match(publicWorldHistory.message, /Shattered Tribute/);
  for (const privateValue of [...firstTributeChoices, ...secondTributeChoices, "Heavy Blow", "Brace", "Test Skill"]) {
    assert(!publicWorldHistory.message.includes(privateValue), `public World Event history does not reveal ${privateValue}`);
  }

  const tributeLobbyPromise = first.waitForNext((state) => state.phase === "lobby");
  first.send({ type: "return:lobby" });
  await tributeLobbyPromise;

  first.send({ type: "ready", sessionId: firstId, ready: true });
  second.send({ type: "ready", sessionId: secondId, ready: true });
  await first.waitFor((state) => state.players.length === 2 && state.players.every((item) => item.ready));
  const purgeAuthorityGame = structuredClone(game);
  delete purgeAuthorityGame.playerStates[thirdId];
  purgeAuthorityGame.completedTurns = 0;
  purgeAuthorityGame.completedPhases = 0;
  purgeAuthorityGame.roundNumber = 1;
  purgeAuthorityGame.turnOrder = [firstId, secondId];
  purgeAuthorityGame.roundOrder = [secondId, firstId];
  purgeAuthorityGame.actedThisRound = [secondId];
  purgeAuthorityGame.outcome = null;
  purgeAuthorityGame.history = [];
  purgeAuthorityGame.worldEvent = null;
  purgeAuthorityGame.playerStates[firstId].hand = [`purge-${firstId}`];
  purgeAuthorityGame.playerStates[firstId].drawPile = [`card-${firstId}`];
  purgeAuthorityGame.playerStates[firstId].discardPile = [];
  purgeAuthorityGame.playerStates[firstId].graveyard = [];
  purgeAuthorityGame.playerStates[secondId].hand = [`card-${secondId}`];
  purgeAuthorityGame.playerStates[secondId].drawPile = [`${secondId}-common-empty-gesture`];
  purgeAuthorityGame.playerStates[secondId].discardPile = [];
  purgeAuthorityGame.playerStates[secondId].graveyard = [];
  second.send({ type: "start", game: purgeAuthorityGame });
  const purgeStarted = await first.waitForNext((state) => state.phase === "game" && state.game?.completedTurns === 0);
  const purgeAction = structuredClone(purgeStarted.game);
  const firstName = purgeStarted.players.find((item) => item.id === firstId).displayName;
  const secondName = purgeStarted.players.find((item) => item.id === secondId).displayName;
  purgeAction.completedTurns = 1;
  purgeAction.completedPhases = 1;
  purgeAction.roundNumber = 2;
  purgeAction.activePlayerIndex = 1;
  purgeAction.turnOrder = [secondId, firstId];
  purgeAction.roundOrder = [secondId, firstId];
  purgeAction.actedThisRound = [];
  purgeAction.playerStates[firstId].hand = [`card-${firstId}`];
  purgeAction.playerStates[firstId].drawPile = [];
  purgeAction.playerStates[firstId].discardPile = [`purge-${firstId}`];
  purgeAction.outcome = { kind: "card", success: true, total: 20, target: purgeAction.adventure.target, label: `${firstName} used Tactical Purge`, detail: "Tactical Purge resolved.", actorName: firstName, cardId: `purge-${firstId}`, cardName: "Tactical Purge", effect: "support", supportType: "purge-card", targetIds: [secondId], targetName: secondName, resolution: "roll" };
  purgeAction.history = [{ id: `purge-${runId}`, turn: 1, phase: 1, kind: "support", actorName: firstName, message: `${firstName} used Tactical Purge.`, success: true, createdAt: Date.now() }];
  const purgeObserverPromise = first.waitForNext((state) => state.game?.outcome?.cardName === "Tactical Purge");
  const purgeOwnerPromise = second.waitForNext((state) => state.game?.outcome?.cardName === "Tactical Purge");
  first.send({ type: "game:update", game: purgeAction });
  const [purgeObserverView, purgeOwnerView] = await Promise.all([purgeObserverPromise, purgeOwnerPromise]);
  assert.deepEqual(purgeObserverView.game.playerStates[secondId].purgedCards, [], "temporary purge metadata stays private from opponents");
  assert(purgeOwnerView.game.playerStates[secondId].graveyard.includes(`card-${secondId}`), "the realtime authority moves a random private hand card to its owner's graveyard");
  assert.deepEqual(purgeOwnerView.game.playerStates[secondId].purgedCards, [{ cardId: `card-${secondId}`, returnAfterPhase: 2 }], "the realtime authority records the two-phase return boundary");
  assert(purgeOwnerView.game.outcome.notices.some((notice) => notice.title === "Card moved to graveyard" && /2 phases/.test(notice.detail)), "the temporary graveyard notice explains when the card returns");

  const phaseTwoSetupPromise = second.waitForNext((state) => state.game?.completedTurns === 2 && state.game?.outcome?.kind === "skip");
  second.send({ type: "skip-turn", sessionId: secondId });
  const phaseTwoSetup = await phaseTwoSetupPromise;
  assert.equal(phaseTwoSetup.game.completedPhases, 1);
  assert(phaseTwoSetup.game.playerStates[secondId].graveyard.includes(`card-${secondId}`), "the authoritative purge remains after one completed phase");

  const phaseTwoAdvance = structuredClone(phaseTwoSetup.game);
  phaseTwoAdvance.completedTurns = 3;
  phaseTwoAdvance.completedPhases = 2;
  phaseTwoAdvance.roundNumber = 3;
  phaseTwoAdvance.playerStates[firstId].hand = [];
  phaseTwoAdvance.playerStates[firstId].discardPile = [`purge-${firstId}`, `card-${firstId}`];
  phaseTwoAdvance.outcome = { kind: "card", success: true, total: 20, target: phaseTwoAdvance.adventure.target, label: `${firstName} used Test Skill`, detail: "Phase two completed.", actorName: firstName, cardId: `card-${firstId}`, cardName: "Test Skill", effect: "damage", targetIds: [secondId], targetName: secondName, resolution: "roll" };
  phaseTwoAdvance.history = [...phaseTwoAdvance.history, { id: `purge-phase-two-${runId}`, turn: 3, phase: 2, kind: "damage", actorName: firstName, message: "Phase two completed.", success: true, createdAt: Date.now() }];
  const purgeReturnedPromise = second.waitForNext((state) => state.game?.completedPhases === 2);
  first.send({ type: "game:update", game: phaseTwoAdvance });
  const purgeReturned = await purgeReturnedPromise;
  assert(!purgeReturned.game.playerStates[secondId].graveyard.includes(`card-${secondId}`), "the realtime authority removes the purged card from graveyard after two phases");
  assert(purgeReturned.game.playerStates[secondId].discardPile.includes(`card-${secondId}`), "the realtime authority returns the purged card to discard after two phases");
  assert.equal(purgeReturned.game.playerStates[secondId].purgedCards.length, 0);
  assert(purgeReturned.game.outcome.notices.some((notice) => notice.title === "Purged card returned"), "the authoritative return emits a synchronized notice");
  first.send({ type: "return:lobby" });
  await first.waitForNext((state) => state.phase === "lobby");

  first.send({ type: "ready", sessionId: firstId, ready: true });
  second.send({ type: "ready", sessionId: secondId, ready: true });
  await first.waitFor((state) => state.players.length === 2 && state.players.every((item) => item.ready));
  const pilferAuthorityGame = structuredClone(game);
  delete pilferAuthorityGame.playerStates[thirdId];
  pilferAuthorityGame.completedTurns = 0;
  pilferAuthorityGame.completedPhases = 0;
  pilferAuthorityGame.roundNumber = 1;
  pilferAuthorityGame.activePlayerIndex = 0;
  pilferAuthorityGame.turnOrder = [firstId, secondId];
  pilferAuthorityGame.roundOrder = [secondId, firstId];
  pilferAuthorityGame.actedThisRound = [secondId];
  pilferAuthorityGame.outcome = null;
  pilferAuthorityGame.history = [];
  pilferAuthorityGame.worldEvent = null;
  pilferAuthorityGame.playerStates[firstId].completedPlayerTurns = 0;
  pilferAuthorityGame.playerStates[firstId].timedEffects = [];
  pilferAuthorityGame.playerStates[firstId].borrowedCards = [];
  pilferAuthorityGame.playerStates[firstId].purgedCards = [];
  pilferAuthorityGame.playerStates[firstId].hand = [`pilfer-${firstId}`];
  pilferAuthorityGame.playerStates[firstId].drawPile = [`${firstId}-common-second-wind`];
  pilferAuthorityGame.playerStates[firstId].discardPile = [];
  pilferAuthorityGame.playerStates[firstId].graveyard = [];
  pilferAuthorityGame.playerStates[secondId].completedPlayerTurns = 1;
  pilferAuthorityGame.playerStates[secondId].timedEffects = [];
  pilferAuthorityGame.playerStates[secondId].borrowedCards = [];
  pilferAuthorityGame.playerStates[secondId].purgedCards = [];
  pilferAuthorityGame.playerStates[secondId].hand = [`card-${secondId}`, `${secondId}-common-empty-gesture`];
  pilferAuthorityGame.playerStates[secondId].drawPile = [];
  pilferAuthorityGame.playerStates[secondId].discardPile = [];
  pilferAuthorityGame.playerStates[secondId].graveyard = [];
  second.send({ type: "start", game: pilferAuthorityGame });
  const pilferStarted = await first.waitForNext((state) => state.phase === "game" && state.game?.completedTurns === 0);
  const pilferAction = structuredClone(pilferStarted.game);
  pilferAction.completedTurns = 1;
  pilferAction.completedPhases = 1;
  pilferAction.roundNumber = 2;
  pilferAction.activePlayerIndex = 1;
  pilferAction.turnOrder = [secondId, firstId];
  pilferAction.roundOrder = [secondId, firstId];
  pilferAction.actedThisRound = [];
  pilferAction.playerStates[firstId].completedPlayerTurns = 1;
  pilferAction.playerStates[firstId].hand = [`${firstId}-common-second-wind`];
  pilferAction.playerStates[firstId].drawPile = [];
  pilferAction.playerStates[firstId].discardPile = [`pilfer-${firstId}`];
  pilferAction.outcome = { kind: "card", success: true, total: 20, target: pilferAction.adventure.target, label: `${firstName} used Pilfered Chance`, detail: "Pilfered Chance resolved.", actorName: firstName, cardId: `pilfer-${firstId}`, cardName: "Pilfered Chance", effect: "support", supportType: "steal-card", targetIds: [secondId], targetName: secondName, resolution: "roll" };
  pilferAction.history = [{ id: `pilfer-${runId}`, turn: 1, phase: 1, kind: "support", actorName: firstName, message: `${firstName} used Pilfered Chance.`, success: true, createdAt: Date.now() }];
  const pilferActorPromise = first.waitForNext((state) => state.game?.outcome?.cardName === "Pilfered Chance");
  const pilferTargetPromise = second.waitForNext((state) => state.game?.outcome?.cardName === "Pilfered Chance");
  first.send({ type: "game:update", game: pilferAction });
  const [pilferActorView, pilferTargetView] = await Promise.all([pilferActorPromise, pilferTargetPromise]);
  assert(pilferActorView.game.playerStates[firstId].hand.includes(`card-${secondId}`), "Pilfered Chance prefers a special card from the target's private hand");
  assert.deepEqual(pilferActorView.game.playerStates[firstId].borrowedCards, [{ cardId: `card-${secondId}`, ownerId: secondId, borrowedAtTurn: 1, expiresAfterBorrowerTurn: 2 }], "the realtime authority binds the stolen card to the end of Nyx's next turn");
  assert(!pilferTargetView.game.playerStates[secondId].hand.includes(`card-${secondId}`), "the stolen special card leaves the target's hand");
  assert(pilferTargetView.game.playerStates[secondId].hand.includes(`${secondId}-common-empty-gesture`), "a special card is preferred over an available common card");
  assert.match(pilferActorView.game.outcome.detail, /random special card/);
  assert.match(pilferActorView.game.outcome.detail, /next turn ends/);

  const afterTargetTurnPromise = first.waitForNext((state) => state.game?.completedTurns === 2 && state.game?.outcome?.kind === "skip");
  second.send({ type: "skip-turn", sessionId: secondId });
  const afterTargetTurn = await afterTargetTurnPromise;
  assert(afterTargetTurn.game.playerStates[firstId].hand.includes(`card-${secondId}`), "the stolen card does not return when the target's turn ends");
  assert.equal(afterTargetTurn.game.playerStates[firstId].borrowedCards.length, 1);

  const pilferReturnedActorPromise = first.waitForNext((state) => state.game?.completedTurns === 3 && state.game?.outcome?.kind === "skip");
  const pilferReturnedTargetPromise = second.waitForNext((state) => state.game?.completedTurns === 3 && state.game?.outcome?.kind === "skip");
  first.send({ type: "skip-turn", sessionId: firstId });
  const [pilferReturnedActor, pilferReturnedTarget] = await Promise.all([pilferReturnedActorPromise, pilferReturnedTargetPromise]);
  assert(!pilferReturnedActor.game.playerStates[firstId].hand.includes(`card-${secondId}`), "the unplayed stolen card leaves Nyx's hand when Nyx's next turn ends");
  assert.equal(pilferReturnedActor.game.playerStates[firstId].borrowedCards.length, 0, "the expired borrowed-card marker is cleared");
  assert(pilferReturnedTarget.game.playerStates[secondId].discardPile.includes(`card-${secondId}`), "the stolen card returns to its original target's discard pile");
  assert(!pilferReturnedTarget.game.playerStates[secondId].hand.includes(`card-${secondId}`), "the returned card does not jump back into the target's hand");
  first.send({ type: "return:lobby" });
  await first.waitForNext((state) => state.phase === "lobby");

  first.send({ type: "ready", sessionId: firstId, ready: true });
  second.send({ type: "ready", sessionId: secondId, ready: true });
  await first.waitFor((state) => state.players.length === 2 && state.players.every((item) => item.ready));
  const favorableAuthorityGame = structuredClone(game);
  delete favorableAuthorityGame.playerStates[thirdId];
  favorableAuthorityGame.completedTurns = 0;
  favorableAuthorityGame.completedPhases = 0;
  favorableAuthorityGame.roundNumber = 1;
  favorableAuthorityGame.activePlayerIndex = 0;
  favorableAuthorityGame.turnOrder = [firstId, secondId];
  favorableAuthorityGame.roundOrder = [secondId, firstId];
  favorableAuthorityGame.actedThisRound = [secondId];
  favorableAuthorityGame.outcome = null;
  favorableAuthorityGame.history = [];
  favorableAuthorityGame.worldEvent = null;
  favorableAuthorityGame.playerStates[firstId].completedPlayerTurns = 0;
  favorableAuthorityGame.playerStates[firstId].zeroPityUntilTurn = 0;
  favorableAuthorityGame.playerStates[firstId].timedEffects = [];
  favorableAuthorityGame.playerStates[firstId].borrowedCards = [];
  favorableAuthorityGame.playerStates[firstId].purgedCards = [];
  favorableAuthorityGame.playerStates[firstId].pityPoints = 3;
  favorableAuthorityGame.playerStates[firstId].hand = [`favor-${firstId}`];
  favorableAuthorityGame.playerStates[firstId].drawPile = [`card-${firstId}`];
  favorableAuthorityGame.playerStates[firstId].discardPile = [];
  favorableAuthorityGame.playerStates[firstId].graveyard = [];
  favorableAuthorityGame.playerStates[secondId].completedPlayerTurns = 1;
  favorableAuthorityGame.playerStates[secondId].zeroPityUntilTurn = 0;
  favorableAuthorityGame.playerStates[secondId].timedEffects = [];
  favorableAuthorityGame.playerStates[secondId].borrowedCards = [];
  favorableAuthorityGame.playerStates[secondId].purgedCards = [];
  favorableAuthorityGame.playerStates[secondId].hand = [`card-${secondId}`];
  favorableAuthorityGame.playerStates[secondId].drawPile = [];
  favorableAuthorityGame.playerStates[secondId].discardPile = [];
  favorableAuthorityGame.playerStates[secondId].graveyard = [];
  second.send({ type: "start", game: favorableAuthorityGame });
  const favorableStarted = await first.waitForNext((state) => state.phase === "game" && state.game?.completedTurns === 0);
  const favorableAction = structuredClone(favorableStarted.game);
  favorableAction.completedTurns = 1;
  favorableAction.completedPhases = 1;
  favorableAction.roundNumber = 2;
  favorableAction.activePlayerIndex = 1;
  favorableAction.turnOrder = [secondId, firstId];
  favorableAction.roundOrder = [secondId, firstId];
  favorableAction.actedThisRound = [];
  favorableAction.playerStates[firstId].completedPlayerTurns = 1;
  favorableAction.playerStates[firstId].zeroPityUntilTurn = 0;
  favorableAction.playerStates[firstId].hand = [`card-${firstId}`];
  favorableAction.playerStates[firstId].drawPile = [];
  favorableAction.playerStates[firstId].discardPile = [`favor-${firstId}`];
  favorableAction.playerStates[firstId].cardUses = { [`favor-${firstId}`]: 1 };
  favorableAction.outcome = { kind: "card", success: true, total: 20, target: favorableAction.adventure.target, label: `${firstName} used Favorable Omen`, detail: "Favorable Omen resolved.", actorName: firstName, cardId: `favor-${firstId}`, cardName: "Favorable Omen", effect: "support", supportType: "zero-pity", targetIds: [firstId], targetName: firstName, resolution: "roll" };
  favorableAction.history = [{ id: `favor-${runId}`, turn: 1, phase: 1, kind: "support", actorName: firstName, message: `${firstName} used Favorable Omen.`, success: true, createdAt: Date.now() }];
  const favorableActorPromise = first.waitForNext((state) => state.game?.outcome?.cardName === "Favorable Omen");
  const favorableObserverPromise = second.waitForNext((state) => state.game?.outcome?.cardName === "Favorable Omen");
  first.send({ type: "game:update", game: favorableAction });
  const [favorableActorView, favorableObserverView] = await Promise.all([favorableActorPromise, favorableObserverPromise]);
  assert.equal(favorableActorView.game.playerStates[firstId].zeroPityUntilTurn, 2, "self-targeted Favorable Omen remains active through its casting turn");
  assert.equal(favorableObserverView.game.playerStates[firstId].zeroPityUntilTurn, 2, "the realtime authority synchronizes Favorable Omen as a public player effect");
  assert.match(favorableActorView.game.outcome.detail, /next played card.*0 pity cost/);

  const beforeFavorableTurnPromise = first.waitForNext((state) => state.game?.completedTurns === 2 && state.game?.outcome?.kind === "skip");
  second.send({ type: "skip-turn", sessionId: secondId });
  const beforeFavorableTurn = await beforeFavorableTurnPromise;
  assert.equal(beforeFavorableTurn.game.playerStates[firstId].zeroPityUntilTurn, 2, "another player's turn does not consume Favorable Omen");

  const zeroPityAction = structuredClone(beforeFavorableTurn.game);
  zeroPityAction.completedTurns = 3;
  zeroPityAction.completedPhases = 2;
  zeroPityAction.roundNumber = 3;
  zeroPityAction.activePlayerIndex = 1;
  zeroPityAction.turnOrder = [secondId, firstId];
  zeroPityAction.roundOrder = [secondId, firstId];
  zeroPityAction.actedThisRound = [];
  zeroPityAction.playerStates[firstId].completedPlayerTurns = 2;
  zeroPityAction.playerStates[firstId].zeroPityUntilTurn = 0;
  zeroPityAction.playerStates[firstId].hand = [];
  zeroPityAction.playerStates[firstId].drawPile = [];
  zeroPityAction.playerStates[firstId].discardPile = [`favor-${firstId}`, `card-${firstId}`];
  zeroPityAction.outcome = { kind: "card", success: true, total: 1, target: zeroPityAction.adventure.target, label: `${firstName} used Test Skill`, detail: "The zero-pity card resolved.", actorName: firstName, cardId: `card-${firstId}`, cardName: "Test Skill", effect: "damage", targetIds: [secondId], targetName: secondName, roll: 1, bonus: 0, resolution: "roll", pityCost: 0, pityBefore: 3, pityAfter: 3 };
  zeroPityAction.history = [...zeroPityAction.history, { id: `favor-card-${runId}`, turn: 3, phase: 2, kind: "damage", actorName: firstName, targetName: secondName, cardName: "Test Skill", message: `${firstName} used Test Skill with Favorable Omen.`, success: true, diceRoll: 1, diceTarget: zeroPityAction.adventure.target, diceBonus: 0, dicePenalty: 0, diceTotal: 1, resolution: "roll", pityCost: 0, pityBefore: 3, pityAfter: 3, createdAt: Date.now() }];
  const zeroPityActorPromise = first.waitForNext((state) => state.game?.completedTurns === 3 && state.game?.outcome?.cardName === "Test Skill");
  const zeroPityObserverPromise = second.waitForNext((state) => state.game?.completedTurns === 3 && state.game?.outcome?.cardName === "Test Skill");
  first.send({ type: "game:update", game: zeroPityAction });
  const [zeroPityActorView, zeroPityObserverView] = await Promise.all([zeroPityActorPromise, zeroPityObserverPromise]);
  assert.equal(zeroPityActorView.game.outcome.success, true, "Favorable Omen makes the next normal card action automatically succeed");
  assert.equal(zeroPityActorView.game.outcome.pityCost, 0, "the realtime authority reports the affected card's pity cost as 0");
  assert.equal(zeroPityActorView.game.playerStates[firstId].pityPoints, 3, "the affected card spends and gains no pity");
  assert.equal(zeroPityActorView.game.playerStates[firstId].zeroPityUntilTurn, 0, "the omen clears after the affected card is played");
  assert.equal(zeroPityObserverView.game.playerStates[firstId].zeroPityUntilTurn, 0, "the consumed omen clears for every player");
  first.send({ type: "return:lobby" });
  await first.waitForNext((state) => state.phase === "lobby");

  console.log("Realtime test passed: private hands, Shattered Tribute choices and privacy, temporary Tactical Purge, temporary Pilfered Chance theft, Favorable Omen zero-pity turns, phase-5 card upgrades and resets, initial phase-5 normalization, 60-second timer, forced/manual skips, preserved cards, player removal, end game, and leave game.");
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
