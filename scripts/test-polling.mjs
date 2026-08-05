import assert from "node:assert/strict";

const roomUrl = process.env.ROOM_HTTP_URL || "http://127.0.0.1:3105/api/room";
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const firstId = `poll-first-${runId}`;
const secondId = `poll-second-${runId}`;
const thirdId = `poll-third-${runId}`;

function testSkillDeck(id) {
  const special = Array.from({ length: 3 }, (_, index) => ({ id: index === 0 ? `card-${id}` : `card-${id}-${index}`, name: index === 0 ? "Test Skill" : `Test Skill ${index + 1}`, description: "Test", bonus: 0, effect: "damage", target: "enemy", value: 2, failureEffect: "self-damage", failureValue: 2, unique: true }));
  const common = [
    { id: "slash", name: "Slash", description: "Deal 2 damage.", effect: "damage", target: "enemy", value: 2, pityCost: 2 },
    { id: "heavy", name: "Heavy Blow", description: "Deal 3 damage.", effect: "damage", target: "enemy", value: 3, pityCost: 3 },
    { id: "brace", name: "Brace", description: "Gain 2 shield.", effect: "guard", target: "self", value: 2, pityCost: 2 },
    { id: "second-wind", name: "Second Wind", description: "Restore up to 3 HP.", effect: "heal", target: "self", value: 3, pityCost: 3 },
    { id: "empty-gesture", name: "Empty Gesture", description: "Upgrades to healing.", effect: "none", target: "self", value: 0 },
    { id: "broken-plan", name: "Broken Plan", description: "Upgrades to shielding.", effect: "none", target: "self", value: 0 },
    { id: "lost-momentum", name: "Lost Momentum", description: "Upgrades to heavy damage.", effect: "none", target: "self", value: 0 }
  ].map((card) => ({ ...card, id: `${id}-common-${card.id}`, bonus: 0, unique: false }));
  return [...special, ...common];
}

function player(id, displayName, team) {
  return {
    id,
    displayName,
    ready: false,
    joinedAt: Date.now(),
    hero: { id: `hero-${id}`, name: `${displayName} Hero`, title: "Test Oath", role: "Scout", classId: "ranger", className: "Ranger", passiveName: "Second-Beat Deadeye", passiveText: "Single-target attacks deal 1 additional damage.", skill: "Test Skill", skillText: "Test", summary: "Test hero", impact: "Polling test", hp: 8, maxHp: 8, speed: id.includes("second") ? 10 : 5, team, color: "#a78bfa", initials: displayName.slice(0, 2).toUpperCase() },
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
  changedSecond.hero.name = "Thorne Vale";
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
      [firstId]: { sessionId: firstId, hp: 8, maxHp: 8, shield: 0, attackBuff: 0, diceBuff: 2, dicePenalty: 2, goldUnits: 10, hand: [`card-${firstId}`], drawPile: [], discardPile: [], graveyard: ["buried-first"], cardUses: {} },
      [secondId]: { sessionId: secondId, hp: 8, maxHp: 8, shield: 0, attackBuff: 0, diceBuff: 0, dicePenalty: 0, hand: [`card-${secondId}`], drawPile: [], discardPile: [], graveyard: [], cardUses: {} },
      [thirdId]: { sessionId: thirdId, hp: 8, maxHp: 8, shield: 0, attackBuff: 0, diceBuff: 0, dicePenalty: 0, hand: [`card-${thirdId}`], drawPile: [], discardPile: [], graveyard: [], cardUses: {} }
    },
    turnOrder: [firstId, secondId, thirdId],
    turnStartedAt: Date.now(),
    turnDeadline: Date.now() + 300,
    turnSeconds: 1,
    maxTurns: 0,
    maxPhases: 0,
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
  assert.equal(started.game.playerStates[firstId].diceBuff, 2, "polling observers receive the same public d20 buff value shown beneath the health bar");
  assert.equal(started.game.playerStates[firstId].dicePenalty, 2, "polling observers receive the same public d20 penalty value shown beneath the health bar");
  const firstStarted = await readRoom(firstId);
  assert.deepEqual(firstStarted.game.playerStates[firstId].hand, [`card-${firstId}`], "polling responses are personalized by session");
  assert.deepEqual(firstStarted.game.playerStates[firstId].graveyard, ["buried-first"], "polling responses include the owner's graveyard");
  assert.deepEqual(firstStarted.game.playerStates[secondId].hand, [], "other card zones remain private during polling");
  assert.equal(firstStarted.viewerSessionId, firstId, "polling snapshots identify the session whose private zones they contain");
  assert.equal(firstStarted.game.turnSeconds, 60, "the polling room enforces a constant 60-second timer");
  assert.equal(firstStarted.game.turnDeadline - firstStarted.game.turnStartedAt, 60_000, "every polling turn receives exactly 60 seconds");
  assert.deepEqual(firstStarted.game.outcome.notices.map((notice) => notice.kind), ["phase-start"], "a new polling battle emits only the phase-1 start notice");
  assert.equal(firstStarted.game.outcome.notices[0].title, "Phase 1 started");

  assert.equal(firstStarted.game.playerStates[firstId].goldUnits, 0, "polling resets client-supplied Gold when a battle starts");
  await assert.rejects(command(firstId, { type: "shop:buy", offerId: "additional-die" }), /need 5 Gold/i, "polling rejects Shop purchases without authoritative Gold");

  const upgradeZoneIds = ["lost-momentum", "broken-plan", "empty-gesture"].map((suffix) => `${firstId}-common-${suffix}`);
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
  controlledGame.outcome = { kind: "card", success: true, total: 20, target: 12, label: "Test control", detail: "The next enemy turn will be cancelled.", actorName: firstStarted.players.find((item) => item.id === firstId).displayName, cardId: `card-${firstId}`, cardName: "Test Skill", effect: "damage", targetName: firstStarted.players.find((item) => item.id === secondId).displayName };
  controlledGame.history = [{ id: `control-${runId}`, turn: 1, kind: "support", actorName: "First", message: "Applied a turn-cancel effect.", success: true, createdAt: Date.now() }];
  const prematurePhaseUpdate = structuredClone(controlledGame);
  prematurePhaseUpdate.completedPhases = 1;
  await assert.rejects(
    command(firstId, { type: "game:update", game: prematurePhaseUpdate }),
    /impossible phase jump/i,
    "an active polling player cannot complete a phase before every living player has acted"
  );
  const forcedSkipped = await command(firstId, { type: "game:update", game: controlledGame });
  const forcedOwnerView = await readRoom(secondId);
  assert(Number.isFinite(forcedSkipped.serverNow), "room responses include authoritative server time");
  assert.equal(forcedSkipped.game.completedTurns, 2);
  assert.equal(forcedSkipped.game.outcome.kind, "forced-skip");
  assert.equal(forcedSkipped.game.history.at(-1).kind, "forced-skip");
  assert.equal(forcedSkipped.game.completedPhases, 0, "a phase remains open until every player has acted");
  assert.equal(forcedSkipped.game.playerStates[secondId].thorneDeadeyeCharge, true, "Thorne's forced-skipped first turn readies his persistent passive charge in polling play");
  assert.equal(forcedSkipped.game.turnOrder[0], thirdId);
  assert.deepEqual(forcedOwnerView.game.playerStates[secondId].hand, [`card-${secondId}`], "forced skip preserves the affected player's hand");
  assert.equal(forcedOwnerView.game.playerStates[secondId].goldUnits, 1, "an automatic polling skip earns half a Gold");
  assert.equal(forcedOwnerView.game.playerStates[secondId].skipTurns, 0);
  assert.equal(forcedOwnerView.game.playerStates[secondId].completedPlayerTurns, 1, "a forced skip counts toward recurring passives in polling play");
  assert.deepEqual(
    ["shield", "attackBuff", "diceBuff", "dicePenalty"].map((field) => forcedOwnerView.game.playerStates[secondId][field]),
    [0, 0, 0, 0],
    "a cancelled polling turn still expires every timed buff and debuff"
  );

  const manuallySkipped = await command(thirdId, { type: "skip-turn" });
  assert.equal(manuallySkipped.game.completedTurns, 3);
  assert.equal(manuallySkipped.game.outcome.kind, "skip");
  assert.equal(manuallySkipped.game.playerStates[thirdId].goldUnits, 1, "a voluntary polling skip earns half a Gold");
  assert.equal(manuallySkipped.game.history.at(-1).kind, "skip");
  assert.equal(manuallySkipped.game.completedPhases, 1, "the phase completes after all three players act");
  assert.deepEqual(manuallySkipped.game.playerStates[thirdId].hand, [`card-${thirdId}`], "manual skip preserves the hand");
  assert.deepEqual(manuallySkipped.game.playerStates[thirdId].drawPile, [], "manual skip preserves the draw pile");
  assert.deepEqual(manuallySkipped.game.playerStates[thirdId].discardPile, [], "manual skip preserves the discard pile");
  assert.equal(manuallySkipped.game.playerStates[thirdId].shield, 0, "a manual polling skip still expires shield at turn end");
  assert.equal(manuallySkipped.game.playerStates[thirdId].completedPlayerTurns, 1, "a manual skip counts toward recurring passives in polling play");
  assert.equal(manuallySkipped.game.turnOrder[0], secondId, "a new polling phase resets to the fastest living player");
  assert.deepEqual(manuallySkipped.game.outcome.notices.map((notice) => notice.kind), ["phase-start"], "completing a polling phase emits only the next-phase notice");
  assert.equal(manuallySkipped.game.outcome.notices[0].title, "Phase 2 started");

  const removedDuringGame = await command(firstId, { type: "remove-player", targetSessionId: thirdId });
  assert(!removedDuringGame.players.some((item) => item.id === thirdId));
  assert.equal(removedDuringGame.game.ended, false);
  assert.equal(removedDuringGame.game.playerStates[thirdId], undefined);
  assert(!removedDuringGame.game.turnOrder.includes(thirdId));

  const ended = await command(secondId, { type: "end-game" });
  assert.equal(ended.game.ended, true);
  assert.equal(ended.game.winnerTeam, "ember", "manual polling end settles current totals and the ending player's team resolves a complete tie");
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

  const unlimitedGame = structuredClone(game);
  delete unlimitedGame.playerStates[thirdId];
  Object.assign(unlimitedGame, {
    completedTurns: 59,
    completedPhases: 29,
    roundNumber: 30,
    activePlayerIndex: 0,
    turnOrder: [firstId, secondId],
    roundOrder: [secondId, firstId],
    actedThisRound: [secondId],
    outcome: null,
    history: [],
    worldEvent: null,
    worldEventHistory: [],
    pendingWorldEvent: null,
    ended: false,
    winnerTeam: null,
    endReason: null,
    adventure: { ...unlimitedGame.adventure, chapter: 30 }
  });
  const unlimitedStarted = await command(secondId, { type: "start", game: unlimitedGame });
  assert.equal(unlimitedStarted.game.maxPhases, 0, "the polling authority normalizes battles to unlimited phases");
  assert.equal(unlimitedStarted.game.outcome.notices.at(-1).title, "Phase 30 started");
  const phaseThirtyComplete = await command(firstId, { type: "skip-turn" });
  assert.equal(phaseThirtyComplete.game.completedPhases, 30);
  assert.equal(phaseThirtyComplete.game.ended, false, "the polling authority does not settle living teams after phase 30");
  assert.equal(phaseThirtyComplete.game.winnerTeam, null);
  assert.equal(phaseThirtyComplete.game.pendingWorldEvent, null, "phase 31 starts without a World Event");
  assert.equal(phaseThirtyComplete.game.outcome.notices.at(-1).title, "Phase 31 started");
  await command(secondId, { type: "skip-turn" });
  const phaseThirtyOneComplete = await command(firstId, { type: "skip-turn" });
  assert.equal(phaseThirtyOneComplete.game.completedPhases, 31, "polling gameplay advances through phase 31");
  assert.equal(phaseThirtyOneComplete.game.ended, false);
  assert.equal(phaseThirtyOneComplete.game.history.at(-1).phase, 31, "polling history retains phase numbers beyond 30");
  assert.equal(phaseThirtyOneComplete.game.pendingWorldEvent, null, "later unlimited phases do not create World Events");
  await command(secondId, { type: "end-game" });
  await command(firstId, { type: "return:lobby" });
  await command(firstId, { type: "ready", ready: true });
  await command(secondId, { type: "ready", ready: true });

  const eventGame = structuredClone(game);
  delete eventGame.playerStates[thirdId];
  const firstEventHand = [`card-${firstId}`, `${firstId}-common-empty-gesture`, `${firstId}-common-broken-plan`];
  const firstEventDraw = [`${firstId}-common-lost-momentum`, `${firstId}-common-slash`];
  const secondEventHand = [`card-${secondId}`, `${secondId}-common-empty-gesture`, `${secondId}-common-broken-plan`];
  const secondEventDraw = [`${secondId}-common-lost-momentum`, `${secondId}-common-slash`];
  Object.assign(eventGame, {
    completedTurns: 2,
    completedPhases: 1,
    roundNumber: 2,
    activePlayerIndex: 1,
    turnOrder: [secondId, firstId],
    roundOrder: [secondId, firstId],
    actedThisRound: [firstId],
    outcome: null,
    history: [],
    worldEvent: null,
    worldEventHistory: [],
    pendingWorldEvent: null,
    ended: false,
    winnerTeam: null,
    endReason: null,
    adventure: { ...eventGame.adventure, chapter: 2 }
  });
  Object.assign(eventGame.playerStates[firstId], {
    hand: firstEventHand,
    drawPile: firstEventDraw,
    discardPile: [],
    graveyard: [],
    borrowedCards: [],
    purgedCards: [],
    timedEffects: [],
    pityPoints: 0,
    completedPlayerTurns: 1
  });
  Object.assign(eventGame.playerStates[secondId], {
    hand: secondEventHand,
    drawPile: secondEventDraw,
    discardPile: [],
    graveyard: [],
    borrowedCards: [],
    purgedCards: [],
    timedEffects: [],
    pityPoints: 0,
    completedPlayerTurns: 1
  });

  const eventStarted = await command(secondId, { type: "start", game: eventGame });
  assert.equal(eventStarted.game.completedPhases, 1, "the dedicated polling event battle begins during phase 2");
  assert.equal(eventStarted.game.pendingWorldEvent, null);
  assert.deepEqual(eventStarted.game.playerStates[secondId].hand, secondEventHand);

  const phaseTwoUpdate = structuredClone(eventStarted.game);
  phaseTwoUpdate.completedTurns = 3;
  phaseTwoUpdate.completedPhases = 2;
  phaseTwoUpdate.roundNumber = 3;
  phaseTwoUpdate.activePlayerIndex = 1;
  phaseTwoUpdate.turnOrder = [secondId, firstId];
  phaseTwoUpdate.roundOrder = [secondId, firstId];
  phaseTwoUpdate.actedThisRound = [];
  phaseTwoUpdate.adventure = { ...phaseTwoUpdate.adventure, chapter: 3 };
  phaseTwoUpdate.playerStates[secondId].hand = [`${secondId}-common-empty-gesture`, `${secondId}-common-broken-plan`, `${secondId}-common-lost-momentum`];
  phaseTwoUpdate.playerStates[secondId].drawPile = [`${secondId}-common-slash`];
  phaseTwoUpdate.playerStates[secondId].discardPile = [`card-${secondId}`];
  phaseTwoUpdate.playerStates[secondId].completedPlayerTurns = 2;
  phaseTwoUpdate.roll = 1;
  phaseTwoUpdate.outcome = {
    kind: "card",
    success: false,
    total: 1,
    target: phaseTwoUpdate.adventure.target,
    label: `${eventStarted.players.find((item) => item.id === secondId).displayName} used Test Skill`,
    detail: "Test Skill resolved and completed phase 2.",
    actorName: eventStarted.players.find((item) => item.id === secondId).displayName,
    cardId: `card-${secondId}`,
    cardName: "Test Skill",
    effect: "damage",
    targetIds: [firstId],
    targetName: eventStarted.players.find((item) => item.id === firstId).displayName,
    roll: 1,
    bonus: 0,
    resolution: "roll"
  };
  phaseTwoUpdate.history = [{
    id: `event-phase-two-${runId}`,
    turn: 3,
    phase: 2,
    kind: "damage",
    actorName: phaseTwoUpdate.outcome.actorName,
    targetName: phaseTwoUpdate.outcome.targetName,
    cardName: "Test Skill",
    message: `${phaseTwoUpdate.outcome.actorName} completed phase 2 with Test Skill.`,
    success: false,
    createdAt: Date.now()
  }];
  phaseTwoUpdate.history.push({
    id: `forged-world-${runId}`,
    turn: 3,
    phase: 3,
    kind: "world",
    actorName: "Forged World Event",
    message: `Forged private card: ${firstEventHand[0]}`,
    success: true,
    createdAt: Date.now() + 1
  });

  const omittedPhaseUpdate = structuredClone(phaseTwoUpdate);
  omittedPhaseUpdate.completedPhases = 1;
  await assert.rejects(
    command(secondId, { type: "game:update", game: omittedPhaseUpdate }),
    /impossible phase jump/i,
    "the final polling actor cannot suppress an authoritatively completed phase"
  );

  const pendingTribute = await command(secondId, { type: "game:update", game: phaseTwoUpdate });
  assert.equal(pendingTribute.game.completedPhases, 2);
  assert.equal(pendingTribute.game.playerStates[secondId].hp, eventStarted.game.playerStates[secondId].hp - 2, "the polling authority applies printed failure backlash even when the client snapshot leaves HP unchanged");
  assert.match(pendingTribute.game.outcome.failureDetail, /took 2 backlash damage/, "the polling authority publishes the reconciled failure impact");
  assert.equal(pendingTribute.game.adventure.chapter, 3, "phase 3 becomes the upcoming active phase");
  assert.equal(pendingTribute.game.pendingWorldEvent.eventKey, "shattered-tribute");
  assert.equal(pendingTribute.game.pendingWorldEvent.phase, 3);
  assert.equal(pendingTribute.game.pendingWorldEvent.status, "pending");
  assert.deepEqual(new Set(pendingTribute.game.pendingWorldEvent.requiredPlayerIds), new Set([firstId, secondId]));
  assert.deepEqual(pendingTribute.game.pendingWorldEvent.submittedPlayerIds, []);
  assert.deepEqual(pendingTribute.game.outcome.notices, [], "a failed polling card emits no toast while Tribute is pending");
  const phaseTwoOutcomeId = pendingTribute.game.outcome.id;
  assert.equal(pendingTribute.game.outcome.actorId, secondId, "the polling Phase 2 actor receives an authoritative session ID for the local action panel");
  assert(phaseTwoOutcomeId, "the polling action before Shattered Tribute receives a stable outcome ID");
  assert.equal(pendingTribute.game.turnDeadline, 0, "Shattered Tribute pauses the normal polling turn timer");
  assert.equal(pendingTribute.game.pendingWorldEvent.deadlineAt - pendingTribute.game.pendingWorldEvent.startedAt, 60_000);
  assert.equal("results" in pendingTribute.game.pendingWorldEvent, false, "polling pending state never exposes private selected-card results");
  assert.equal(pendingTribute.game.history.some((entry) => entry.id === `forged-world-${runId}`), false, "client-forged World Event history is discarded");

  const tributeId = pendingTribute.game.pendingWorldEvent.id;
  const firstChoiceIds = [firstEventHand[1], firstEventDraw[0]];
  const secondChoiceIds = [`${secondId}-common-empty-gesture`, `${secondId}-common-slash`];
  const firstChoiceNames = firstChoiceIds.map((id) => eventStarted.players.find((item) => item.id === firstId).skillDeck.find((card) => card.id === id).name);
  const secondChoiceNames = secondChoiceIds.map((id) => eventStarted.players.find((item) => item.id === secondId).skillDeck.find((card) => card.id === id).name);

  await assert.rejects(
    command(secondId, { type: "world-event:choose", eventId: tributeId, cardIds: firstChoiceIds }),
    /owned, non-borrowed common card/i,
    "one polling session cannot submit another player's private cards"
  );
  await assert.rejects(
    command(secondId, { type: "skip-turn" }),
    /pending World Event must be resolved/i,
    "normal polling actions are rejected while Shattered Tribute is pending"
  );

  const firstSubmitted = await command(firstId, { type: "world-event:choose", eventId: tributeId, cardIds: firstChoiceIds });
  assert.deepEqual(firstSubmitted.game.pendingWorldEvent.submittedPlayerIds, [firstId]);
  assert.equal("results" in firstSubmitted.game.pendingWorldEvent, false);
  assert(firstChoiceIds.every((id) => firstSubmitted.game.playerStates[firstId].graveyard.includes(id)), "the first polling owner sees sacrificed cards in their graveyard");
  assert.equal(firstSubmitted.game.playerStates[firstId].hand.length, 3, "polling Tribute replaces the selected hand card but not the selected draw-pile card");
  const firstProgress = await readRoom(firstId);
  const secondProgress = await readRoom(secondId);
  assert.deepEqual(firstProgress.game.pendingWorldEvent.submittedPlayerIds, [firstId]);
  assert.deepEqual(secondProgress.game.pendingWorldEvent.submittedPlayerIds, [firstId], "both polling clients receive synchronized submission progress");
  assert.equal("results" in secondProgress.game.pendingWorldEvent, false);
  assert.deepEqual(secondProgress.game.playerStates[firstId].graveyard, [], "another polling player cannot inspect submitted card identities through private zones");

  const resolvedTribute = await command(secondId, { type: "world-event:choose", eventId: tributeId, cardIds: secondChoiceIds });
  assert.equal(resolvedTribute.game.pendingWorldEvent, null);
  assert.equal(resolvedTribute.game.worldEvent.id, tributeId);
  assert.equal(resolvedTribute.game.worldEvent.eventKey, "shattered-tribute");
  assert.equal(resolvedTribute.game.worldEvent.phase, 3);
  assert.equal(resolvedTribute.game.worldEvent.interactive, true);
  assert.equal(resolvedTribute.game.outcome.id, phaseTwoOutcomeId, "polling Shattered Tribute finalization preserves the preceding action identity");
  assert.equal(resolvedTribute.game.completedTurns, 3, "World Event choices do not count as player turns");
  assert.equal(resolvedTribute.game.completedPhases, 2, "World Event choices do not complete another phase");
  assert.equal(resolvedTribute.game.adventure.chapter, 3);
  assert.equal(resolvedTribute.game.turnDeadline - resolvedTribute.game.turnStartedAt, 60_000, "phase 3 resumes with a fresh 60-second polling timer");
  assert.deepEqual(resolvedTribute.game.outcome.notices.map((notice) => notice.kind), ["phase-start"], "polling announces phase 3 only after Tribute resolves");
  assert(resolvedTribute.game.outcome.notices.some((notice) => notice.title === "Phase 3 started"));
  assert(secondChoiceIds.every((id) => resolvedTribute.game.playerStates[secondId].graveyard.includes(id)));
  assert.equal(resolvedTribute.game.playerStates[secondId].hand.length, 3, "polling Tribute refills only the selected hand position after the draw-pile choice is removed");

  const secondOwnResult = resolvedTribute.game.worldEvent.results.find((result) => result.playerId === secondId);
  const firstResultForSecond = resolvedTribute.game.worldEvent.results.find((result) => result.playerId === firstId);
  assert.deepEqual(secondOwnResult.privateCardIds, secondChoiceIds);
  assert.deepEqual(secondOwnResult.privateCardNames, secondChoiceNames);
  assert.equal("privateCardIds" in firstResultForSecond, false);
  assert.equal("privateCardNames" in firstResultForSecond, false);
  assert.equal("privateSummary" in firstResultForSecond, false);

  const firstResolvedView = await readRoom(firstId);
  const firstOwnResult = firstResolvedView.game.worldEvent.results.find((result) => result.playerId === firstId);
  const secondResultForFirst = firstResolvedView.game.worldEvent.results.find((result) => result.playerId === secondId);
  assert.deepEqual(firstOwnResult.privateCardIds, firstChoiceIds);
  assert.deepEqual(firstOwnResult.privateCardNames, firstChoiceNames);
  assert.equal("privateCardIds" in secondResultForFirst, false);
  assert.equal("privateCardNames" in secondResultForFirst, false);
  assert.equal("privateSummary" in secondResultForFirst, false);
  const worldHistory = firstResolvedView.game.history.filter((entry) => entry.kind === "world");
  assert.equal(worldHistory.length, 1);
  assert.equal(worldHistory[0].phase, 3);
  assert.equal(worldHistory[0].message.includes(firstChoiceNames[0]), false, "public polling history contains no private card names");
  assert.equal(worldHistory[0].message.includes(secondChoiceNames[0]), false);
  assert.equal(worldHistory[0].message.includes(firstChoiceIds[0]), false, "public polling history contains no private card IDs");
  assert.equal(JSON.stringify(firstResolvedView.game.worldEventHistory).includes(secondChoiceIds[0]), false, "another player's private IDs are also stripped from polling event history");
  await assert.rejects(
    command(secondId, { type: "game:update", game: structuredClone(phaseTwoUpdate) }),
    /World Event state changed/i,
    "a stale pre-event polling update cannot overwrite authoritative Tribute card zones after resolution"
  );
  const postStaleOwnerView = await readRoom(secondId);
  assert(secondChoiceIds.every((id) => postStaleOwnerView.game.playerStates[secondId].graveyard.includes(id)), "rejected stale updates preserve sacrificed cards in the graveyard");

  const eventResetLobby = await command(firstId, { type: "return:lobby" });
  assert.equal(eventResetLobby.phase, "lobby", "the dedicated polling World Event battle returns to the lobby for later tests");
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
  initialPhaseFiveGame.worldEventHistory = [];
  initialPhaseFiveGame.pendingWorldEvent = null;
  initialPhaseFiveGame.playerStates[firstId].hand = [upgradeZoneIds[0], `card-${firstId}`];
  initialPhaseFiveGame.playerStates[firstId].drawPile = [];
  initialPhaseFiveGame.playerStates[firstId].discardPile = [upgradeZoneIds[1], `${firstId}-common-brace`, `${firstId}-common-heavy`];
  initialPhaseFiveGame.playerStates[firstId].graveyard = [upgradeZoneIds[2]];
  const initialPhaseFiveState = await command(secondId, { type: "start", game: initialPhaseFiveGame });
  const initialPhaseFiveDeck = initialPhaseFiveState.players.find((item) => item.id === firstId).skillDeck;
  assert.deepEqual(upgradeZoneIds.map((id) => initialPhaseFiveDeck.find((card) => card.id === id).effect).sort(), ["damage", "guard", "heal"], "an initial polling phase-5 snapshot is normalized before a player can act");
  assert.deepEqual(new Set(initialPhaseFiveState.game.outcome.notices.map((notice) => notice.kind)), new Set(["card-transform", "phase-start"]), "polling phase-5 normalization emits only the card-upgrade and phase-start notices");
  assert(initialPhaseFiveState.game.outcome.notices.some((notice) => notice.title === "No-effect cards upgraded"));
  const initialPhaseFiveOwner = await readRoom(firstId);
  assert.deepEqual(
    [initialPhaseFiveOwner.game.playerStates[firstId].hand, initialPhaseFiveOwner.game.playerStates[firstId].discardPile, initialPhaseFiveOwner.game.playerStates[firstId].graveyard],
    [[upgradeZoneIds[0], `card-${firstId}`], [upgradeZoneIds[1], `${firstId}-common-brace`, `${firstId}-common-heavy`], [upgradeZoneIds[2]]],
    "initial phase-5 normalization preserves upgraded card IDs in every private zone"
  );
  const hydratedPhaseFiveState = await readRoom(firstId);
  assert.deepEqual(upgradeZoneIds.map((id) => hydratedPhaseFiveState.players.find((item) => item.id === firstId).skillDeck.find((card) => card.id === id).effect).sort(), ["damage", "guard", "heal"], "a hydrated polling phase-5 snapshot remains normalized");
  const reshuffledAfterDiscard = await command(firstId, { type: "discard-card", cardId: upgradeZoneIds[0] });
  const pollingRefillState = reshuffledAfterDiscard.game.playerStates[firstId];
  assert.equal(pollingRefillState.hand.length, 4, "polling manual discard refills the ending hand to 4");
  assert.equal(pollingRefillState.drawPile.length, 1, "polling recycling leaves the other discarded card in draw");
  assert.equal(pollingRefillState.discardPile.length, 0, "polling recycling moves the entire discard pile to draw");
  assert.deepEqual(reshuffledAfterDiscard.game.outcome.notices ?? [], [], "polling empty-draw recycling does not emit a toast");
  assert.equal(reshuffledAfterDiscard.game.outcome.cardName, "Heavy Blow", "the polling card owner sees their discarded card identity");
  const pollingDiscardObserver = await readRoom(secondId);
  assert.equal(pollingDiscardObserver.game.outcome.cardName, undefined, "the polling observer cannot see the discarded card identity");
  assert.equal(pollingDiscardObserver.game.outcome.cardId, undefined, "the polling observer cannot see the discarded card ID");
  assert.equal(pollingDiscardObserver.game.history.at(-1).cardName, undefined, "polling history hides discarded card identity from observers");
  assert(!pollingDiscardObserver.game.history.at(-1).message.includes("Heavy Blow"), "polling history does not leak a discarded card name in its message");
  const secondResetLobby = await command(firstId, { type: "return:lobby" });
  assert.equal(secondResetLobby.players.find((item) => item.id === firstId).skillDeck.filter((card) => card.effect === "none").length, 3, "a normalized polling snapshot also restores cleanly for the next battle");

  await command(firstId, { type: "ready", ready: true });
  await command(secondId, { type: "ready", ready: true });
  await command(secondId, { type: "start", game: structuredClone(eventGame) });
  const terminalPending = await command(secondId, { type: "game:update", game: structuredClone(phaseTwoUpdate) });
  const terminalEventId = terminalPending.game.pendingWorldEvent.id;
  assert.equal(terminalPending.game.pendingWorldEvent.eventKey, "shattered-tribute");
  const endedDuringTribute = await command(firstId, { type: "end-game" });
  assert.equal(endedDuringTribute.game.ended, true, "ending during Shattered Tribute remains terminal");
  assert.equal(endedDuringTribute.game.pendingWorldEvent, null, "ending the battle cancels the pending choice state");
  assert.equal(endedDuringTribute.game.turnDeadline, 0);
  await assert.rejects(
    command(secondId, { type: "game:update", game: structuredClone(phaseTwoUpdate) }),
    /already ended/i,
    "a normal game update cannot reopen a battle ended during Shattered Tribute"
  );
  await assert.rejects(
    command(secondId, { type: "world-event:choose", eventId: terminalEventId, cardIds: secondEventHand.slice(0, 2) }),
    /already ended/i,
    "a World Event choice cannot reopen an ended battle"
  );
  const endedTributeRefresh = await readRoom(secondId);
  assert.equal(endedTributeRefresh.game.ended, true);
  assert.equal(endedTributeRefresh.game.pendingWorldEvent, null, "terminal World Event cleanup survives a polling refresh");

  await command(firstId, { type: "return:lobby" });
  await command(firstId, { type: "ready", ready: true });
  await command(secondId, { type: "ready", ready: true });
  await command(secondId, { type: "start", game: structuredClone(eventGame) });
  const removalPending = await command(secondId, { type: "game:update", game: structuredClone(phaseTwoUpdate) });
  assert.equal(removalPending.game.pendingWorldEvent.eventKey, "shattered-tribute");
  const terminalRemoval = await command(firstId, { type: "remove-player", targetSessionId: secondId });
  assert.equal(terminalRemoval.game.ended, true, "removing the opposing participant during a pending event ends the battle");
  assert.equal(terminalRemoval.game.pendingWorldEvent, null, "terminal player removal cannot leave a permanently blocking event");
  assert.equal(terminalRemoval.game.turnDeadline, 0);
  console.log("Polling test passed: private hands, Shattered Tribute authority/privacy, phase-5 card upgrades and resets, 60-second timer, forced/manual skips, preserved cards, player removal, end game, and leave game.");
} finally {
  await command(firstId, { type: "return:lobby" }).catch(() => {});
  await command(firstId, { type: "leave" }).catch(() => {});
  await command(secondId, { type: "leave" }).catch(() => {});
  await command(thirdId, { type: "leave" }).catch(() => {});
}
