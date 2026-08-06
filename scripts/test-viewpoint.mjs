import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  formatHistoryPresentation,
  formatLifeEventPresentation,
  formatOutcomePresentation,
  formatViewpointText,
  getStatusPresentations,
  sanitizeCommunicationGame,
  viewerRelation
} from "../shared/viewpoint.mjs";

const gameAppSource = readFileSync(new URL("../ui/GameApp.tsx", import.meta.url), "utf8");
const lobbySource = readFileSync(new URL("../ui/components/Lobby.tsx", import.meta.url), "utf8");
assert.match(gameAppSource, /if \(!players\.length\) return setSelectedPlayerId\(null\);/, "an empty lobby clears the selected player");
assert.doesNotMatch(gameAppSource, /!localPlayer\) return setSelectedPlayerId\(null\)/, "spectators keep a valid public player selection");
assert.match(lobbySource, /const selected = players\.find\(\(player\) => player\.id === selectedPlayerId\) \?\? localPlayer;/, "the lobby can review a selected player's public character without requiring a local seat");

function player(id, displayName, team) {
  return {
    id,
    displayName,
    ready: true,
    joinedAt: 1,
    hero: { id: `hero-${id}`, name: `${displayName} Hero`, team },
    skillDeck: []
  };
}

const rowan = player("rowan", "Rowan", "veil");
const elias = player("elias", "Elias", "veil");
const mira = player("mira", "Mira", "ember");
const nyx = player("nyx", "Nyx", "ember");
rowan.skillDeck = [
  { id: "rowan-discard", name: "Quiet Step", effect: "none" },
  { id: "rowan-steal", name: "Borrowed Fate", effect: "support", supportType: "steal-card" }
];
const players = [rowan, elias, mira, nyx];

assert.equal(viewerRelation(rowan, rowan), "self");
assert.equal(viewerRelation(rowan, elias), "ally");
assert.equal(viewerRelation(rowan, mira), "enemy");
assert.equal(viewerRelation(rowan, null), "neutral");

const sentence = "Rowan granted Mira +2 on her next roll.";
assert.equal(
  formatViewpointText(sentence, players, rowan.id, { involvedPlayerIds: [rowan.id, mira.id], emphasizedPlayerIds: [rowan.id] }),
  "You granted Mira +2 on her next roll.",
  "the acting viewer reads their own name as You"
);
assert.equal(
  formatViewpointText(sentence, players, mira.id, { involvedPlayerIds: [rowan.id, mira.id], emphasizedPlayerIds: [rowan.id], pronounPlayerId: mira.id }),
  "Rowan granted you +2 on your next roll.",
  "the affected viewer reads their own name as you"
);
assert.equal(
  formatViewpointText(sentence, players, elias.id, { involvedPlayerIds: [rowan.id, mira.id], emphasizedPlayerIds: [rowan.id] }),
  "Your ally Rowan granted Mira +2 on her next roll.",
  "an uninvolved teammate sees the acting player as an ally"
);
assert.equal(
  formatViewpointText(sentence, players, nyx.id, { involvedPlayerIds: [rowan.id, mira.id], emphasizedPlayerIds: [rowan.id] }),
  "Enemy Rowan granted Mira +2 on her next roll.",
  "an uninvolved opponent sees the acting player as an enemy"
);
assert.equal(formatViewpointText(sentence, players), sentence, "a neutral viewer sees player names without relationship prefixes");
assert.equal(
  formatViewpointText("You discarded your card.", players, rowan.id, { useActualNames: true }),
  "Rowan discarded Rowan's card.",
  "panel copy replaces second-person references with the stored display name"
);

const numericOne = player("numeric-one", "1", "veil");
const numericTwo = player("numeric-two", "2", "ember");
assert.equal(
  formatViewpointText(
    "2 used Heavy Blow (rolled d20 against target 11) — 1 lost 4 HP.",
    [numericOne, numericTwo],
    numericTwo.id,
    { involvedPlayerIds: [numericOne.id, numericTwo.id] }
  ),
  "You used Heavy Blow (rolled d20 against target 11) — 1 lost 4 HP.",
  "numeric player names are replaced only as standalone references and cannot corrupt d20 or larger numbers"
);

const voluntaryPass = {
  id: "pass-1",
  kind: "skip",
  success: true,
  total: 0,
  target: 0,
  label: "Rowan skipped",
  actorId: rowan.id,
  actorName: rowan.displayName
};
assert.deepEqual(
  formatOutcomePresentation(voluntaryPass, players, rowan.id),
  {
    category: "ROWAN'S ACTION",
    title: "Rowan passed",
    detail: "No card played; cards preserved.",
    involvedPlayerIds: [rowan.id]
  },
  "a voluntary pass is not described as a forced skip"
);
const timeoutPresentation = formatOutcomePresentation({ ...voluntaryPass, kind: "timeout" }, players, rowan.id);
assert.equal(timeoutPresentation.title, "Rowan ran out of time");
assert.equal(timeoutPresentation.detail, "", "the timeout title must stand alone without a repeated expiry explanation");
assert.equal(formatOutcomePresentation({ ...voluntaryPass, kind: "forced-skip" }, players, rowan.id).title, "Rowan's turn was skipped");
assert.equal(formatOutcomePresentation(voluntaryPass, players, elias.id).category, "ACTION OUTCOME");
assert.equal(formatOutcomePresentation(voluntaryPass, players, elias.id).title, "Rowan passed");
assert.equal(formatOutcomePresentation(voluntaryPass, players, mira.id).title, "Rowan passed");

const hit = {
  id: "hit-1",
  kind: "card",
  success: true,
  total: 16,
  target: 12,
  label: "Rowan used Slash",
  detail: "Rowan dealt 3 damage to Mira.",
  actorId: rowan.id,
  actorName: rowan.displayName,
  targetIds: [mira.id],
  targetName: mira.displayName,
  effect: "damage",
  amount: 3,
  cardName: "Slash"
};
assert.equal(formatOutcomePresentation(hit, players, mira.id).category, "ACTION OUTCOME");
assert.equal(formatOutcomePresentation(hit, players, mira.id).detail, "Rowan dealt 3 damage to Mira.");
assert.equal(
  formatOutcomePresentation({ ...hit, effect: "support", supportType: "enemy-dice", detail: "Rowan gave Mira −2 to their next d20 result." }, players, mira.id).detail,
  "Rowan gave Mira −2 to their next d20 result.",
  "panel outcomes preserve real target names instead of viewer-relative wording"
);

const historyEntry = {
  id: "history-1",
  turn: 3,
  phase: 2,
  kind: "damage",
  actorName: rowan.displayName,
  actorTeam: "veil",
  targetName: mira.displayName,
  cardName: "Slash",
  message: "Rowan dealt 3 damage to Mira with Slash.",
  success: true,
  amount: 3,
  createdAt: 1
};
const targetHistory = formatHistoryPresentation(historyEntry, players);
assert.equal(targetHistory.type, "Attack");
assert.equal(targetHistory.actor, "Rowan");
assert.equal(targetHistory.target, "Mira");
assert.equal(targetHistory.changes, "3 damage");
assert.equal(targetHistory.penalty, "");
assert.equal(targetHistory.duration, "—");
assert.equal(targetHistory.details, "Rowan dealt 3 damage to Mira with Slash.");
const bram = player("bram", "Bram Player", "veil");
bram.hero.name = "Bram Coalhand";
bram.skillDeck = [
  { id: "bc-fortress", name: "Two-Turn Bastion", effect: "guard" },
  { id: "bc-march", name: "Bulwark to Blade", effect: "damage" }
];
const bramHistoryPlayers = [bram, mira];
const bramGuardHistory = {
  ...historyEntry,
  id: "bram-guard-history",
  kind: "guard",
  actorId: bram.id,
  actorName: bram.displayName,
  targetName: bram.displayName,
  cardName: "Two-Turn Bastion",
  message: "Bram Player granted 4 shield to Bram Player.",
  amount: 4
};
assert.equal(formatHistoryPresentation(bramGuardHistory, bramHistoryPlayers).duration, "Until target's second turn ends", "Bram's Guard history shows Two-Turn Temper's two-turn duration");
const shieldforgedHistory = {
  ...bramGuardHistory,
  id: "shieldforged-history",
  kind: "damage",
  targetName: mira.displayName,
  cardName: "Bulwark to Blade",
  message: "Bram Player removed 5 shield. Mira lost 5 HP.",
  amount: 5
};
assert.equal(formatHistoryPresentation(shieldforgedHistory, bramHistoryPlayers).type, "Attack", "Bulwark to Blade history uses the Attack type");
assert.equal(formatHistoryPresentation(shieldforgedHistory, bramHistoryPlayers).target, "Mira", "Bulwark to Blade history names its enemy target");
assert.equal(formatHistoryPresentation(shieldforgedHistory, bramHistoryPlayers).changes, "5 damage", "Bulwark to Blade history reports immediate damage");
assert.equal(formatHistoryPresentation(shieldforgedHistory, bramHistoryPlayers).duration, "—", "Bulwark to Blade history has no delayed-effect duration");
const failedHistory = { ...historyEntry, id: "history-failure", success: false, failureDetail: "Rowan took 2 backlash damage." };
assert.equal(formatHistoryPresentation(failedHistory, players).penalty, "Rowan took 2 backlash damage.");
const legacyFailedHistory = { ...failedHistory, id: "history-legacy-failure", failureDetail: undefined, message: "Rowan used Slash — The attack failed. Rowan took 2 backlash damage." };
assert.equal(formatHistoryPresentation(legacyFailedHistory, players).penalty, "Rowan took 2 backlash damage.");

const lifeEvent = {
  id: "life-1",
  kind: "defeat",
  playerId: mira.id,
  playerName: mira.displayName,
  reason: "Rowan defeated Mira.",
  source: "card"
};
assert.equal(formatLifeEventPresentation(lifeEvent, players, mira.id).title, "Rowan defeated Mira");
assert.equal(formatLifeEventPresentation(lifeEvent, players, rowan.id).title, "Rowan defeated Mira");
assert.equal(formatLifeEventPresentation(lifeEvent, players, nyx.id).category, "MIRA DEFEATED");

const statusState = {
  shield: 3,
  attackBuff: 2,
  diceBuff: 2,
  dicePenalty: 1,
  sanguineRecompense: true,
  zeroPityUntilTurn: 5,
  skipTurns: 1,
  reviveIn: 2,
  completedPlayerTurns: 4,
  timedEffects: [
    { kind: "shield", expiresAfterTurn: 6 },
    { kind: "attackBuff", expiresAfterTurn: 5 },
    { kind: "diceBuff", expiresAfterTurn: 5 },
    { kind: "dicePenalty", expiresAfterTurn: 5 }
  ],
  borrowedCards: [{ cardId: "borrowed", ownerId: mira.id, borrowedAtTurn: 1 }],
  purgedCards: [{ cardId: "purged", returnAfterPhase: 8 }]
};
const ownStatuses = getStatusPresentations(rowan, statusState, players, rowan.id, 6);
assert.equal(ownStatuses.find((status) => status.kind === "shield").label, "Rowan's shield");
assert.equal(ownStatuses.find((status) => status.kind === "shield").duration, "2T");
assert.equal(ownStatuses.find((status) => status.kind === "shield").durationLabel, "2 Turns");
assert.equal(`${ownStatuses.find((status) => status.kind === "shield").value} - ${ownStatuses.find((status) => status.kind === "shield").durationLabel}`, "3 - 2 Turns");
assert.equal(ownStatuses.find((status) => status.kind === "shield").tooltip, "3 shield · 2T or until depleted.");
assert.equal(ownStatuses.find((status) => status.kind === "diceBuff").value, "+2");
assert.equal(ownStatuses.find((status) => status.kind === "dicePenalty").value, "−1");
assert.equal(ownStatuses.find((status) => status.kind === "sanguineRecompense").label, "Rowan's Sanguine Recompense");
assert.equal(ownStatuses.find((status) => status.kind === "sanguineRecompense").displayValue, "+1 team heal");
assert.equal(ownStatuses.find((status) => status.kind === "sanguineRecompense").tooltip, "Next successful Heal card restores 1 additional HP to every living ally.");
assert.equal(ownStatuses.find((status) => status.kind === "zeroPity").duration, "1T");
assert.equal(ownStatuses.find((status) => status.kind === "zeroPity").durationLabel, "1 Turn");
assert.equal(ownStatuses.find((status) => status.kind === "skipTurns").duration, "1T");
assert.equal(ownStatuses.find((status) => status.kind === "skipTurns").tooltipValue, "Skip");
assert.equal(ownStatuses.find((status) => status.kind === "revive").duration, "2T");
assert.equal(ownStatuses.find((status) => status.kind === "revive").durationLabel, "2 Turns");
assert.equal(ownStatuses.find((status) => status.kind === "purgedCards").duration, "3P");
assert.equal(ownStatuses.find((status) => status.kind === "purgedCards").durationLabel, "3 Phases");
for (const status of ownStatuses.filter((entry) => entry.duration)) assert.match(status.durationLabel, /^\d+ (?:Turn|Turns|Phase|Phases)$/, `${status.kind} tooltip duration must use a full unit label`);
for (const status of ownStatuses) assert.equal((status.tooltip.match(/[.!?](?:\s|$)/g) || []).length, 1, `${status.kind} tooltip must contain exactly one sentence`);
assert.equal(getStatusPresentations(rowan, statusState, players, elias.id, 6)[0].label, "Rowan's shield");
assert.equal(getStatusPresentations(rowan, statusState, players, mira.id, 6)[0].label, "Rowan's shield");

const discardOutcome = {
  id: "discard-1",
  kind: "discard",
  success: true,
  total: 0,
  target: 0,
  label: "Rowan discarded Quiet Step",
  detail: "Rowan discarded Quiet Step; hand refilled to 4 if needed.",
  actorId: rowan.id,
  actorName: rowan.displayName,
  cardId: "rowan-discard",
  cardName: "Quiet Step"
};
const discardHistory = {
  id: "discard-history-1",
  turn: 4,
  phase: 2,
  kind: "discard",
  actorName: rowan.displayName,
  cardName: "Quiet Step",
  message: "Rowan discarded Quiet Step; hand refilled to 4 if needed.",
  success: true,
  createdAt: 2
};
const stealOutcome = {
  id: "steal-1",
  kind: "card",
  success: true,
  total: 18,
  target: 12,
  label: "Rowan used Borrowed Fate",
  detail: "Rowan stole one random special card from Mira; it will return later.",
  actorId: rowan.id,
  actorName: rowan.displayName,
  targetIds: [mira.id],
  targetName: mira.displayName,
  cardName: "Borrowed Fate",
  supportType: "steal-card"
};
const game = {
  outcome: discardOutcome,
  history: [discardHistory],
  playerStates: {},
  worldEventHistory: []
};
const ownerGame = sanitizeCommunicationGame(game, players, rowan.id);
assert.equal(ownerGame.outcome.cardName, "Quiet Step", "the discarding player keeps their private card identity");
assert.equal(ownerGame.history[0].cardName, "Quiet Step");
const observerGame = sanitizeCommunicationGame(game, players, elias.id);
assert.equal(observerGame.outcome.cardName, undefined, "observers cannot see a voluntarily discarded card identity");
assert.equal(observerGame.outcome.cardId, undefined);
assert.equal(observerGame.history[0].cardName, undefined);
assert(!observerGame.history[0].message.includes("Quiet Step"));
assert.equal(game.outcome.cardName, "Quiet Step", "communication sanitization does not mutate authority state");

const uninvolvedSteal = sanitizeCommunicationGame({ ...game, outcome: stealOutcome, history: [] }, players, elias.id);
assert(!uninvolvedSteal.outcome.detail.includes("special"), "uninvolved observers cannot infer the stolen card rarity");
assert(sanitizeCommunicationGame({ ...game, outcome: stealOutcome, history: [] }, players, rowan.id).outcome.detail.includes("special"));
assert(sanitizeCommunicationGame({ ...game, outcome: stealOutcome, history: [] }, players, mira.id).outcome.detail.includes("special"));

console.log("Viewpoint communication tests passed.");
