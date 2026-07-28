import assert from "node:assert/strict";

const roomUrl = process.env.ROOM_HTTP_URL || "http://127.0.0.1:3105/api/room";
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const firstId = `poll-first-${runId}`;
const secondId = `poll-second-${runId}`;
const thirdId = `poll-third-${runId}`;

function testSkillDeck(id) {
  const special = Array.from({ length: 3 }, (_, index) => ({ id: index === 0 ? `card-${id}` : `card-${id}-${index}`, name: index === 0 ? "Test Skill" : `Test Skill ${index + 1}`, type: "Wit", description: "Test", bonus: 0, effect: "damage", target: "enemy", value: 2, unique: true }));
  const common = [
    { id: "slash", name: "Slash", type: "Might", description: "Deal 3 damage.", effect: "damage", target: "enemy", value: 3 },
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
    hero: { id: `hero-${id}`, name: `${displayName} Hero`, title: "Test Oath", role: "Scout", classId: "ranger", className: "Ranger", passiveName: "Deadeye", passiveText: "Single-target attacks deal 1 additional damage.", skill: "Test Skill", skillText: "Test", summary: "Test hero", strength: "Attack", weakness: "Defense", impact: "Polling test", hp: 8, maxHp: 8, team, color: "#a78bfa", initials: displayName.slice(0, 2).toUpperCase() },
    skillDeck: testSkillDeck(id)
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
  const pendingRandomPlayer = { ...player(firstId, `First ${runId}`, "veil"), randomHero: true };
  const randomJoined = await command(firstId, { type: "join", player: pendingRandomPlayer });
  assert.equal(randomJoined.players.find((item) => item.id === firstId).randomHero, true, "a pending random character can join a team slot before assignment");
  const joined = await command(secondId, { type: "join", player: player(secondId, `Second ${runId}`, "veil") });
  assert(joined.players.some((item) => item.id === firstId));
  assert(joined.players.some((item) => item.id === secondId));
  const fillIds = Array.from({ length: 3 }, (_, index) => `slot-fill-${index}-${runId}`);
  for (const [index, id] of fillIds.entries()) await command(id, { type: "join", player: player(id, `Slot fill ${index} ${runId}`, "veil") });
  const overflowId = `slot-overflow-${runId}`;
  await assert.rejects(command(overflowId, { type: "join", player: player(overflowId, `Slot overflow ${runId}`, "veil") }), /already has five players/, "a team cannot exceed its five visible lobby slots");
  for (const id of fillIds) await command(id, { type: "leave" });

  const removedFromLobby = await command(firstId, { type: "remove-player", targetSessionId: secondId });
  assert(!removedFromLobby.players.some((item) => item.id === secondId));
  await command(secondId, { type: "join", player: player(secondId, `Second ${runId}`, "veil") });
  await command(thirdId, { type: "join", player: player(thirdId, `Third ${runId}`, "veil") });

  const changedSecond = player(secondId, `Second ${runId}`, "veil");
  changedSecond.hero.name = `Changed Hero ${runId}`;
  const changedCharacter = await command(secondId, { type: "character", player: changedSecond });
  assert.equal(changedCharacter.players.find((item) => item.id === secondId).hero.name, changedSecond.hero.name, "a joined player can change character before readying");
  assert.equal(changedCharacter.players.find((item) => item.id === secondId).hero.team, "veil", "changing character preserves the joined team");

  await command(firstId, { type: "ready", ready: true });
  await command(secondId, { type: "ready", ready: true });
  const ready = await command(thirdId, { type: "ready", ready: true });
  assert.equal(ready.players.filter((item) => [firstId, secondId, thirdId].includes(item.id)).length, 3);
  assert(ready.players.filter((item) => [firstId, secondId, thirdId].includes(item.id)).every((item) => item.ready));
  assert.equal(ready.players.find((item) => item.id === secondId).hero.team, "veil", "ready snapshots expose the selected team to every player");
  const lockedSecond = player(secondId, `Second ${runId}`, "veil");
  lockedSecond.hero.name = `Locked Hero ${runId}`;
  await assert.rejects(command(secondId, { type: "character", player: lockedSecond }), /Cancel Ready before changing characters/, "Ready locks polling character changes");

  const game = {
    adventure: { seed: "POLL", realm: {}, chapter: 1, maxChapters: 30, story: "Test", event: "Test", target: 12, worldDoom: 0, veilInfluence: 0, emberInfluence: 0 },
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
    turnDeadline: Date.now() + 300,
    turnSeconds: 1,
    maxTurns: 30,
    maxPhases: 30,
    ended: false,
    endReason: null,
    winnerTeam: null,
    history: [],
    worldEvent: null
  };
  await assert.rejects(command(secondId, { type: "start", game }), /At least one player must join each team/, "the server rejects a battle with an empty team");
  await assert.rejects(command(secondId, { type: "team", team: "ember" }), /Cancel Ready before switching teams/, "Ready locks team-slot switching");
  await command(secondId, { type: "ready", ready: false });
  const splitTeams = await command(secondId, { type: "team", team: "ember" });
  assert.equal(splitTeams.players.find((item) => item.id === secondId).hero.team, "ember");
  await command(secondId, { type: "ready", ready: true });
  const startingPlayers = (await readRoom()).players.map((item) => item.id === firstId ? { ...item, randomHero: false, hero: { ...item.hero, name: `Randomized ${runId}` } } : item);
  const started = await command(secondId, { type: "start", players: startingPlayers, game });
  assert.equal(started.phase, "game");
  assert.equal(started.players.find((item) => item.id === firstId).hero.name, `Randomized ${runId}`, "a pending random character resolves only when battle starts");
  assert.equal(started.players.find((item) => item.id === firstId).randomHero, false, "the pending random marker clears at battle start");
  assert.deepEqual(started.game.playerStates[secondId].hand, [`card-${secondId}`], "a polling client receives its own hand");
  assert.deepEqual(started.game.playerStates[firstId].hand, [], "a polling client cannot receive another player's hand");
  assert.deepEqual(started.game.playerStates[firstId].graveyard, [], "a polling client cannot receive another player's graveyard");
  const firstStarted = await readRoom(firstId);
  assert.deepEqual(firstStarted.game.playerStates[firstId].hand, [`card-${firstId}`], "polling responses are personalized by session");
  assert.deepEqual(firstStarted.game.playerStates[firstId].graveyard, ["buried-first"], "polling responses include the owner's graveyard");
  assert.deepEqual(firstStarted.game.playerStates[secondId].hand, [], "other card zones remain private during polling");
  assert.equal(firstStarted.viewerSessionId, firstId, "polling snapshots identify the session whose private zones they contain");
  assert.equal(firstStarted.game.turnSeconds, 60, "the polling room enforces a constant 60-second timer");
  assert.equal(firstStarted.game.turnDeadline - firstStarted.game.turnStartedAt, 60_000, "every polling turn receives exactly 60 seconds");

  const upgradeProbe = structuredClone(firstStarted.game);
  const upgradeZoneIds = ["lost-momentum", "broken-plan", "empty-gesture"].map((suffix) => `${firstId}-common-${suffix}`);
  upgradeProbe.completedTurns = 1;
  upgradeProbe.completedPhases = 5;
  upgradeProbe.roundNumber = 6;
  upgradeProbe.outcome = { kind: "card", success: true, total: 20, target: upgradeProbe.adventure.target, label: "Phase-5 upgrade probe", detail: "Test Skill resolved.", actorName: firstStarted.players.find((item) => item.id === firstId).displayName, cardId: `card-${firstId}`, cardName: "Test Skill", effect: "damage", resolution: "roll" };
  upgradeProbe.playerStates[firstId].hand = [upgradeZoneIds[0]];
  upgradeProbe.playerStates[firstId].drawPile = [upgradeZoneIds[1]];
  upgradeProbe.playerStates[firstId].discardPile = [];
  upgradeProbe.playerStates[firstId].graveyard = [upgradeZoneIds[2]];
  const upgradedState = await command(firstId, { type: "game:update", game: upgradeProbe });
  const upgradedDeck = upgradedState.players.find((item) => item.id === firstId).skillDeck;
  assert.deepEqual([upgradedState.game.playerStates[firstId].hand, upgradedState.game.playerStates[firstId].drawPile, upgradedState.game.playerStates[firstId].graveyard], [[upgradeZoneIds[0]], [upgradeZoneIds[1]], [upgradeZoneIds[2]]], "polling phase-5 upgrades preserve card IDs across private zones");
  assert.deepEqual(upgradeZoneIds.map((id) => upgradedDeck.find((card) => card.id === id).effect).sort(), ["damage", "guard", "heal"], "polling authority upgrades all three cards independently");
  const controlledGame = structuredClone(firstStarted.game);
  controlledGame.completedTurns = 1;
  controlledGame.completedPhases = 0;
  controlledGame.activePlayerIndex = 1;
  controlledGame.turnOrder = [secondId, thirdId, firstId];
  controlledGame.roundNumber = 1;
  controlledGame.roundOrder = [firstId, secondId, thirdId];
  controlledGame.actedThisRound = [firstId];
  controlledGame.playerStates[firstId].hand = [];
  controlledGame.playerStates[firstId].discardPile = [upgradeZoneIds[0]];
  controlledGame.playerStates[secondId].skipTurns = 1;
  controlledGame.playerStates[secondId].shield = 4;
  controlledGame.playerStates[secondId].attackBuff = 2;
  controlledGame.playerStates[secondId].diceBuff = 2;
  controlledGame.playerStates[secondId].dicePenalty = 1;
  controlledGame.playerStates[thirdId].shield = 3;
  controlledGame.outcome = { kind: "card", success: true, total: 20, target: 12, label: "Test control", detail: "The next enemy turn will be cancelled.", actorName: firstStarted.players.find((item) => item.id === firstId).displayName, cardId: upgradeZoneIds[0], cardName: "Heavy Blow", effect: "damage", targetName: firstStarted.players.find((item) => item.id === secondId).displayName };
  controlledGame.history = [{ id: `control-${runId}`, turn: 1, kind: "support", actorName: "First", message: "Applied a turn-cancel effect.", success: true, createdAt: Date.now() }];
  const forcedSkipped = await command(firstId, { type: "game:update", game: controlledGame });
  const forcedOwnerView = await readRoom(secondId);
  assert(Number.isFinite(forcedSkipped.serverNow), "room responses include authoritative server time");
  assert.equal(forcedSkipped.game.completedTurns, 2);
  assert.equal(forcedSkipped.game.outcome.kind, "forced-skip");
  assert.equal(forcedSkipped.game.history.at(-1).kind, "forced-skip");
  assert.equal(forcedSkipped.game.completedPhases, 0, "a phase remains open until every player has acted");
  assert.equal(forcedSkipped.game.turnOrder[0], thirdId);
  assert.deepEqual(forcedOwnerView.game.playerStates[secondId].hand, [`card-${secondId}`], "forced skip preserves the affected player's hand");
  assert.equal(forcedOwnerView.game.playerStates[secondId].skipTurns, 0);
  assert.deepEqual(
    ["shield", "attackBuff", "diceBuff", "dicePenalty"].map((field) => forcedOwnerView.game.playerStates[secondId][field]),
    [0, 0, 0, 0],
    "a cancelled polling turn still expires every timed buff and debuff"
  );

  const manuallySkipped = await command(thirdId, { type: "skip-turn" });
  assert.equal(manuallySkipped.game.completedTurns, 3);
  assert.equal(manuallySkipped.game.outcome.kind, "skip");
  assert.equal(manuallySkipped.game.history.at(-1).kind, "skip");
  assert.equal(manuallySkipped.game.completedPhases, 1, "the phase completes after all three players act");
  assert.deepEqual(manuallySkipped.game.playerStates[thirdId].hand, [`card-${thirdId}`], "manual skip preserves the hand");
  assert.deepEqual(manuallySkipped.game.playerStates[thirdId].drawPile, [], "manual skip preserves the draw pile");
  assert.deepEqual(manuallySkipped.game.playerStates[thirdId].discardPile, [], "manual skip preserves the discard pile");
  assert.equal(manuallySkipped.game.playerStates[thirdId].shield, 0, "a manual polling skip still expires shield at turn end");
  assert.equal(manuallySkipped.game.turnOrder[0], firstId);

  const removedDuringGame = await command(firstId, { type: "remove-player", targetSessionId: thirdId });
  assert(!removedDuringGame.players.some((item) => item.id === thirdId));
  assert.equal(removedDuringGame.game.ended, false);
  assert.equal(removedDuringGame.game.playerStates[thirdId], undefined);
  assert(!removedDuringGame.game.turnOrder.includes(thirdId));

  const ended = await command(secondId, { type: "end-game" });
  assert.equal(ended.game.ended, true);
  assert.equal(ended.game.winnerTeam, "ember", "manual polling end uses the phase-30 judgment and the ending player's team resolves a complete tie");
  assert.match(ended.game.endReason, /Embercourt wins\. Total HP: Veilbound 8 — Embercourt 8\./);
  const left = await command(secondId, { type: "leave-game" });
  assert(!left.players.some((item) => item.id === secondId));
  const resetLobby = await command(firstId, { type: "return:lobby" });
  const resetDeck = resetLobby.players.find((item) => item.id === firstId).skillDeck;
  assert.equal(resetDeck.filter((card) => card.effect === "none").length, 3, "returning to the polling lobby restores all three pre-upgrade cards");
  assert.deepEqual(upgradeZoneIds.map((id) => resetDeck.find((card) => card.id === id).name).sort(), ["Broken Plan", "Empty Gesture", "Lost Momentum"], "the restored polling cards recover their original names and appearance");

  await command(secondId, { type: "join", player: player(secondId, `Second ${runId}`, "ember") });
  await command(firstId, { type: "ready", ready: true });
  await command(secondId, { type: "ready", ready: true });
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
  const initialPhaseFiveState = await command(secondId, { type: "start", game: initialPhaseFiveGame });
  const initialPhaseFiveDeck = initialPhaseFiveState.players.find((item) => item.id === firstId).skillDeck;
  assert.deepEqual(upgradeZoneIds.map((id) => initialPhaseFiveDeck.find((card) => card.id === id).effect).sort(), ["damage", "guard", "heal"], "an initial polling phase-5 snapshot is normalized before a player can act");
  const hydratedPhaseFiveState = await readRoom(firstId);
  assert.deepEqual(upgradeZoneIds.map((id) => hydratedPhaseFiveState.players.find((item) => item.id === firstId).skillDeck.find((card) => card.id === id).effect).sort(), ["damage", "guard", "heal"], "a hydrated polling phase-5 snapshot remains normalized");
  const secondResetLobby = await command(firstId, { type: "return:lobby" });
  assert.equal(secondResetLobby.players.find((item) => item.id === firstId).skillDeck.filter((card) => card.effect === "none").length, 3, "a normalized polling snapshot also restores cleanly for the next battle");
  console.log("Polling test passed: private hands, phase-5 card upgrades and resets, initial phase-5 normalization, 60-second timer, forced/manual skips, preserved cards, player removal, end game, and leave game.");
} finally {
  await command(firstId, { type: "return:lobby" }).catch(() => {});
  await command(firstId, { type: "leave" }).catch(() => {});
  await command(secondId, { type: "leave" }).catch(() => {});
  await command(thirdId, { type: "leave" }).catch(() => {});
}
