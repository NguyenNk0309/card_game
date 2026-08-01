import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  WORLD_EVENT_DEFINITIONS,
  WORLD_EVENT_PHASES,
  WORLD_EVENT_SCHEDULE,
  getNextWorldEventPhase,
  getPreviousWorldEventPhase,
  getWorldEventDefinition,
  getWorldEventScheduleEntry,
  isWorldEventPhase
} from "../shared/worldEvents.mjs";
import * as worldEventEngine from "../backend/world-event-engine.mjs";

const gameAppSource = await readFile(new URL("../ui/GameApp.tsx", import.meta.url), "utf8");
const worldEventPanelsSource = await readFile(new URL("../ui/components/WorldEventPanels.tsx", import.meta.url), "utf8");
const EXPECTED_PHASES = [3, 7, 12, 17, 22, 27];
const EXPECTED_KEYS = [
  "shattered-tribute",
  "shifting-arsenal", "first-blood", "unstable-wards",
  "broken-formation", "arcane-static", "supply-rot",
  "gravewind", "eclipse-of-fortune", "shieldquake",
  "severed-oaths", "time-fracture", "crimson-debt",
  "final-collapse", "the-last-cards", "sudden-death"
];

{
  const priorityLine = gameAppSource.split(/\r?\n/).find((line) => line.includes("const activeAutoPanel =")) ?? "";
  const priorityTokens = [
    "showOutcome",
    "showTurnSummary",
    "showNonWorldLifeEvent",
    "worldEventBlocking",
    "showWorldEvent",
    "showWorldLifeEvent",
    "showRunComplete"
  ];
  let previousIndex = -1;
  for (const token of priorityTokens) {
    const index = priorityLine.indexOf(token);
    assert(index > previousIndex, `${token} follows the required automatic-panel priority`);
    previousIndex = index;
  }

  const queueStart = gameAppSource.indexOf("const lifeEvents = outcome?.lifeEvents ?? [];");
  const queueEnd = gameAppSource.indexOf("if (freshPresentations.length)", queueStart);
  const queueSource = gameAppSource.slice(queueStart, queueEnd);
  const queueTokens = [
    'event.source !== "world-event"',
    "game.worldEvent && game.worldEvent.phase !== 3",
    'event.source === "world-event"',
    "if (runComplete && battleResultKey)"
  ];
  previousIndex = -1;
  for (const token of queueTokens) {
    const index = queueSource.indexOf(token);
    assert(index > previousIndex, `${token} follows the required presentation queue order`);
    previousIndex = index;
  }

  const outcomeLine = gameAppSource.split(/\r?\n/).find((line) => line.includes("const showOutcome =")) ?? "";
  const summaryLine = gameAppSource.split(/\r?\n/).find((line) => line.includes("const showTurnSummary =")) ?? "";
  const outcomeKeyLine = gameAppSource.split(/\r?\n/).find((line) => line.includes("const outcomeKey =")) ?? "";
  assert(!outcomeLine.includes("runComplete") && !summaryLine.includes("runComplete"), "the final action or summary displays before Battle Complete");
  const localOutcomeLine = gameAppSource.split(/\r?\n/).find((line) => line.includes("const isLocalActionOutcome =")) ?? "";
  assert(outcomeKeyLine.includes("outcome.id ??") && !outcomeKeyLine.includes("turnStartedAt"), "authoritative action identity remains stable when a World Event resets turn timing");
  assert(localOutcomeLine.includes("outcome.actorId === localPlayer.id"), "Your Action identifies its local actor by stable session ID");
  assert.match(gameAppSource, /outcome\.kind === "card" \|\| outcome\.kind === "discard" \|\| outcome\.kind === "skip"/, "local card, Discard, and manual Skip outcomes use Your Action");
  assert.match(gameAppSource, /outcome\.kind === "discard" \|\| outcome\.kind === "skip" \? <LocalTurnActionPanel/, "local Discard and manual Skip render the non-dice Your Action panel");
  assert.match(gameAppSource, /showPendingWorldEventChoice && pendingWorldEvent && <ShatteredTributeChoicePanel/, "the phase-3 choice waits for higher-priority presentations");
  assert.match(worldEventPanelsSource, /cardIds: localState\.hand[\s\S]*cardIds: localState\.drawPile[\s\S]*cardIds: localState\.discardPile/, "the phase-3 choice panel includes hand, draw-pile, and discard-pile cards");
  assert.match(worldEventPanelsSource, /eligible: owned && !borrowed && !ownedCard\?\.unique/, "the phase-3 choice panel enables only owned common cards");
  assert.match(worldEventPanelsSource, /\.filter\(\(entry\) => !entry\.card\?\.unique\)/, "the phase-3 choice panel does not render special cards");
  assert.match(gameAppSource, /activeAutoPanel === "life" \|\| activeAutoPanel === "world"/, "resolved World Events auto-close with other timed panels");
  assert.match(gameAppSource, /onClick=\{closeModal\}/, "resolved World Events can close from the modal backdrop");
  assert.match(gameAppSource, /onClose=\{\(\) => dismissPresentation\(\)\}/, "resolved World Events receive the standard close action");
  assert.match(worldEventPanelsSource, /aria-label="Close"><X size=\{18\}\/>/, "resolved World Events render a close button inside their focus trap");
  assert.doesNotMatch(worldEventPanelsSource, /world-event-team-summaries|Team impact|Occurred before phase|Next World Event/, "resolved World Events omit team-impact and phase-metric sections");
  assert.doesNotMatch(worldEventPanelsSource, /world-event-resolution-actions|View Battle History|onContinue|onViewHistory/, "resolved World Events omit Continue and View Battle History actions");
  const guideStart = gameAppSource.indexOf("function DetailedGuide");
  const guideEnd = gameAppSource.indexOf("function ConfirmedTopAction", guideStart);
  const guideSource = gameAppSource.slice(guideStart, guideEnd);
  assert.equal((guideSource.match(/<article><strong>/g) || []).length, 7, "the quick guide keeps seven concise guidance items");
  assert.match(guideSource, /6 · World Events occur before phases 3, 7, 12, 17, 22, and 27\.[\s\S]*7 · Eliminate the enemy team, or lead in HP after phase 30\./, "World Events are guidance 6 and victory is guidance 7");
  assert.doesNotMatch(guideSource, /<article><strong>[^<]+<\/strong><p>|WorldEventLibrary|World Event system/, "guidance uses one-sentence headers without World Event detail");
  assert.doesNotMatch(gameAppSource, /guide-world-event-library|tutorial-world-event-library/, "guidance surfaces do not embed the World Event library");
  assert.doesNotMatch(gameAppSource, /getWorldEventsForPhase|possibleEventDetails/, "phase tooltips must not list every possible World Event");
  assert.match(gameAppSource, /worldEventPlan\?\.\[phase\][\s\S]*plannedDefinition[\s\S]*plannedDefinition\.title[\s\S]*plannedDefinition\.fullDescription/, "phase tooltips show the one World Event planned for the current battle");
}

const makeCard = (ownerId, suffix, { unique = false, name = suffix } = {}) => ({
  id: `${ownerId}-${suffix}`,
  name,
  description: `${name} test card.`,
  bonus: 0,
  effect: unique ? "support" : "damage",
  target: unique ? "self" : "enemy",
  value: unique ? 1 : 3,
  pityCost: unique ? 4 : 3,
  unique
});

const makePlayer = (id, team, {
  displayName = id,
  heroName = `${displayName} Hero`,
  speed = 5,
  joinedAt = 1,
  maxHp = 12
} = {}) => {
  const skillDeck = [
    makeCard(id, "common-a", { name: `${displayName} Common A` }),
    makeCard(id, "common-b", { name: `${displayName} Common B` }),
    makeCard(id, "common-c", { name: `${displayName} Common C` }),
    makeCard(id, "common-d", { name: `${displayName} Common D` }),
    makeCard(id, "common-e", { name: `${displayName} Common E` }),
    makeCard(id, "common-f", { name: `${displayName} Common F` }),
    makeCard(id, "common-g", { name: `${displayName} Common G` }),
    makeCard(id, "special-a", { name: `${displayName} Special A`, unique: true }),
    makeCard(id, "special-b", { name: `${displayName} Special B`, unique: true }),
    makeCard(id, "special-c", { name: `${displayName} Special C`, unique: true })
  ];
  return {
    id,
    displayName,
    ready: true,
    joinedAt,
    hero: {
      id: `hero-${id}`,
      name: heroName,
      title: "Test Hero",
      role: "Support",
      classId: "support",
      className: "Supporter",
      passiveName: heroName === "Sable Fen" ? "Second Sight" : "Test Passive",
      passiveText: "Test passive.",
      skill: "Test Skill",
      skillText: "Test skill.",
      summary: "Test hero.",
      strength: "Testing.",
      weakness: "Testing.",
      impact: "Testing.",
      hp: maxHp,
      maxHp,
      speed,
      team,
      color: "#888888",
      initials: displayName.slice(0, 2).toUpperCase()
    },
    skillDeck
  };
};

const makeRunState = (player) => ({
  sessionId: player.id,
  hp: player.hero.maxHp,
  maxHp: player.hero.maxHp,
  shield: 0,
  attackBuff: 0,
  diceBuff: 0,
  dicePenalty: 0,
  pityPoints: 0,
  reviveIn: 0,
  passiveReviveUsed: false,
  skipTurns: 0,
  completedPlayerTurns: 0,
  zeroPityUntilTurn: 0,
  timedEffects: [],
  borrowedCards: [],
  purgedCards: [],
  cardUses: {},
  hand: player.skillDeck.slice(0, 4).map((card) => card.id),
  drawPile: player.skillDeck.slice(4).map((card) => card.id),
  discardPile: [],
  graveyard: []
});

const makeGame = (players, overrides = {}) => {
  const order = [...players]
    .sort((left, right) => right.hero.speed - left.hero.speed || left.joinedAt - right.joinedAt)
    .map((player) => player.id);
  return {
    adventure: {
      seed: "WORLD-EVENT-TEST",
      realm: { id: "test", name: "Test", region: "Test", weather: "Test", objective: "Test", threat: "Test", accent: "#fff", sceneClass: "test" },
      chapter: 1,
      maxChapters: 30,
      story: "Test",
      event: "Test",
      target: 12,
      worldDoom: 0,
      veilInfluence: 0,
      emberInfluence: 0
    },
    activePlayerIndex: players.findIndex((player) => player.id === order[0]),
    completedTurns: 0,
    completedPhases: 0,
    roll: null,
    outcome: null,
    playerStates: Object.fromEntries(players.map((player) => [player.id, makeRunState(player)])),
    turnStartedAt: 1_000,
    turnDeadline: 61_000,
    turnSeconds: 60,
    maxTurns: 30,
    maxPhases: 30,
    ended: false,
    endReason: null,
    winnerTeam: null,
    history: [],
    worldEvent: null,
    worldEventHistory: [],
    pendingWorldEvent: null,
    turnOrder: order,
    roundNumber: 1,
    roundOrder: order,
    actedThisRound: [],
    ...overrides
  };
};

const clone = (value) => structuredClone(value);
const playerCard = (player, suffix) => player.skillDeck.find((card) => card.id === `${player.id}-${suffix}`);
const sequenceRandomInt = (...values) => {
  let index = 0;
  return (minimum, maximum) => Math.min(maximum, Math.max(minimum, values[Math.min(index++, values.length - 1)] ?? minimum));
};
const minimumRandomInt = (minimum) => minimum;
const eventOptions = (overrides = {}) => ({ now: 10_000, randomInt: minimumRandomInt, lastTeam: "veil", ...overrides });
const resolveEvent = (game, players, key, overrides = {}) => worldEventEngine.resolveWorldEventByKey(game, players, key, eventOptions(overrides));

assert.deepEqual(WORLD_EVENT_PHASES, EXPECTED_PHASES, "the World Event schedule uses exactly the six required phases");
assert.deepEqual(WORLD_EVENT_SCHEDULE.map((entry) => entry.phase), EXPECTED_PHASES);
assert.equal(WORLD_EVENT_SCHEDULE[0].selection, "fixed");
assert.deepEqual(WORLD_EVENT_SCHEDULE[0].eventKeys, ["shattered-tribute"]);
for (const entry of WORLD_EVENT_SCHEDULE.slice(1)) {
  assert.equal(entry.selection, "random", `phase ${entry.phase} randomly selects its event`);
  assert.equal(entry.eventKeys.length, 3, `phase ${entry.phase} has three events`);
  assert.equal(new Set(entry.eventKeys).size, 3, `phase ${entry.phase} event keys are unique`);
}
assert.deepEqual(Object.keys(WORLD_EVENT_DEFINITIONS), EXPECTED_KEYS);
assert.match(WORLD_EVENT_DEFINITIONS["shattered-tribute"].fullDescription, /2 owned common cards[\s\S]*enter graveyard[\s\S]*removed hand cards are replaced[\s\S]*Special and borrowed cards are excluded/i);
for (const entry of WORLD_EVENT_SCHEDULE) {
  assert.equal(isWorldEventPhase(entry.phase), true);
  assert.equal(getWorldEventScheduleEntry(entry.phase), entry);
  for (const key of entry.eventKeys) {
    const definition = getWorldEventDefinition(key);
    assert(definition, `${key} resolves to a catalog definition`);
    assert.equal(definition.phase, entry.phase);
    assert.equal(definition.level, entry.level);
    assert.equal(definition.intensity, entry.intensity);
    assert(definition.fullDescription.length > definition.title.length);
    assert(definition.shortDescription.length <= 110, `${key} has concise summary copy`);
    assert(definition.fullDescription.length <= 275, `${key} has concise detail copy`);
  }
}
assert.equal(isWorldEventPhase(5), false);
assert.equal(getWorldEventScheduleEntry(5), null);
assert.deepEqual(EXPECTED_PHASES.map((phase) => getNextWorldEventPhase(phase)), [7, 12, 17, 22, 27, null]);
assert.deepEqual(EXPECTED_PHASES.map((phase) => getPreviousWorldEventPhase(phase)), [null, 3, 7, 12, 17, 22]);
assert.deepEqual(WORLD_EVENT_SCHEDULE.map((entry) => entry.level), [1, 2, 3, 4, 5, 6]);
assert.deepEqual(WORLD_EVENT_SCHEDULE.map((entry) => entry.intensity), ["Opening", "Minor", "Moderate", "Strong", "Severe", "Catastrophic"]);

// Engine tests are kept below the catalog contract so catalog failures remain precise.
const veilFast = makePlayer("veil-fast", "veil", { displayName: "Vale", speed: 9, joinedAt: 2 });
const emberFast = makePlayer("ember-fast", "ember", { displayName: "Ember", speed: 8, joinedAt: 3 });
const veilSlow = makePlayer("veil-slow", "veil", { displayName: "Vela", speed: 5, joinedAt: 1 });
const emberSlow = makePlayer("ember-slow", "ember", { displayName: "Ash", speed: 4, joinedAt: 4 });
const fourPlayers = [veilFast, emberFast, veilSlow, emberSlow];

{
  const legacy = makeGame([veilFast, emberFast]);
  delete legacy.worldEventHistory;
  delete legacy.pendingWorldEvent;
  legacy.worldEvent = { id: "legacy-world", turn: 7, level: 2, title: "First Blood", description: "Legacy event." };
  worldEventEngine.normalizeWorldEventState(legacy);
  assert.equal(legacy.pendingWorldEvent, null, "old states normalize a missing pending event to null");
  assert.equal(legacy.worldEvent.eventKey, "first-blood", "a readable legacy event maps to its stable catalog key");
  assert.equal(legacy.worldEventHistory.length, 1, "a legacy current event seeds event history");
  assert.deepEqual(legacy.worldEvent.results, [], "legacy events normalize missing structured results");
  legacy.history = [
    { id: "normal-before", kind: "damage", createdAt: 100 },
    { id: "authoritative-world-history", kind: "world", createdAt: 200 }
  ];

  const captured = worldEventEngine.captureAuthoritativeWorldEventState(legacy);
  const capturedPlan = structuredClone(captured.worldEventPlan);
  legacy.worldEvent = null;
  legacy.worldEventHistory = [];
  legacy.pendingWorldEvent = { id: "forged" };
  legacy.worldEventPlan = { 27: "sudden-death" };
  legacy.history = [
    { id: "normal-before", kind: "damage", createdAt: 100 },
    { id: "forged-world-history", kind: "world", createdAt: 150 },
    { id: "normal-after", kind: "heal", createdAt: 300 }
  ];
  worldEventEngine.restoreAuthoritativeWorldEventState(legacy, captured);
  assert.equal(legacy.worldEvent.id, "legacy-world", "captured authority restores the current event");
  assert.equal(legacy.pendingWorldEvent, null, "captured authority ignores a forged pending event");
  assert.deepEqual(legacy.worldEventPlan, capturedPlan, "captured authority ignores a forged World Event plan");
  assert.deepEqual(legacy.history.map((entry) => entry.id), ["normal-before", "authoritative-world-history", "normal-after"], "captured authority preserves normal history while restoring only server-owned World Event entries");

  worldEventEngine.initializeNewBattleWorldEvents(legacy, { randomInt: minimumRandomInt });
  assert.equal(legacy.worldEvent, null);
  assert.deepEqual(legacy.worldEventHistory, []);
  assert.equal(legacy.pendingWorldEvent, null);
  assert.deepEqual(legacy.worldEventPlan, Object.fromEntries(WORLD_EVENT_SCHEDULE.map((entry) => [entry.phase, entry.eventKeys[0]])), "a new battle preselects exactly one authoritative event for every scheduled phase");
}

{
  const game = makeGame([veilFast, emberFast]);
  const state = game.playerStates[veilFast.id];
  const borrowedId = playerCard(emberFast, "common-a").id;
  state.hand = [playerCard(veilFast, "common-a").id, borrowedId, playerCard(veilFast, "common-b").id];
  state.drawPile = veilFast.skillDeck.slice(2).map((card) => card.id);
  state.borrowedCards = [{ cardId: borrowedId, ownerId: emberFast.id, borrowedAtTurn: 0 }];
  const reusableBefore = state.hand.filter((id) => id.startsWith(`${veilFast.id}-`)).length + state.drawPile.length;
  const event = resolveEvent(game, [veilFast, emberFast], "shifting-arsenal");
  assert(state.hand.includes(borrowedId), "Shifting Arsenal preserves borrowed cards in hand");
  assert.equal(state.hand.filter((id) => id.startsWith(`${veilFast.id}-`)).length, 2, "Shifting Arsenal redraws the same number of owned cards");
  assert.equal(state.hand.filter((id) => id.startsWith(`${veilFast.id}-`)).length + state.drawPile.length, reusableBefore, "Shifting Arsenal preserves owned reusable-card totals");
  assert.equal(state.discardPile.length, 0);
  assert.equal(state.graveyard.length, 0);
  assert.equal(event.results.find((result) => result.playerId === veilFast.id).redrawnCardCount, 2);
  const ownerView = worldEventEngine.sanitizeWorldEventGame(game, veilFast.id);
  const opponentView = worldEventEngine.sanitizeWorldEventGame(game, emberFast.id);
  const ownerResult = ownerView.worldEvent.results.find((result) => result.playerId === veilFast.id);
  const opponentResult = opponentView.worldEvent.results.find((result) => result.playerId === veilFast.id);
  assert.equal(ownerResult.redrawnCardCount, 2, "the owner receives their exact Shifting Arsenal redraw count");
  assert.equal("redrawnCardCountPrivate" in ownerResult, false, "internal privacy metadata is never synchronized");
  assert.equal("redrawnCardCount" in opponentResult, false, "another player cannot see the exact redraw count");
  assert.match(opponentResult.publicSummary, /same number of cards/i);
  assert.equal(opponentView.worldEvent.teamSummaries.some((summary) => /cards? redrawn/i.test(summary.summary)), false, "team summaries do not reveal aggregate Shifting Arsenal redraw counts");
  assert.equal("redrawnCardCount" in opponentView.worldEventHistory[0].results.find((result) => result.playerId === veilFast.id), false, "historical event results retain redraw-count privacy");
}

{
  const borrower = makePlayer("same-card-borrower", "veil", { displayName: "Borrower", speed: 9 });
  const lender = makePlayer("same-card-lender", "ember", { displayName: "Lender", speed: 8 });
  const sharedCardId = playerCard(borrower, "common-a").id;
  playerCard(lender, "common-a").id = sharedCardId;
  const game = makeGame([borrower, lender]);
  const state = game.playerStates[borrower.id];
  const ownedOther = playerCard(borrower, "common-b").id;
  state.hand = [sharedCardId, sharedCardId, ownedOther];
  state.drawPile = borrower.skillDeck.slice(2).map((card) => card.id);
  state.borrowedCards = [{ cardId: sharedCardId, ownerId: lender.id, borrowedAtTurn: 0 }];
  const borrowedMetadata = clone(state.borrowedCards);
  const event = resolveEvent(game, [borrower, lender], "shifting-arsenal");
  assert.equal(event.results.find((result) => result.playerId === borrower.id).redrawnCardCount, 2, "Shifting Arsenal redraws the owned occurrence when a borrowed copy has the same ID");
  assert.equal([...state.hand, ...state.drawPile, ...state.discardPile].filter((id) => id === sharedCardId).length, 2, "Shifting Arsenal preserves both same-ID card occurrences");
  assert.deepEqual(state.borrowedCards, borrowedMetadata, "Shifting Arsenal preserves same-ID borrowed metadata");
}

{
  const game = makeGame([veilFast, emberFast]);
  game.playerStates[veilFast.id].hp = 5;
  game.playerStates[veilFast.id].shield = 4;
  const event = resolveEvent(game, [veilFast, emberFast], "first-blood");
  assert.equal(game.playerStates[veilFast.id].hp, 4, "First Blood removes exactly 1 HP");
  assert.equal(game.playerStates[veilFast.id].shield, 4, "First Blood ignores shield without consuming it");
  assert.equal(event.results.find((result) => result.playerId === veilFast.id).hpChange, -1);
}

{
  const game = makeGame([veilFast, emberFast]);
  const shielded = game.playerStates[veilFast.id];
  shielded.shield = 3;
  shielded.pityPoints = 2;
  shielded.timedEffects = [{ kind: "shield", value: 3, expiresAfterTurn: 1 }];
  const unshielded = game.playerStates[emberFast.id];
  unshielded.pityPoints = 0;
  resolveEvent(game, [veilFast, emberFast], "unstable-wards");
  assert.equal(shielded.shield, 1);
  assert.deepEqual(shielded.timedEffects, [{ kind: "shield", value: 1, expiresAfterTurn: 1 }], "Unstable Wards keeps timed shield data consistent");
  assert.equal(shielded.pityPoints, 2, "a player who loses shield gains no pity");
  assert.equal(unshielded.pityPoints, 1, "an unshielded player gains exactly 1 pity");
}

{
  const game = makeGame(fourPlayers);
  const normal = [...game.turnOrder];
  const speeds = fourPlayers.map((player) => player.hero.speed);
  resolveEvent(game, fourPlayers, "broken-formation", { randomInt: minimumRandomInt });
  assert.notDeepEqual(game.turnOrder, normal, "Broken Formation installs a deterministically shuffled order");
  assert.deepEqual(game.roundOrder, game.turnOrder);
  assert.deepEqual(fourPlayers.map((player) => player.hero.speed), speeds, "Broken Formation does not alter Speed");
  assert.equal(game.activePlayerIndex, fourPlayers.findIndex((player) => player.id === game.turnOrder[0]));
}

{
  const game = makeGame([veilFast, emberFast]);
  game.playerStates[veilFast.id].completedPlayerTurns = 4;
  resolveEvent(game, [veilFast, emberFast], "arcane-static");
  assert.equal(game.playerStates[veilFast.id].dicePenalty, 1);
  assert.deepEqual(game.playerStates[veilFast.id].timedEffects, [{ kind: "dicePenalty", value: 1, expiresAfterTurn: 5 }], "Arcane Static uses the next completed-turn expiry contract");
}

{
  const game = makeGame([veilFast, emberFast]);
  const state = game.playerStates[veilFast.id];
  const selected = playerCard(veilFast, "common-a").id;
  const borrowed = playerCard(emberFast, "common-a").id;
  const replacement = playerCard(veilFast, "common-c").id;
  state.hand = [borrowed, selected];
  state.drawPile = [replacement];
  state.borrowedCards = [{ cardId: borrowed, ownerId: emberFast.id, borrowedAtTurn: 0 }];
  const event = resolveEvent(game, [veilFast, emberFast], "supply-rot");
  assert(state.hand.includes(borrowed), "Supply Rot never discards a borrowed card");
  assert(state.hand.includes(replacement), "Supply Rot replaces the discarded hand position");
  assert(state.discardPile.includes(selected));
  const result = event.results.find((candidate) => candidate.playerId === veilFast.id);
  assert.equal(result.discardedCardCount, 1);
  assert.deepEqual(result.privateCardIds, [selected]);
}

{
  const handOwner = makePlayer("hand-owner", "veil", { displayName: "Hand" });
  const drawOwner = makePlayer("draw-owner", "ember", { displayName: "Draw" });
  const discardOwner = makePlayer("discard-owner", "veil", { displayName: "Discard" });
  const players = [handOwner, drawOwner, discardOwner];
  const game = makeGame(players);
  const handCommon = playerCard(handOwner, "common-a").id;
  const drawCommon = playerCard(drawOwner, "common-d").id;
  const discardCommon = playerCard(discardOwner, "common-f").id;
  game.playerStates[handOwner.id].hand = [handCommon, playerCard(handOwner, "special-a").id];
  game.playerStates[handOwner.id].drawPile = [playerCard(handOwner, "common-b").id];
  game.playerStates[drawOwner.id].hand = [playerCard(drawOwner, "special-a").id];
  const borrowedCommon = playerCard(handOwner, "common-g").id;
  game.playerStates[drawOwner.id].hand.push(borrowedCommon);
  game.playerStates[drawOwner.id].borrowedCards = [{ cardId: borrowedCommon, ownerId: handOwner.id, borrowedAtTurn: 0 }];
  game.playerStates[drawOwner.id].drawPile = [drawCommon];
  game.playerStates[drawOwner.id].discardPile = [playerCard(drawOwner, "common-e").id];
  game.playerStates[discardOwner.id].hand = [playerCard(discardOwner, "special-a").id];
  game.playerStates[discardOwner.id].drawPile = [playerCard(discardOwner, "special-b").id];
  game.playerStates[discardOwner.id].discardPile = [discardCommon];
  resolveEvent(game, players, "gravewind");
  assert(game.playerStates[handOwner.id].graveyard.includes(handCommon), "Gravewind selects from hand before another zone");
  assert(game.playerStates[drawOwner.id].graveyard.includes(drawCommon), "Gravewind falls back to draw when hand has no common card");
  assert(game.playerStates[drawOwner.id].hand.includes(borrowedCommon), "Gravewind excludes borrowed common cards from hand priority");
  assert(game.playerStates[discardOwner.id].graveyard.includes(discardCommon), "Gravewind falls back to discard last");
  assert(players.every((player) => game.playerStates[player.id].graveyard.every((id) => !player.skillDeck.find((card) => card.id === id)?.unique)), "Gravewind never destroys unique cards");
}

{
  const game = makeGame(fourPlayers);
  const pity = [4, 1, 0, 2];
  fourPlayers.forEach((player, index) => { game.playerStates[player.id].pityPoints = pity[index]; game.playerStates[player.id].hp = 6; });
  resolveEvent(game, fourPlayers, "eclipse-of-fortune");
  assert.deepEqual(fourPlayers.map((player) => game.playerStates[player.id].pityPoints), [2, 0, 0, 0]);
  assert.deepEqual(fourPlayers.map((player) => game.playerStates[player.id].hp), [6, 5, 4, 6]);
}

{
  const game = makeGame([veilFast, emberFast]);
  const state = game.playerStates[veilFast.id];
  state.hp = 6;
  state.shield = 5;
  state.timedEffects = [{ kind: "shield", value: 5, expiresAfterTurn: 1 }, { kind: "attackBuff", value: 2, expiresAfterTurn: 1 }];
  state.attackBuff = 2;
  resolveEvent(game, [veilFast, emberFast], "shieldquake");
  assert.equal(state.hp, 5);
  assert.equal(state.shield, 0);
  assert.equal(state.attackBuff, 2, "Shieldquake does not clear unrelated effects");
  assert.deepEqual(state.timedEffects, [{ kind: "attackBuff", value: 2, expiresAfterTurn: 1 }]);
}

{
  const game = makeGame([veilFast, emberFast]);
  const state = game.playerStates[veilFast.id];
  Object.assign(state, { shield: 4, attackBuff: 3, diceBuff: 2, dicePenalty: 5, completedPlayerTurns: 7 });
  state.timedEffects = [
    { kind: "shield", value: 4, expiresAfterTurn: 8 },
    { kind: "attackBuff", value: 3, expiresAfterTurn: 8 },
    { kind: "diceBuff", value: 2, expiresAfterTurn: 8 },
    { kind: "dicePenalty", value: 5, expiresAfterTurn: 8 }
  ];
  resolveEvent(game, [veilFast, emberFast], "severed-oaths");
  assert.deepEqual([state.shield, state.attackBuff, state.diceBuff, state.dicePenalty], [0, 0, 0, 2]);
  assert.deepEqual(state.timedEffects, [{ kind: "dicePenalty", value: 2, expiresAfterTurn: 8 }]);
}

{
  const tieFast = makePlayer("tie-fast", "veil", { displayName: "Earlier", speed: 9, joinedAt: 1 });
  const tieLate = makePlayer("tie-late", "veil", { displayName: "Later", speed: 9, joinedAt: 2 });
  const lone = makePlayer("lone", "ember", { displayName: "Lone", speed: 7 });
  const defeated = makePlayer("defeated", "ember", { displayName: "Down", speed: 10 });
  const players = [tieLate, lone, defeated, tieFast];
  const game = makeGame(players);
  game.playerStates[defeated.id].hp = 0;
  resolveEvent(game, players, "time-fracture");
  assert.equal(game.playerStates[tieFast.id].skipTurns, 1, "Time Fracture chooses the earlier join for a Speed tie");
  assert.equal(game.playerStates[tieLate.id].skipTurns, 0);
  assert.equal(game.playerStates[lone.id].skipTurns, 0, "a lone survivor is not skipped");
  assert.equal(game.playerStates[lone.id].dicePenalty, 3);
  assert.deepEqual(game.playerStates[lone.id].timedEffects, [{ kind: "dicePenalty", value: 3, expiresAfterTurn: 1 }]);
}

{
  const game = makeGame([veilFast, emberFast]);
  Object.assign(game.playerStates[veilFast.id], { hp: 7, shield: 5, pityPoints: 1 });
  resolveEvent(game, [veilFast, emberFast], "crimson-debt");
  assert.deepEqual([game.playerStates[veilFast.id].hp, game.playerStates[veilFast.id].shield, game.playerStates[veilFast.id].pityPoints], [5, 5, 0]);
}

{
  const lowMax = makePlayer("low-max", "veil", { displayName: "Low", maxHp: 6 });
  const highMax = makePlayer("high-max", "ember", { displayName: "High", maxHp: 14 });
  const game = makeGame([lowMax, highMax]);
  game.playerStates[lowMax.id].shield = 3;
  game.playerStates[highMax.id].shield = 4;
  resolveEvent(game, [lowMax, highMax], "final-collapse");
  assert.equal(game.playerStates[lowMax.id].hp, 4, "Final Collapse damage has a minimum of 2");
  assert.equal(game.playerStates[highMax.id].hp, 10, "Final Collapse rounds 25 percent upward");
  assert.equal(game.playerStates[lowMax.id].shield, 0);
  assert.equal(game.playerStates[highMax.id].shield, 0);
}

{
  const game = makeGame([veilFast, emberFast]);
  const borrowed = playerCard(emberFast, "common-g").id;
  game.playerStates[veilFast.id].hand.push(borrowed);
  game.playerStates[veilFast.id].borrowedCards = [{ cardId: borrowed, ownerId: emberFast.id, borrowedAtTurn: 0 }];
  const protectedState = game.playerStates[emberFast.id];
  protectedState.hand = emberFast.skillDeck.slice(0, 2).map((card) => card.id);
  protectedState.drawPile = emberFast.skillDeck.slice(2, 4).map((card) => card.id);
  protectedState.discardPile = [];
  const event = resolveEvent(game, [veilFast, emberFast], "the-last-cards", { randomInt: minimumRandomInt });
  const destroyed = game.playerStates[veilFast.id].graveyard;
  assert.equal(destroyed.length, 2, "The Last Cards destroys at most two cards when safely possible");
  assert(destroyed.every((id) => playerCard(veilFast, id.slice(`${veilFast.id}-`.length))?.unique === false), "The Last Cards destroys only common cards");
  const reusable = [game.playerStates[veilFast.id].hand, game.playerStates[veilFast.id].drawPile, game.playerStates[veilFast.id].discardPile]
    .flat()
    .filter((id) => id.startsWith(`${veilFast.id}-`)).length;
  assert.equal(reusable, 8);
  assert(game.playerStates[veilFast.id].hand.includes(borrowed), "The Last Cards never destroys a borrowed common card");
  assert.equal(protectedState.graveyard.length, 0, "The Last Cards preserves a four-card reusable minimum");
  assert.equal(protectedState.hand.length + protectedState.drawPile.length + protectedState.discardPile.length, 4);
  assert.equal(event.results.find((result) => result.playerId === veilFast.id).destroyedCardCount, 2);
}

{
  const game = makeGame([veilFast, emberFast]);
  const state = game.playerStates[veilFast.id];
  Object.assign(state, { hp: 11, maxHp: 11, shield: 6, attackBuff: 1, completedPlayerTurns: 3 });
  state.timedEffects = [{ kind: "shield", value: 6, expiresAfterTurn: 4 }, { kind: "attackBuff", value: 1, expiresAfterTurn: 4 }];
  game.playerStates[emberFast.id].hp = 2;
  resolveEvent(game, [veilFast, emberFast], "sudden-death");
  assert.equal(state.hp, 6);
  assert.equal(state.shield, 0);
  assert.equal(state.attackBuff, 3);
  assert.equal(game.playerStates[emberFast.id].hp, 2, "Sudden Death does not raise or further reduce HP already below the cap");
  assert.deepEqual(state.timedEffects.filter((effect) => effect.kind === "attackBuff"), [
    { kind: "attackBuff", value: 1, expiresAfterTurn: 4 },
    { kind: "attackBuff", value: 2, expiresAfterTurn: 4 }
  ]);
}

{
  const sable = makePlayer("sable", "veil", { displayName: "Sable", heroName: "Sable Fen", speed: 7, maxHp: 8 });
  const enemy = makePlayer("doomed", "ember", { displayName: "Doomed", speed: 6, maxHp: 8 });
  const game = makeGame([sable, enemy]);
  game.playerStates[sable.id].hp = 1;
  game.playerStates[enemy.id].hp = 1;
  game.turnOrder = [enemy.id, sable.id, "missing-player"];
  game.roundOrder = [...game.turnOrder];
  game.actedThisRound = [enemy.id, "missing-player"];
  const event = resolveEvent(game, [sable, enemy], "first-blood", { lastTeam: "ember", eventId: "lethal-world" });
  assert.equal(game.playerStates[sable.id].hp, 4, "Second Sight revives Sable once with half maximum HP after simultaneous event damage");
  assert.equal(game.playerStates[sable.id].passiveReviveUsed, true);
  assert.equal(game.playerStates[enemy.id].hp, 0);
  assert.deepEqual(game.turnOrder, [sable.id], "a lethal World Event rebuilds order with the revived living player only");
  assert.deepEqual(game.roundOrder, [sable.id]);
  assert.deepEqual(game.actedThisRound, [], "invalid and defeated acted-player IDs are removed");
  assert.equal(game.ended, true);
  assert.equal(game.winnerTeam, "veil", "a lethal World Event ends the battle immediately");
  assert.deepEqual(game.outcome.lifeEvents.map((lifeEvent) => lifeEvent.kind), ["defeat", "defeat", "revive"], "World Event defeat notices precede the passive-revival notice");
  assert(game.outcome.lifeEvents.every((lifeEvent) => lifeEvent.source === "world-event"));
  assert(game.outcome.lifeEvents.every((lifeEvent) => lifeEvent.id.startsWith(event.id)), "World Event life-event IDs are causally tied to the stable event ID");
  assert.equal(event.results.find((result) => result.playerId === sable.id).hpChange, 3, "structured HP deltas match the final post-revival state");
}

{
  const veil = makePlayer("sim-veil", "veil", { displayName: "Veil" });
  const ember = makePlayer("sim-ember", "ember", { displayName: "Ember" });
  const game = makeGame([veil, ember]);
  game.playerStates[veil.id].hp = 1;
  game.playerStates[ember.id].hp = 1;
  resolveEvent(game, [veil, ember], "first-blood", { lastTeam: "ember" });
  assert.equal(game.ended, true);
  assert.equal(game.winnerTeam, "ember", "simultaneous elimination preserves the existing last-team tie-break");
}

{
  const borrower = makePlayer("tribute-same-card-borrower", "veil", { displayName: "Tribute Borrower", speed: 9 });
  const lender = makePlayer("tribute-same-card-lender", "ember", { displayName: "Tribute Lender", speed: 8 });
  const sharedCardId = playerCard(borrower, "common-a").id;
  playerCard(lender, "common-a").id = sharedCardId;
  const players = [borrower, lender];
  const game = makeGame(players, { completedPhases: 2, roundNumber: 3 });
  const state = game.playerStates[borrower.id];
  const ownedOther = playerCard(borrower, "common-b").id;
  state.hand = [sharedCardId, sharedCardId, ownedOther];
  state.drawPile = [playerCard(borrower, "common-c").id, playerCard(borrower, "common-d").id];
  state.borrowedCards = [{ cardId: sharedCardId, ownerId: lender.id, borrowedAtTurn: 2 }];
  const borrowedMetadata = clone(state.borrowedCards);

  worldEventEngine.triggerWorldEventAfterPhase(game, players, 1, 2, eventOptions({ eventId: "same-card-tribute" }));
  assert.deepEqual(worldEventEngine.getEligibleTributeCardIds(borrower, state), [sharedCardId, ownedOther, ...state.drawPile], "Tribute reserves only the borrowed same-ID occurrence while including owned common cards from draw");
  const submission = worldEventEngine.submitWorldEventChoice(game, players, borrower.id, "same-card-tribute", [sharedCardId, ownedOther], eventOptions());
  assert.equal(submission.ok, true);
  assert.equal(state.hand.filter((id) => id === sharedCardId).length, 1, "Tribute removes exactly one owned same-ID occurrence from hand");
  assert.equal(state.graveyard.filter((id) => id === sharedCardId).length, 1, "the removed owned occurrence enters the graveyard once");
  assert.deepEqual(state.borrowedCards, borrowedMetadata, "Tribute preserves the borrowed same-ID occurrence metadata");
  assert.equal(game.pendingWorldEvent.results.find((result) => result.playerId === borrower.id).destroyedCardCount, 2);
}

{
  const tributeAlly = makePlayer("tribute-ally", "veil", { displayName: "Tribute Ally", speed: 8 });
  const tributeEnemy = makePlayer("tribute-enemy", "ember", { displayName: "Tribute Enemy", speed: 7 });
  const defeatedSpectator = makePlayer("tribute-down", "veil", { displayName: "Defeated" });
  const players = [tributeAlly, tributeEnemy, defeatedSpectator];
  const game = makeGame(players, { completedPhases: 2, roundNumber: 3, completedTurns: 4 });
  game.playerStates[defeatedSpectator.id].hp = 0;
  const allyState = game.playerStates[tributeAlly.id];
  const enemyState = game.playerStates[tributeEnemy.id];
  const borrowedId = playerCard(tributeEnemy, "common-a").id;
  const allyCommon = playerCard(tributeAlly, "common-a").id;
  const allyUnique = playerCard(tributeAlly, "special-a").id;
  const allyDrawCommon = playerCard(tributeAlly, "common-b").id;
  const allyReplacementCommon = playerCard(tributeAlly, "common-c").id;
  const allyDiscardCommon = playerCard(tributeAlly, "common-d").id;
  allyState.hand = [allyCommon, borrowedId, allyUnique];
  allyState.drawPile = [allyDrawCommon, allyReplacementCommon];
  allyState.discardPile = [allyDiscardCommon];
  allyState.borrowedCards = [{ cardId: borrowedId, ownerId: tributeEnemy.id, borrowedAtTurn: 3 }];
  const enemyUnique = playerCard(tributeEnemy, "special-a").id;
  const enemyDrawCommon = playerCard(tributeEnemy, "common-b").id;
  const enemyDiscardCommon = playerCard(tributeEnemy, "common-c").id;
  enemyState.hand = [enemyUnique];
  enemyState.drawPile = [enemyDrawCommon];
  enemyState.discardPile = [enemyDiscardCommon];
  const allyTimedBefore = clone(allyState.timedEffects);
  const allyPityBefore = allyState.pityPoints;
  const turnsBefore = game.completedTurns;
  const phasesBefore = game.completedPhases;

  const triggered = worldEventEngine.triggerWorldEventAfterPhase(game, players, 1, 2, eventOptions({ now: 20_000, eventId: "tribute-event" }));
  assert.equal(triggered.triggered, true);
  assert.equal(triggered.status, "pending");
  assert.equal(game.pendingWorldEvent.eventKey, "shattered-tribute");
  assert.equal(game.pendingWorldEvent.phase, 3);
  assert.equal(game.pendingWorldEvent.id, "tribute-event");
  assert.deepEqual(game.pendingWorldEvent.requiredPlayerIds, [tributeAlly.id, tributeEnemy.id], "only living players must submit tribute choices");
  assert.deepEqual(game.pendingWorldEvent.submittedPlayerIds, []);
  assert.equal(game.pendingWorldEvent.deadlineAt, 80_000);
  assert.equal(game.turnDeadline, 0, "normal turn timing pauses during Shattered Tribute");
  assert.equal(worldEventEngine.isWorldEventBlocking(game), true);
  assert.equal(worldEventEngine.getActiveBattleDeadline(game), 80_000);
  assert.deepEqual(worldEventEngine.getEligibleTributeCardIds(tributeAlly, allyState), [allyCommon, allyDrawCommon, allyReplacementCommon, allyDiscardCommon], "Tribute includes owned common cards from hand, draw, and discard while excluding borrowed and special cards");

  const sanitizedPending = worldEventEngine.sanitizeWorldEventGame(game, tributeAlly.id);
  assert.equal("results" in sanitizedPending.pendingWorldEvent, false, "public pending state contains no private partial results");
  assert.equal(JSON.stringify(sanitizedPending.pendingWorldEvent).includes(allyCommon), false, "pending state exposes no selected or selectable card IDs");

  const invalidBaseline = clone(allyState);
  const badEvent = worldEventEngine.submitWorldEventChoice(game, players, tributeAlly.id, "wrong-event", [allyCommon, allyUnique], eventOptions());
  assert.equal(badEvent.ok, false);
  assert.match(badEvent.error, /no longer current/i);
  assert.deepEqual(allyState, invalidBaseline, "an incorrect event ID cannot partially mutate card zones");
  const duplicateIds = worldEventEngine.submitWorldEventChoice(game, players, tributeAlly.id, "tribute-event", [allyCommon, allyCommon], eventOptions());
  assert.equal(duplicateIds.ok, false);
  assert.match(duplicateIds.error, /unique/i);
  const wrongCount = worldEventEngine.submitWorldEventChoice(game, players, tributeAlly.id, "tribute-event", [allyCommon], eventOptions());
  assert.equal(wrongCount.ok, false);
  assert.match(wrongCount.error, /exactly 2/i);
  const borrowedChoice = worldEventEngine.submitWorldEventChoice(game, players, tributeAlly.id, "tribute-event", [allyCommon, borrowedId], eventOptions());
  assert.equal(borrowedChoice.ok, false);
  assert.match(borrowedChoice.error, /owned, non-borrowed/i);
  const specialChoice = worldEventEngine.submitWorldEventChoice(game, players, tributeAlly.id, "tribute-event", [allyCommon, allyUnique], eventOptions());
  assert.equal(specialChoice.ok, false);
  assert.match(specialChoice.error, /common card/i);
  const otherPlayersCard = worldEventEngine.submitWorldEventChoice(game, players, tributeAlly.id, "tribute-event", [allyCommon, enemyDrawCommon], eventOptions());
  assert.equal(otherPlayersCard.ok, false);
  const crossSession = worldEventEngine.submitWorldEventChoice(game, players, tributeEnemy.id, "tribute-event", [allyCommon], eventOptions());
  assert.equal(crossSession.ok, false, "one session cannot submit another player's cards");

  const firstSubmission = worldEventEngine.submitWorldEventChoice(game, players, tributeAlly.id, "tribute-event", [allyCommon, allyDiscardCommon], eventOptions({ now: 30_000, randomInt: minimumRandomInt }));
  assert.deepEqual(firstSubmission, { ok: true, error: "", finalized: false, event: null });
  assert.deepEqual(game.pendingWorldEvent.submittedPlayerIds, [tributeAlly.id]);
  assert(allyState.graveyard.includes(allyCommon), "a common tribute card enters the graveyard");
  assert(allyState.graveyard.includes(allyDiscardCommon), "a selected discard-pile common card enters the graveyard");
  assert(!allyState.graveyard.includes(allyUnique), "special cards remain outside the Tribute eligibility set");
  assert.equal(allyState.hand.length, 3, "only the selected hand card draws a replacement into its vacated position");
  assert.equal(allyState.drawPile.length, 1, "the discard-pile selection does not draw an extra card");
  assert.equal(allyState.discardPile.length, 0, "the selected discard-pile card leaves that zone");
  assert(allyState.hand.includes(borrowedId), "tribute replacement preserves the borrowed card");
  assert.equal(game.completedTurns, turnsBefore);
  assert.equal(game.completedPhases, phasesBefore);
  assert.equal(allyState.pityPoints, allyPityBefore);
  assert.deepEqual(allyState.timedEffects, allyTimedBefore, "Shattered Tribute does not expire timed effects");

  const graveyardAfterFirstSubmit = [...allyState.graveyard];
  const duplicateSubmit = worldEventEngine.submitWorldEventChoice(game, players, tributeAlly.id, "tribute-event", [allyCommon, allyDiscardCommon], eventOptions());
  assert.equal(duplicateSubmit.ok, false);
  assert.match(duplicateSubmit.error, /already submitted/i);
  assert.deepEqual(allyState.graveyard, graveyardAfterFirstSubmit, "duplicate submission cannot destroy cards twice");

  const progressForEnemy = worldEventEngine.sanitizeWorldEventGame(game, tributeEnemy.id);
  assert.deepEqual(progressForEnemy.pendingWorldEvent.submittedPlayerIds, [tributeAlly.id], "submission progress survives personalized reconnect state");
  const finalSubmission = worldEventEngine.submitWorldEventChoice(game, players, tributeEnemy.id, "tribute-event", [enemyDrawCommon, enemyDiscardCommon], eventOptions({ now: 35_000, randomInt: minimumRandomInt }));
  assert.equal(finalSubmission.ok, true);
  assert.equal(finalSubmission.finalized, true);
  assert.equal(game.pendingWorldEvent, null);
  assert.equal(game.worldEvent.id, "tribute-event");
  assert.equal(game.worldEvent.phase, 3);
  assert.equal(game.worldEvent.interactive, true);
  assert.equal(game.turnStartedAt, 35_000);
  assert.equal(game.turnDeadline, 95_000, "normal 60-second timing resumes after final submission");
  assert.equal(game.completedTurns, turnsBefore);
  assert.equal(game.completedPhases, phasesBefore);
  assert(enemyState.graveyard.includes(enemyDrawCommon));
  assert(enemyState.graveyard.includes(enemyDiscardCommon));
  assert.deepEqual(enemyState.hand, [enemyUnique], "choosing only draw/discard cards does not add replacements to hand");
  assert.equal(game.worldEvent.results.find((result) => result.playerId === tributeEnemy.id).redrawnCardCount, 0);
  assert.equal(game.history.filter((entry) => entry.kind === "world").length, 1);
  assert.equal(game.history[0].phase, 3);
  assert.equal(game.history[0].message.includes(playerCard(tributeAlly, "common-a").name), false, "public history never includes private tribute card names");

  const allyView = worldEventEngine.sanitizeWorldEventGame(game, tributeAlly.id);
  const enemyView = worldEventEngine.sanitizeWorldEventGame(game, tributeEnemy.id);
  const teammateView = worldEventEngine.sanitizeWorldEventGame(game, defeatedSpectator.id);
  const allyOwnResult = allyView.worldEvent.results.find((result) => result.playerId === tributeAlly.id);
  const allySeenByEnemy = enemyView.worldEvent.results.find((result) => result.playerId === tributeAlly.id);
  const enemyOwnResult = enemyView.worldEvent.results.find((result) => result.playerId === tributeEnemy.id);
  assert.deepEqual(allyOwnResult.privateCardIds, [allyCommon, allyDiscardCommon]);
  assert.match(allyOwnResult.privateSummary, /Common A.*Common D/);
  assert.equal("privateCardIds" in allySeenByEnemy, false);
  assert.equal("privateCardNames" in allySeenByEnemy, false);
  assert.equal("privateSummary" in allySeenByEnemy, false);
  const allySeenByTeammate = teammateView.worldEvent.results.find((result) => result.playerId === tributeAlly.id);
  assert.equal("privateCardIds" in allySeenByTeammate, false, "teammates do not receive another player's private card IDs");
  assert.equal("privateCardNames" in allySeenByTeammate, false);
  assert.deepEqual(enemyOwnResult.privateCardIds, [enemyDrawCommon, enemyDiscardCommon]);
  assert.equal("privateCardIds" in enemyView.worldEventHistory[0].results.find((result) => result.playerId === tributeAlly.id), false, "event history is sanitized independently from the current event");
  assert.equal(JSON.stringify(enemyView.history).includes(playerCard(tributeAlly, "common-a").name), false);
  assert.equal(worldEventEngine.isWorldEventBlocking(game), false);
  assert.equal(worldEventEngine.getActiveBattleDeadline(game), 95_000);
}

{
  const players = [veilFast, emberFast];
  const game = makeGame(players, { completedPhases: 2 });
  worldEventEngine.triggerWorldEventAfterPhase(game, players, 1, 2, eventOptions({ now: 100_000, eventId: "timeout-tribute" }));
  const beforeDeadline = worldEventEngine.resolvePendingWorldEventTimeout(game, players, eventOptions({ now: 159_999 }));
  assert.deepEqual(beforeDeadline, { resolved: false, event: null });
  assert(game.pendingWorldEvent);
  const turns = game.completedTurns;
  const phases = game.completedPhases;
  const timed = clone(game.playerStates[veilFast.id].timedEffects);
  const resolved = worldEventEngine.resolvePendingWorldEventTimeout(game, players, eventOptions({ now: 160_000, randomInt: sequenceRandomInt(0, 0, 0, 0) }));
  assert.equal(resolved.resolved, true);
  assert.equal(game.pendingWorldEvent, null);
  assert.deepEqual(game.worldEvent.results.map((result) => result.autoResolved), [true, true]);
  assert.deepEqual(game.worldEvent.results.map((result) => result.playerId).sort(), [emberFast.id, veilFast.id].sort());
  assert.deepEqual(game.worldEvent.results.map((result) => result.destroyedCardCount), [2, 2]);
  assert.deepEqual(game.worldEvent.results.map((result) => result.redrawnCardCount), [2, 2]);
  assert.equal(game.completedTurns, turns);
  assert.equal(game.completedPhases, phases);
  assert.deepEqual(game.playerStates[veilFast.id].timedEffects, timed);
  assert.equal(game.turnDeadline, 220_000);
}

{
  const cycleOwner = makePlayer("cycle-owner", "veil", { displayName: "Cycle" });
  const opponent = makePlayer("cycle-opponent", "ember", { displayName: "Opponent" });
  const players = [cycleOwner, opponent];
  const game = makeGame(players, { completedPhases: 2 });
  const state = game.playerStates[cycleOwner.id];
  state.hand = cycleOwner.skillDeck.slice(0, 2).map((card) => card.id);
  state.drawPile = [];
  state.discardPile = cycleOwner.skillDeck.slice(2, 8).map((card) => card.id);
  worldEventEngine.triggerWorldEventAfterPhase(game, players, 1, 2, eventOptions({ now: 170_000, eventId: "cycle-tribute" }));
  const submitted = worldEventEngine.submitWorldEventChoice(game, players, cycleOwner.id, "cycle-tribute", [...state.hand], eventOptions({ now: 171_000, randomInt: minimumRandomInt }));
  assert.equal(submitted.ok, true);
  assert.equal(state.hand.length, 2, "Tribute replaces each sacrificed hand card without dealing a four-card refill");
  assert.equal(state.drawPile.length, 4, "the remaining recycled discard cards stay in draw after two replacements");
  assert.equal(state.discardPile.length, 0);
  assert.equal(game.pendingWorldEvent.results.find((result) => result.playerId === cycleOwner.id).redrawnCardCount, 2);
}

{
  const players = [veilFast, emberFast];
  const game = makeGame(players, { completedPhases: 6 });
  const result = worldEventEngine.triggerWorldEventAfterPhase(game, players, 5, 6, eventOptions({ randomInt: (_minimum, maximum) => maximum }));
  assert.equal(result.triggered, true);
  assert.equal(game.worldEvent.eventKey, "unstable-wards", "injected maximum randomness can select the final event in a random phase pool");
}

{
  const players = [veilFast, emberFast];
  const game = makeGame(players, { completedPhases: 6 });
  worldEventEngine.initializeNewBattleWorldEvents(game, { randomInt: minimumRandomInt });
  const result = worldEventEngine.triggerWorldEventAfterPhase(game, players, 5, 6, eventOptions({ randomInt: (_minimum, maximum) => maximum }));
  assert.equal(result.triggered, true);
  assert.equal(game.worldEvent.eventKey, "shifting-arsenal", "the event that resolves must match the one shown in the battle's phase tooltip plan");
}

{
  const game = makeGame([veilFast, emberFast]);
  game.worldEventHistory = Array.from({ length: 7 }, (_, index) => ({
    id: `legacy-${index}`,
    turn: index + 1,
    level: 1,
    title: "Legacy World Event",
    description: "Legacy."
  }));
  game.worldEvent = game.worldEventHistory.at(-1);
  worldEventEngine.normalizeWorldEventState(game);
  assert.equal(game.worldEventHistory.length, 6, "World Event history is capped at six resolved entries");
  assert.deepEqual(game.worldEventHistory.map((event) => event.id), ["legacy-1", "legacy-2", "legacy-3", "legacy-4", "legacy-5", "legacy-6"]);
}

{
  const players = [veilFast, emberFast];
  const game = makeGame(players, { completedPhases: 2 });
  worldEventEngine.triggerWorldEventAfterPhase(game, players, 1, 2, eventOptions({ now: 200_000, eventId: "remove-tribute" }));
  const choice = game.playerStates[veilFast.id].hand.slice(0, 2);
  worldEventEngine.submitWorldEventChoice(game, players, veilFast.id, "remove-tribute", choice, eventOptions({ now: 201_000 }));
  const remainingPlayers = players.filter((player) => player.id !== emberFast.id);
  delete game.playerStates[emberFast.id];
  const removal = worldEventEngine.removeWorldEventParticipant(game, remainingPlayers, emberFast.id, eventOptions({ now: 202_000 }));
  assert.equal(removal.changed, true);
  assert.equal(removal.finalized, true, "removing the final waiting participant cannot deadlock the event");
  assert.equal(game.pendingWorldEvent, null);
  assert.deepEqual(game.worldEvent.results.map((result) => result.playerId), [veilFast.id]);
}

{
  const players = [veilFast, emberFast];
  const game = makeGame(players);
  const noEventOne = worldEventEngine.triggerWorldEventAfterPhase(game, players, 0, 1, eventOptions());
  assert.equal(noEventOne.triggered, false, "completing phase 1 does not trigger an event");
  assert.equal(noEventOne.reason, "unscheduled-phase");
  const noEventThree = worldEventEngine.triggerWorldEventAfterPhase(game, players, 2, 3, eventOptions());
  assert.equal(noEventThree.triggered, false, "completing phase 3 does not trigger another event");
  const noEventFive = worldEventEngine.triggerWorldEventAfterPhase(game, players, 4, 5, eventOptions());
  assert.equal(noEventFive.triggered, false, "completing phase 5 remains separate from World Events");
  const noJump = worldEventEngine.triggerWorldEventAfterPhase(game, players, 5, 7, eventOptions());
  assert.equal(noJump.reason, "no-single-phase-transition", "impossible phase jumps cannot trigger an event");
  const noEventAfterTwentySeven = worldEventEngine.triggerWorldEventAfterPhase(game, players, 26, 27, eventOptions());
  assert.equal(noEventAfterTwentySeven.triggered, false, "completing phase 27 does not trigger a later event");
}

{
  const triggerCases = [
    { completed: 6, phase: 7, key: "shifting-arsenal" },
    { completed: 11, phase: 12, key: "broken-formation" },
    { completed: 16, phase: 17, key: "gravewind" },
    { completed: 21, phase: 22, key: "severed-oaths" },
    { completed: 26, phase: 27, key: "final-collapse" }
  ];
  for (const { completed, phase, key } of triggerCases) {
    const players = [veilFast, emberFast];
    const game = makeGame(players, { completedPhases: completed, roundNumber: completed + 1 });
    const result = worldEventEngine.triggerWorldEventAfterPhase(game, players, completed - 1, completed, eventOptions({ now: phase * 1_000, randomInt: minimumRandomInt }));
    assert.equal(result.triggered, true, `completing phase ${completed} triggers phase ${phase}`);
    assert.equal(result.status, "resolved");
    assert.equal(game.worldEvent.phase, phase);
    assert.equal(game.worldEvent.eventKey, key, "injected minimum randomness selects the first event in the phase pool");
    assert.equal(game.worldEventHistory.length, 1);
    const repeat = worldEventEngine.triggerWorldEventAfterPhase(game, players, completed - 1, completed, eventOptions({ now: phase * 1_000 + 1, randomInt: () => 2 }));
    assert.equal(repeat.triggered, false);
    assert.equal(repeat.reason, "already-resolved", "reprocessing does not reroll or duplicate an event");
    assert.equal(game.worldEventHistory.length, 1);
    assert.equal(game.worldEvent.eventKey, key);
  }
}

{
  const players = [veilFast, emberFast];
  const game = makeGame(players, { completedPhases: 2 });
  const first = worldEventEngine.triggerWorldEventAfterPhase(game, players, 1, 2, eventOptions({ now: 300_000, eventId: "stable-pending" }));
  const repeat = worldEventEngine.triggerWorldEventAfterPhase(game, players, 1, 2, eventOptions({ now: 300_001, eventId: "rerolled" }));
  assert.equal(first.status, "pending");
  assert.equal(repeat.triggered, false);
  assert.equal(repeat.reason, "event-pending");
  assert.equal(game.pendingWorldEvent.id, "stable-pending", "reprocessing preserves the selected pending event identity");
}

console.log("World Event test passed: catalog, deterministic scheduling, all immediate mutations, Shattered Tribute choices/timeouts/privacy, life events, order, victory, and idempotency.");
