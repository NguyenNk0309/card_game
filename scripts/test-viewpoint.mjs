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
  { id: "rowan-steal", name: "Pilfered Chance", effect: "support", supportType: "steal-card" }
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
    category: "YOUR ACTION",
    title: "You passed",
    detail: "You ended your turn without playing a card. Your cards were preserved.",
    involvedPlayerIds: [rowan.id]
  },
  "a voluntary pass is not described as a forced skip"
);
assert.equal(formatOutcomePresentation({ ...voluntaryPass, kind: "timeout" }, players, rowan.id).title, "You ran out of time");
assert.equal(formatOutcomePresentation({ ...voluntaryPass, kind: "forced-skip" }, players, rowan.id).title, "Your turn was skipped");
assert.equal(formatOutcomePresentation(voluntaryPass, players, elias.id).title, "Your ally Rowan passed");
assert.equal(formatOutcomePresentation(voluntaryPass, players, mira.id).title, "Enemy Rowan passed");

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
assert.equal(formatOutcomePresentation(hit, players, mira.id).category, "YOU WERE HIT");
assert.equal(formatOutcomePresentation(hit, players, mira.id).detail, "Rowan dealt 3 damage to you.");
assert.equal(
  formatOutcomePresentation({ ...hit, effect: "support", supportType: "enemy-dice", detail: "Rowan gave Mira −2 to their next d20 result." }, players, mira.id).detail,
  "Rowan gave you −2 to your next d20 result.",
  "target pronouns follow the affected viewer's perspective"
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
const targetHistory = formatHistoryPresentation(historyEntry, players, mira.id);
assert.equal(targetHistory.type, "Attack received");
assert.equal(targetHistory.actor, "Rowan");
assert.equal(targetHistory.target, "You");
assert.equal(targetHistory.changes, "3 damage");
assert.equal(targetHistory.penalty, "");
assert.equal(targetHistory.duration, "—");
assert.equal(targetHistory.details, "Rowan dealt 3 damage to you with Slash.");
assert.equal(formatHistoryPresentation(historyEntry, players, elias.id).actor, "Your ally Rowan");
assert.equal(formatHistoryPresentation(historyEntry, players, nyx.id).actor, "Enemy Rowan");
const failedHistory = { ...historyEntry, id: "history-failure", success: false, failureDetail: "Rowan took 2 backlash damage." };
assert.equal(formatHistoryPresentation(failedHistory, players, rowan.id).penalty, "You took 2 backlash damage.");
assert.equal(formatHistoryPresentation(failedHistory, players, elias.id).penalty, "Your ally Rowan took 2 backlash damage.");
const legacyFailedHistory = { ...failedHistory, id: "history-legacy-failure", failureDetail: undefined, message: "Rowan used Slash — The attack failed. Rowan took 2 backlash damage." };
assert.equal(formatHistoryPresentation(legacyFailedHistory, players, rowan.id).penalty, "You took 2 backlash damage.");

const lifeEvent = {
  id: "life-1",
  kind: "defeat",
  playerId: mira.id,
  playerName: mira.displayName,
  reason: "Rowan defeated Mira.",
  source: "card"
};
assert.equal(formatLifeEventPresentation(lifeEvent, players, mira.id).title, "You were defeated");
assert.equal(formatLifeEventPresentation(lifeEvent, players, rowan.id).title, "You defeated Mira");
assert.equal(formatLifeEventPresentation(lifeEvent, players, nyx.id).category, "ALLY DEFEATED");

const statusState = {
  shield: 3,
  attackBuff: 2,
  diceBuff: 2,
  dicePenalty: 1,
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
assert.equal(ownStatuses.find((status) => status.kind === "shield").label, "Your shield");
assert.equal(ownStatuses.find((status) => status.kind === "shield").duration, "2T");
assert.equal(ownStatuses.find((status) => status.kind === "shield").tooltip, "You have 3 shield for 2 turns or until depleted.");
assert.equal(ownStatuses.find((status) => status.kind === "diceBuff").value, "+2");
assert.equal(ownStatuses.find((status) => status.kind === "dicePenalty").value, "−1");
assert.equal(ownStatuses.find((status) => status.kind === "zeroPity").duration, "1T");
assert.equal(ownStatuses.find((status) => status.kind === "skipTurns").duration, "1T");
assert.equal(ownStatuses.find((status) => status.kind === "revive").duration, "2T");
assert.equal(ownStatuses.find((status) => status.kind === "purgedCards").duration, "3P");
for (const status of ownStatuses) assert.equal((status.tooltip.match(/[.!?](?:\s|$)/g) || []).length, 1, `${status.kind} tooltip must contain exactly one sentence`);
assert.equal(getStatusPresentations(rowan, statusState, players, elias.id, 6)[0].label, "Ally Rowan's shield");
assert.equal(getStatusPresentations(rowan, statusState, players, mira.id, 6)[0].label, "Enemy Rowan's shield");

const discardOutcome = {
  id: "discard-1",
  kind: "discard",
  success: true,
  total: 0,
  target: 0,
  label: "Rowan discarded Quiet Step",
  detail: "Rowan discarded Quiet Step and drew a replacement.",
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
  message: "Rowan discarded Quiet Step and drew a replacement.",
  success: true,
  createdAt: 2
};
const stealOutcome = {
  id: "steal-1",
  kind: "card",
  success: true,
  total: 18,
  target: 12,
  label: "Rowan used Pilfered Chance",
  detail: "Rowan stole one random special card from Mira; it will return later.",
  actorId: rowan.id,
  actorName: rowan.displayName,
  targetIds: [mira.id],
  targetName: mira.displayName,
  cardName: "Pilfered Chance",
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
