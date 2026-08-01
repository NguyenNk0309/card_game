import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const compile = (source, fileName) => ts.transpileModule(source, {
  fileName,
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;

const catalogSource = await readFile(new URL("../backend/game/catalog.ts", import.meta.url), "utf8");
const catalogUrl = `data:text/javascript;base64,${Buffer.from(compile(catalogSource, "catalog.ts")).toString("base64")}`;
const catalog = await import(catalogUrl);
const pityCostUrl = new URL("../shared/pityCost.mjs", import.meta.url).href;
const pityCostRules = await import(pityCostUrl);
const cardRulesSource = await readFile(new URL("../shared/cardRules.ts", import.meta.url), "utf8");
const compiledCardRules = compile(cardRulesSource, "cardRules.ts").replace('from "./pityCost.mjs"', `from "${pityCostUrl}"`);
const cardRules = await import(`data:text/javascript;base64,${Buffer.from(compiledCardRules).toString("base64")}`);
const diceVisibilitySource = await readFile(new URL("../shared/diceVisibility.ts", import.meta.url), "utf8");
const diceVisibility = await import(`data:text/javascript;base64,${Buffer.from(compile(diceVisibilitySource, "diceVisibility.ts")).toString("base64")}`);
const engineSource = await readFile(new URL("../backend/game/engine.ts", import.meta.url), "utf8");
const compiledEngine = compile(engineSource, "engine.ts")
  .replace('from "./catalog"', `from "${catalogUrl}"`)
  .replace('from "@/shared/pityCost.mjs"', `from "${pityCostUrl}"`);
const engine = await import(`data:text/javascript;base64,${Buffer.from(compiledEngine).toString("base64")}`);

const sampledTargets = Array.from({ length: 256 }, () => engine.randomDiceTarget());
const sampledRolls = Array.from({ length: 256 }, () => engine.randomD20Roll());
assert.equal(diceVisibility.visibleDiceModifier(3, "affected-player", "affected-player"), 3, "the affected player sees their dice modifier");
assert.equal(diceVisibility.visibleDiceModifier(3, "affected-player", "observer"), 0, "other players see a zero dice modifier");
assert(sampledTargets.every((value) => Number.isInteger(value) && value >= 8 && value <= 16), "every target must be an independent integer from 8 through 16");
assert(sampledRolls.every((value) => Number.isInteger(value) && value >= 1 && value <= 20), "every d20 result must be an independent integer from 1 through 20");
assert(new Set(sampledTargets).size > 1, "target sampling must not return a fixed value");
assert(new Set(sampledRolls).size > 1, "d20 sampling must not return a fixed value");

const options = engine.getCharacterOptions();
assert.equal(options.length, 10);
const everyCard = options.flatMap((option) => option.skillDeck);
const expectedSpecialBalance = {
  "ev-aegis": { pityCost: 5, failureEffect: "team-damage", failureValue: 1 },
  "ev-ward": { pityCost: 5, failureEffect: "lose-shield", failureValue: 2 },
  "ev-command": { pityCost: 4, failureEffect: "self-damage", failureValue: 1 },
  "tv-mark": { pityCost: 6, failureEffect: "self-damage", failureValue: 2 },
  "tv-pierce": { pityCost: 6, failureEffect: "self-damage", failureValue: 2 },
  "tv-hunt": { pityCost: 5, failureEffect: "enemy-shield", failureValue: 1 },
  "ma-inferno": { pityCost: 7, failureEffect: "team-damage", failureValue: 1 },
  "ma-comet": { pityCost: 7, failureEffect: "self-damage", failureValue: 2 },
  "ma-gravity": { pityCost: 5, failureEffect: "enemy-shield", failureValue: 1 },
  "bo-prayer": { pityCost: 5, failureEffect: "self-damage", failureValue: 1 },
  "bo-blessing": { pityCost: 6, failureEffect: "team-damage", failureValue: 1 },
  "bo-return": { pityCost: 8, failureEffect: "team-damage", failureValue: 2 },
  "nc-knife": { pityCost: 6, failureEffect: "self-damage", failureValue: 2 },
  "nc-execute": { pityCost: 7, failureEffect: "self-damage", failureValue: 3 },
  "nc-pilfer": { pityCost: 7, failureEffect: "enemy-shield", failureValue: 2 },
  "bc-fortress": { pityCost: 6, failureEffect: "lose-shield", failureValue: 3 },
  "bc-temper": { pityCost: 7, failureEffect: "team-damage", failureValue: 1 },
  "bc-march": { pityCost: 6, failureEffect: "lose-shield", failureValue: 2 },
  "sf-favor": { pityCost: 6, failureEffect: "self-damage", failureValue: 2 },
  "sf-hex": { pityCost: 6, failureEffect: "enemy-shield", failureValue: 1 },
  "sf-stolen": { pityCost: 8, failureEffect: "team-damage", failureValue: 2 },
  "kr-riposte": { pityCost: 6, failureEffect: "self-damage", failureValue: 2 },
  "kr-duel": { pityCost: 6, failureEffect: "lose-shield", failureValue: 2 },
  "kr-break": { pityCost: 6, failureEffect: "enemy-shield", failureValue: 2 },
  "im-command": { pityCost: 6, failureEffect: "team-damage", failureValue: 1 },
  "im-focus": { pityCost: 6, failureEffect: "team-damage", failureValue: 1 },
  "im-purge": { pityCost: 7, failureEffect: "enemy-shield", failureValue: 2 },
  "df-none": { pityCost: 7, failureEffect: "self-damage", failureValue: 2 },
  "df-cleave": { pityCost: 8, failureEffect: "self-damage", failureValue: 3 },
  "df-frenzy": { pityCost: 6, failureEffect: "self-damage", failureValue: 2 }
};
const expectedCommonPityCosts = { slash: 3, heavy: 4, brace: 3, "second-wind": 4, "empty-gesture": 0, "broken-plan": 0, "lost-momentum": 0 };
const specialCards = everyCard.filter((card) => card.unique);
assert.equal(Object.keys(expectedSpecialBalance).length, 30, "the rebalance contract must cover all 30 special cards");
assert.equal(specialCards.length, 30, "the live catalog must expose all 30 special cards");
for (const card of specialCards) {
  assert.deepEqual(
    { pityCost: card.pityCost, failureEffect: card.failureEffect, failureValue: card.failureValue },
    expectedSpecialBalance[card.id],
    `${card.name} must use its effect-specific pity and failure balance`
  );
}
for (const card of everyCard.filter((candidate) => !candidate.unique)) {
  const commonId = card.id.slice(card.id.indexOf("-common-") + "-common-".length);
  assert.equal(card.pityCost, expectedCommonPityCosts[commonId], `${card.name} must use its common-card pity cost`);
}
const enemyShieldFailureCard = specialCards.find((card) => card.failureEffect === "enemy-shield");
assert.equal(cardRules.describeCardFailure(enemyShieldFailureCard), `Every enemy gains ${enemyShieldFailureCard.failureValue} shield until the end of their next turn.`, "enemy-shield failure copy must state its target, amount, and duration");
const originalTestMode = process.env.TEST_MODE;
delete process.env.TEST_MODE;
assert(everyCard.every((card) => cardRules.getCardPityCost(card) === pityCostRules.calculateRuntimePityCost(card, false)), "an absent TEST_MODE preserves every original pity cost");
process.env.TEST_MODE = "false";
assert(everyCard.every((card) => cardRules.getCardPityCost(card) === pityCostRules.calculateRuntimePityCost(card, false)), "TEST_MODE=false preserves every original pity cost");
process.env.TEST_MODE = "true";
assert(everyCard.every((card) => cardRules.getCardPityCost(card) === 0), "TEST_MODE=true makes every card's effective pity cost zero");
assert.equal(pityCostRules.isTestModeEnabled(" TRUE "), true, "TEST_MODE accepts a normalized true value");
process.env.TEST_MODE = "false";
assert.equal(cardRules.describeCardFailure(options[0].skillDeck.find((card) => !card.unique)), "No effect.", "common-card failure copy stays concise and grammatical");
assert.equal(cardRules.describeCardSuccess(options[0].skillDeck.find((card) => card.effect === "none")), "No effect.", "no-effect success copy stays concise and grammatical");
for (const option of options) {
  assert.equal(option.skillDeck.length, 10, `${option.hero.name} must have 10 cards`);
  assert.equal(option.skillDeck.filter((card) => card.unique).length, 3);
  assert.equal(option.skillDeck.filter((card) => !card.unique).length, 7);
  assert(option.skillDeck.every((card) => Number.isInteger(card.pityCost) && card.pityCost >= 0 && card.pityCost <= 8), "every card must have a reachable integer pity cost");
  assert(option.skillDeck.filter((card) => card.effect === "none").every((card) => card.pityCost === 0), "no-effect cards must cost zero pity");
  assert(option.skillDeck.filter((card) => card.effect !== "none").every((card) => card.pityCost >= 3), "effect cards must require accumulated pity");
  assert(option.skillDeck.every((card) => card.bonus === 0), "cards cannot carry a built-in d20 bonus");
  assert(option.skillDeck.every((card) => !("risk" in card) && card.effect !== "check"));
  assert(option.skillDeck.filter((card) => card.unique).every((card) => ["self-damage", "team-damage", "lose-shield", "enemy-shield"].includes(card.failureEffect) && card.failureValue > 0), "every special card needs a balanced failure impact");
  const common = option.skillDeck.filter((card) => !card.unique);
  assert(common.every((card) => !card.failureEffect && !card.failureValue), "common cards cannot have failure penalties");
  assert.equal(common.filter((card) => card.effect === "damage").length, 2, "common deck needs two attacks");
  assert.equal(common.filter((card) => card.effect === "guard" && card.target === "self").length, 1, "common deck needs one self guard");
  assert.equal(common.filter((card) => card.effect === "heal" && card.target === "self").length, 1, "common deck needs one self heal");
  assert.equal(common.filter((card) => card.effect === "none" && card.value === 0).length, 3, "common deck needs three no-effect cards");
  assert(option.skillDeck.filter((card) => card.target === "all-allies").every((card) => /including yourself/i.test(card.description)), "all-allies descriptions must explicitly include the acting player");
  assert(option.skillDeck.filter((card) => card.target === "ally" && card.supportType !== "advance-ally").every((card) => /including yourself/i.test(card.description)), "one-ally descriptions must explicitly include the acting player");
  const damageCards = option.skillDeck.filter((card) => card.effect === "damage" || card.effect === "aoe");
  const ignoresShield = option.hero.classId === "assassin";
  assert(damageCards.every((card) => /ignoring shield/i.test(card.description) === Boolean(card.ignoresShield || ignoresShield)), "damage descriptions mention shield only when the attack ignores it");
}
assert(options.every((option) => option.skillDeck.every((card) => !/shield applies/i.test(card.description))), "card descriptions omit the default shield rule");
const cardWithoutId = ({ id: _id, ...card }) => card;
for (const option of options) {
  const phaseFourDeck = catalog.upgradeCardsAfterPhaseFive(option.skillDeck, 4);
  assert.equal(phaseFourDeck, option.skillDeck, `${option.hero.name}'s cards cannot upgrade before phase 5 ends`);
  const phaseFiveDeck = catalog.upgradeCardsAfterPhaseFive(option.skillDeck, 5);
  assert.notEqual(phaseFiveDeck, option.skillDeck, `${option.hero.name}'s upgrade creates a new deck definition`);
  assert.equal(phaseFiveDeck.filter((card) => card.effect === "none").length, 0, `${option.hero.name}'s three no-effect cards all upgrade independently`);
  for (const [sourceId, targetId] of Object.entries(catalog.PHASE_FIVE_CARD_UPGRADES)) {
    const source = option.skillDeck.find((card) => card.id.endsWith(`-common-${sourceId}`));
    const target = option.skillDeck.find((card) => card.id.endsWith(`-common-${targetId}`));
    const upgraded = phaseFiveDeck.find((card) => card.id === source.id);
    assert.deepEqual(cardWithoutId(upgraded), cardWithoutId(target), `${source.name} must gain every ability and appearance field from ${target.name}`);
  }
}
const upgradeDescriptions = Object.values(catalog.PHASE_FIVE_CARD_UPGRADES).map((targetId) => {
  const sourceId = Object.entries(catalog.PHASE_FIVE_CARD_UPGRADES).find(([, candidate]) => candidate === targetId)[0];
  return options[0].skillDeck.find((card) => card.id.endsWith(`-common-${sourceId}`)).description;
});
assert(upgradeDescriptions.some((description) => /heavy attack card/i.test(description)), "one no-effect card previews its heavy attack upgrade");
assert(upgradeDescriptions.some((description) => /shield card/i.test(description)), "one no-effect card previews its shield upgrade");
assert(upgradeDescriptions.some((description) => /heal card/i.test(description)), "one no-effect card previews its heal upgrade");

const zonePlayers = structuredClone(options.slice(0, 2).map((option, index) => engine.createPlayerSession(`Zone ${index}`, index, option.hero.name, `zone-${index}`)));
const zoneOneSources = Object.keys(catalog.PHASE_FIVE_CARD_UPGRADES).map((sourceId) => zonePlayers[0].skillDeck.find((card) => card.id.endsWith(`-common-${sourceId}`)).id);
const zoneTwoSources = Object.keys(catalog.PHASE_FIVE_CARD_UPGRADES).map((sourceId) => zonePlayers[1].skillDeck.find((card) => card.id.endsWith(`-common-${sourceId}`)).id);
const zoneStates = {
  [zonePlayers[0].id]: { hand: [zoneOneSources[0]], drawPile: [zoneOneSources[1]], discardPile: [zoneOneSources[2]], graveyard: [] },
  [zonePlayers[1].id]: { hand: [zoneTwoSources[1]], drawPile: [zoneTwoSources[2]], discardPile: [], graveyard: [zoneTwoSources[0]] }
};
const preservedZones = structuredClone(zoneStates);
const upgradedZonePlayers = catalog.upgradePlayerCardsAfterPhaseFive(zonePlayers, 5);
assert.deepEqual(zoneStates, preservedZones, "phase-5 upgrades preserve every hand, draw, discard, and graveyard ID and position");
for (const [playerIndex, sourceIds] of [[0, zoneOneSources], [1, zoneTwoSources]]) {
  const upgradedCards = sourceIds.map((id) => upgradedZonePlayers[playerIndex].skillDeck.find((card) => card.id === id));
  assert.deepEqual(upgradedCards.map((card) => card.effect).sort(), ["damage", "guard", "heal"], "each upgrade transforms separately without affecting the other two");
}
const supportTypes = new Set(options.flatMap((option) => option.skillDeck.filter((card) => card.effect === "support").map((card) => card.supportType)));
assert.deepEqual([...supportTypes].sort(), ["advance-ally", "attack", "dice", "dispel-enemy", "enemy-dice", "purge-card", "revive", "shield-to-attack", "skip-enemy", "steal-card", "zero-pity"]);
const diceModifierCards = options.flatMap((option) => option.skillDeck).filter((card) => card.supportType === "dice" || card.supportType === "enemy-dice");
assert.deepEqual(diceModifierCards.map((card) => card.name).sort(), ["Dark Omen", "Focus Order", "Gravity Hex"], "only the approved cards can create stored d20 modifiers");
const durationCards = options.flatMap((option) => option.skillDeck).filter((card) =>
  card.effect === "guard" || ["attack", "shield", "shield-to-attack", "dice", "enemy-dice", "skip-enemy", "steal-card", "zero-pity"].includes(card.supportType)
);
assert(durationCards.every((card) => /expires at the end|effects expire normally|next turn ends/i.test(card.description)), "every buff and debuff card must state the target-turn expiry rule");
for (const classId of ["warden", "healer", "tank", "oracle", "support"]) {
  const option = options.find((candidate) => candidate.hero.classId === classId);
  assert.equal(option.skillDeck.filter((card) => card.unique && ["damage", "aoe"].includes(card.effect)).length, 0, `${classId} must focus on its non-damage team role`);
}
for (const classId of ["ranger", "mage", "assassin", "duelist", "berserker"]) {
  const option = options.find((candidate) => candidate.hero.classId === classId);
  assert.equal(option.skillDeck.filter((card) => card.unique && ["damage", "aoe"].includes(card.effect)).length, 2, `${classId} must have exactly two damage specials and one role utility special`);
}
assert.equal(options.find((option) => option.hero.classId === "tank").hero.maxHp, 14);
assert.equal(options.find((option) => option.hero.classId === "mage").hero.maxHp, 9);
assert.deepEqual([...options].sort((a, b) => b.hero.speed - a.hero.speed).map((option) => option.hero.name), ["Nyx Calder", "Thorne Vale", "Kael Rook", "Sable Fen", "Ione Mire", "Mira Ash", "Brother Orren", "Elara Voss", "Dagan Flint", "Bram Coalhand"]);

const first = engine.createPlayerSession("An", 0, options[0].hero.name, "first");
const second = engine.createPlayerSession("Binh", 1, options[1].hero.name, "second");
const elaraSupport = first.skillDeck.find((card) => card.effect === "support");
const elaraGame = engine.createInitialGame([first, second], engine.createAdventure("ELARA-DICE"), 30);
assert.equal(engine.getPassiveDiceBonus(first, elaraSupport, elaraGame.playerStates[first.id]), 0, "Elara's passive cannot modify d20 results");
for (const option of options.filter((candidate) => candidate.hero.classId !== "support")) {
  const sampleCard = option.skillDeck.find((card) => card.effect !== "none") ?? option.skillDeck[0];
  const samplePlayer = engine.createPlayerSession(option.hero.initials, 0, option.hero.name, `passive-${option.hero.initials}`);
  const sampleGame = engine.createInitialGame([samplePlayer, second], engine.createAdventure(`PASSIVE-${option.hero.initials}`), 30);
  assert.equal(engine.getPassiveDiceBonus(samplePlayer, sampleCard, sampleGame.playerStates[samplePlayer.id]), 0, `${option.hero.passiveName} cannot modify d20 results`);
}
const game = engine.createInitialGame([first, second], engine.createAdventure("RULES"), 30);
assert.equal(game.turnOrder[0], second.id, "the faster character acts first");
game.turnOrder = [first.id, second.id];
assert.equal(game.maxTurns, 30);
assert.equal(game.maxPhases, 30);
assert.equal(game.completedPhases, 0);
assert.equal(game.playerStates[first.id].pityPoints, 0, "every player begins with zero pity");
assert.equal(game.playerStates[first.id].hand.length + game.playerStates[first.id].drawPile.length + game.playerStates[first.id].discardPile.length + game.playerStates[first.id].graveyard.length, 10, "all cards begin in reusable zones with an empty graveyard");
assert.equal(engine.createInitialGame([first, second], engine.createAdventure("TIMER"), 5).turnSeconds, 60, "battle turns always last exactly 60 seconds");
assert(game.adventure.target >= 8 && game.adventure.target <= 16, "the initial target is randomly selected from the balanced target range");

const attack = first.skillDeck.find((card) => card.effect === "damage");
process.env.TEST_MODE = "true";
const testModeGame = engine.createInitialGame([first, second], engine.createAdventure("PITY-TEST-MODE"), 30);
testModeGame.turnOrder = [first.id, second.id];
testModeGame.adventure.target = 16;
testModeGame.playerStates[first.id].hand = [attack.id];
testModeGame.playerStates[first.id].pityPoints = 4;
const testModeResult = engine.resolveCardTurn(testModeGame, [first, second], attack.id, second.id, 1);
assert.equal(testModeResult.outcome.success, true, "TEST_MODE=true makes a normal play automatically succeed at zero pity cost");
assert.equal(testModeResult.outcome.pityCost, 0, "the test-mode outcome reports zero pity cost");
assert.equal(testModeResult.playerStates[first.id].pityPoints, 4, "a test-mode card neither spends nor earns pity");
process.env.TEST_MODE = "false";
const pityFailureGame = engine.createInitialGame([first, second], engine.createAdventure("PITY-FAIL"), 30);
pityFailureGame.turnOrder = [first.id, second.id];
pityFailureGame.adventure.target = 16;
pityFailureGame.playerStates[first.id].hand = [attack.id];
const pityEarned = engine.resolveCardTurn(pityFailureGame, [first, second], attack.id, second.id, 1);
assert.equal(pityEarned.outcome.success, false);
assert.equal(pityEarned.playerStates[first.id].pityPoints, 1, "a failed normal d20 must award exactly one pity point");
assert.equal(pityEarned.outcome.pityBefore, 0);
assert.equal(pityEarned.outcome.pityAfter, 1);

const insufficientPityGame = engine.createInitialGame([first, second], engine.createAdventure("PITY-LOCK"), 30);
insufficientPityGame.turnOrder = [first.id, second.id];
insufficientPityGame.playerStates[first.id].hand = [attack.id];
assert.equal(engine.resolveCardTurn(insufficientPityGame, [first, second], attack.id, second.id, 0, true), insufficientPityGame, "pity play must be rejected when points are below the selected card cost");

const pitySuccessGame = engine.createInitialGame([first, second], engine.createAdventure("PITY-SUCCESS"), 30);
pitySuccessGame.turnOrder = [first.id, second.id];
pitySuccessGame.playerStates[first.id].hand = [attack.id];
pitySuccessGame.playerStates[first.id].pityPoints = attack.pityCost + 2;
pitySuccessGame.playerStates[first.id].diceBuff = 2;
pitySuccessGame.playerStates[first.id].dicePenalty = 1;
const pitySuccess = engine.resolveCardTurn(pitySuccessGame, [first, second], attack.id, second.id, 0, true);
assert.equal(pitySuccess.outcome.success, true, "an affordable pity play must guarantee card success");
assert.equal(pitySuccess.outcome.resolution, "pity");
assert.equal(pitySuccess.outcome.pityCost, attack.pityCost);
assert.equal(pitySuccess.playerStates[first.id].pityPoints, 2, "pity play must deduct exactly the selected card cost");
assert.equal(pitySuccess.playerStates[first.id].diceBuff, 0, "a saved d20 buff expires when its target's pity-play turn ends");
assert.equal(pitySuccess.playerStates[first.id].dicePenalty, 0, "a saved d20 penalty expires when its target's pity-play turn ends");
assert.equal(pitySuccess.roll, null, "pity play must not report a fabricated d20 result");
assert.equal(pitySuccess.history.at(-1).resolution, "pity");
assert.equal(pitySuccess.history.at(-1).diceRoll, undefined);

const freePityCard = first.skillDeck.find((card) => card.effect === "none");
const freePityGame = engine.createInitialGame([first, second], engine.createAdventure("PITY-ZERO"), 30);
freePityGame.turnOrder = [first.id, second.id];
freePityGame.playerStates[first.id].hand = [freePityCard.id];
const freePityResult = engine.resolveCardTurn(freePityGame, [first, second], freePityCard.id, first.id, 0, true);
assert.equal(freePityResult.outcome.success, true, "a zero-cost no-effect card may use pity without stored points");
assert.equal(freePityResult.playerStates[first.id].pityPoints, 0);

const freeRollGame = engine.createInitialGame([first, second], engine.createAdventure("ROLL-ZERO"), 30);
freeRollGame.turnOrder = [first.id, second.id];
freeRollGame.adventure.target = 16;
freeRollGame.playerStates[first.id].hand = [freePityCard.id];
const freeRollResult = engine.resolveCardTurn(freeRollGame, [first, second], freePityCard.id, first.id, 1);
assert.equal(freeRollResult.outcome.success, true, "a normal roll with a zero-pity-cost card always succeeds regardless of the d20 result");
assert.equal(freeRollResult.outcome.roll, 1, "the ignored d20 result is still shown in the roll outcome");
assert.equal(freeRollResult.outcome.pityCost, 0, "the shared result identifies a zero-pity automatic success for every player's result panel");
assert.equal(freeRollResult.playerStates[first.id].pityPoints, 0, "an automatic zero-cost success does not award pity");
assert.equal(freeRollResult.history.at(-1).pityCost, 0, "history identifies the zero-pity automatic success");
assert.match(freeRollResult.history.at(-1).message, /d20 1 ignored; zero-pity card always succeeds/, "history explains that the roll result was ignored");

game.playerStates[first.id].hand = [attack.id];
const firstTarget = game.adventure.target;
const attacked = engine.resolveCardTurn(game, [first, second], attack.id, second.id, 20);
assert(attacked.adventure.target >= 8 && attacked.adventure.target <= 16, "each next target is generated independently of the raw d20");
assert.equal(attacked.history.length, 1);
assert.equal(attacked.outcome.id, attacked.history[0].id, "a card outcome keeps the stable identity of its action history entry");
assert.equal(attacked.outcome.actorId, first.id, "a card outcome identifies its actor by session ID");
assert.equal(attacked.history[0].diceRoll, 20);
assert.equal(attacked.history[0].diceTarget, firstTarget);
assert.equal(attacked.history[0].diceTotal, 20 + engine.getPassiveDiceBonus(first, attack, game.playerStates[first.id]));
assert.match(attacked.history[0].message, /An.*Binh|Binh.*HP/);

const defeatNoticeGame = engine.createInitialGame([first, second], engine.createAdventure("DEFEAT-NOTICE"), 30);
defeatNoticeGame.turnOrder = [first.id, second.id];
defeatNoticeGame.playerStates[first.id].hand = [attack.id];
defeatNoticeGame.playerStates[second.id].hp = 1;
const defeatNotice = engine.resolveCardTurn(defeatNoticeGame, [first, second], attack.id, second.id, 20);
assert.deepEqual(defeatNotice.outcome.lifeEvents.map((event) => [event.kind, event.playerId]), [["defeat", second.id]], "a defeat creates one synchronized player-life event");
assert.match(defeatNotice.outcome.lifeEvents[0].reason, /Binh.*An.*Slash/, "the defeat panel explains who and which card caused the defeat");

const anyPlayerCard = { ...attack, id: "living-player-target-test", name: "Living Player Target", target: "player" };
const anyPlayerActor = { ...first, skillDeck: [...first.skillDeck, anyPlayerCard] };
const defeatedTargetGame = engine.createInitialGame([anyPlayerActor, second], engine.createAdventure("DEFEATED-TARGET"), 30);
defeatedTargetGame.turnOrder = [anyPlayerActor.id, second.id];
defeatedTargetGame.playerStates[anyPlayerActor.id].hand = [anyPlayerCard.id];
defeatedTargetGame.playerStates[second.id].hp = 0;
const defeatedTargetResult = engine.resolveCardTurn(defeatedTargetGame, [anyPlayerActor, second], anyPlayerCard.id, second.id, 20);
assert.deepEqual(defeatedTargetResult.outcome.targetIds, [], "generic player-target actions cannot select a defeated ally or enemy");
assert.match(defeatedTargetResult.outcome.detail, /no valid target/i, "a stale defeated-player target resolves with no effect");

const exactTargetGame = engine.createInitialGame([first, second], engine.createAdventure("EXACT-TARGET"), 30);
exactTargetGame.turnOrder = [first.id, second.id];
exactTargetGame.adventure.target = 12;
exactTargetGame.playerStates[first.id].hand = [attack.id];
const exactTargetResult = engine.resolveCardTurn(exactTargetGame, [first, second], attack.id, second.id, 12);
assert.equal(exactTargetResult.outcome.success, true, "a d20 total exactly equal to the target must succeed");
assert.equal(exactTargetResult.outcome.total, exactTargetResult.outcome.target);

const elara = engine.createPlayerSession("Elara", 0, "Elara Voss", "elara-guard");
const elaraAlly = engine.createPlayerSession("Elara ally", 2, "Brother Orren", "elara-ally");
const elaraEnemy = engine.createPlayerSession("Elara enemy", 1, "Nyx Calder", "elara-enemy");
const elaraParty = [elara, elaraEnemy, elaraAlly];
const rallyingAegis = elara.skillDeck.find((card) => card.id === "ev-aegis");
const lanternWard = elara.skillDeck.find((card) => card.id === "ev-ward");
const elaraCommonGuard = elara.skillDeck.find((card) => !card.unique && card.effect === "guard");
assert.match(elara.hero.passiveText, /Guard cards grant \+1 shield/i, "United Front applies only to Elara's Guard cards");
assert.equal(rallyingAegis.effect, "guard", "Rallying Aegis is a Guard card");
assert.equal(rallyingAegis.supportType, undefined, "Rallying Aegis no longer carries a Support subtype");
assert.equal(rallyingAegis.pityCost, 5, "Rallying Aegis accounts for shielding the entire living team");
assert.equal(lanternWard.value, 3, "Lantern Ward has 3 base shield");
assert.equal(lanternWard.pityCost, 5, "Lantern Ward follows the existing Guard-card pity formula after its shield reduction");
assert.match(lanternWard.description, /3 shield.*4 with United Front/i, "Lantern Ward describes its base and passive-enhanced shield");
const aegisGame = engine.createInitialGame(elaraParty, engine.createAdventure("RALLYING-AEGIS-GUARD"), 30);
aegisGame.turnOrder = [elara.id, elaraEnemy.id, elaraAlly.id];
aegisGame.adventure.target = 8;
aegisGame.playerStates[elara.id].hand = [rallyingAegis.id];
const aegisResult = engine.resolveCardTurn(aegisGame, elaraParty, rallyingAegis.id, elara.id, 20);
assert.equal(aegisResult.outcome.effect, "guard", "Rallying Aegis resolves and synchronizes as a Guard card");
assert.equal(aegisResult.outcome.amount, 3, "United Front raises Rallying Aegis from 2 to 3 shield per target");
assert.deepEqual(aegisResult.outcome.targetIds.sort(), [elara.id, elaraAlly.id].sort(), "Rallying Aegis targets every living ally, including Elara");
assert.equal(aegisResult.playerStates[elara.id].shield, 3, "Rallying Aegis shields Elara");
assert.equal(aegisResult.playerStates[elaraAlly.id].shield, 3, "Rallying Aegis shields each living ally");
assert.equal(aegisResult.playerStates[elaraEnemy.id].shield, 0, "Rallying Aegis never shields enemies");
engine.expireTimedEffectsAtTurnEnd(aegisResult.playerStates[elaraAlly.id]);
assert.equal(aegisResult.playerStates[elaraAlly.id].shield, 0, "Rallying Aegis expires when an ally's next turn ends");
engine.expireTimedEffectsAtTurnEnd(aegisResult.playerStates[elara.id]);
assert.equal(aegisResult.playerStates[elara.id].shield, 0, "self-applied Rallying Aegis expires when Elara's following turn ends");
const wardGame = engine.createInitialGame(elaraParty, engine.createAdventure("LANTERN-WARD-GUARD"), 30);
wardGame.turnOrder = [elara.id, elaraEnemy.id, elaraAlly.id];
wardGame.adventure.target = 8;
wardGame.playerStates[elara.id].hand = [lanternWard.id];
const wardResult = engine.resolveCardTurn(wardGame, elaraParty, lanternWard.id, elaraAlly.id, 20);
assert.equal(wardResult.outcome.amount, 4, "United Front raises Lantern Ward from 3 to 4 shield");
assert.equal(wardResult.playerStates[elaraAlly.id].shield, 4, "Lantern Ward applies its passive-enhanced shield to the chosen ally");
const commonGuardGame = engine.createInitialGame(elaraParty, engine.createAdventure("ELARA-COMMON-GUARD"), 30);
commonGuardGame.turnOrder = [elara.id, elaraEnemy.id, elaraAlly.id];
commonGuardGame.adventure.target = 8;
commonGuardGame.playerStates[elara.id].hand = [elaraCommonGuard.id];
const commonGuardResult = engine.resolveCardTurn(commonGuardGame, elaraParty, elaraCommonGuard.id, elara.id, 20);
assert.equal(commonGuardResult.outcome.amount, elaraCommonGuard.value + 1, "United Front also strengthens Elara's common Guard cards");
const failedAegisGame = engine.createInitialGame(elaraParty, engine.createAdventure("RALLYING-AEGIS-FAILURE"), 30);
failedAegisGame.turnOrder = [elara.id, elaraEnemy.id, elaraAlly.id];
failedAegisGame.adventure.target = 20;
failedAegisGame.playerStates[elara.id].hand = [rallyingAegis.id];
const failedAegis = engine.resolveCardTurn(failedAegisGame, elaraParty, rallyingAegis.id, elara.id, 1);
assert.equal(failedAegis.outcome.success, false, "a failed Rallying Aegis remains unsuccessful after becoming a Guard card");
assert.equal(failedAegis.playerStates[elara.id].shield, 0, "a failed Rallying Aegis grants no shield to Elara");
assert.equal(failedAegis.playerStates[elaraAlly.id].shield, 0, "a failed Rallying Aegis grants no shield to allies");
assert.equal(failedAegis.playerStates[elara.id].hp, elara.hero.maxHp - 1, "Rallying Aegis failure still damages Elara's team");
assert.equal(failedAegis.playerStates[elaraAlly.id].hp, elaraAlly.hero.maxHp - 1, "Rallying Aegis failure still damages every living ally");
assert.equal(failedAegis.playerStates[elaraEnemy.id].hp, elaraEnemy.hero.maxHp, "Rallying Aegis failure never damages enemies");

const thorne = engine.createPlayerSession("Thorne", 0, "Thorne Vale", "thorne-passive");
const thorneTarget = engine.createPlayerSession("Deadeye target", 1, "Bram Coalhand", "thorne-target");
const thorneParty = [thorne, thorneTarget];
const markedArrow = thorne.skillDeck.find((card) => card.id === "tv-mark");
const thorneBlank = thorne.skillDeck.find((card) => card.effect === "none");
assert.match(thorne.hero.passiveText, /every second turn.*\+1 damage.*count starts when battle begins.*restarts on the turn after Deadeye triggers/i, "Deadeye explains its damage and full recurring cadence");
assert.match(markedArrow.description, /5 when Deadeye triggers/i, "Marked Arrow states its triggered Deadeye damage");
assert.match(thorne.skillDeck.find((card) => card.id === "tv-pierce").description, /4 when Deadeye triggers/i, "Piercing Arrow states its triggered Deadeye damage");
const thorneCadenceState = engine.createInitialGame(thorneParty, engine.createAdventure("DEADEYE-CADENCE"), 30).playerStates[thorne.id];
assert.equal(engine.getThorneValePassiveDamageBonus(thorne, markedArrow, thorneCadenceState), 0, "Deadeye is inactive on Thorne's first battle turn");
engine.expireTimedEffectsAtTurnEnd(thorneCadenceState);
assert.equal(engine.getThorneValePassiveDamageBonus(thorne, markedArrow, thorneCadenceState), 1, "a completed first turn makes Deadeye active on Thorne's second turn");
engine.expireTimedEffectsAtTurnEnd(thorneCadenceState);
assert.equal(engine.getThorneValePassiveDamageBonus(thorne, markedArrow, thorneCadenceState), 0, "Deadeye restarts its count on the turn after it triggers");
engine.expireTimedEffectsAtTurnEnd(thorneCadenceState);
assert.equal(engine.getThorneValePassiveDamageBonus(thorne, markedArrow, thorneCadenceState), 1, "Deadeye triggers again on Thorne's fourth turn");
assert.equal(engine.getThorneValePassiveDamageBonus(thorne, thorneBlank, thorneCadenceState), 0, "Deadeye only adds damage to single-target attacks");
const deadeyeGame = engine.createInitialGame(thorneParty, engine.createAdventure("DEADEYE-DAMAGE"), 30);
deadeyeGame.turnOrder = [thorne.id, thorneTarget.id];
deadeyeGame.adventure.target = 8;
deadeyeGame.playerStates[thorne.id].completedPlayerTurns = 1;
deadeyeGame.playerStates[thorne.id].attackBuff = 2;
deadeyeGame.playerStates[thorne.id].hand = [markedArrow.id];
deadeyeGame.playerStates[thorneTarget.id].hp = 14;
deadeyeGame.playerStates[thorneTarget.id].maxHp = 14;
const deadeyeAttack = engine.resolveCardTurn(deadeyeGame, thorneParty, markedArrow.id, thorneTarget.id, 20);
assert.equal(deadeyeAttack.outcome.amount, 7, "a second-turn Marked Arrow deals its 4 base damage, +1 Deadeye damage, and +2 attack buff");
assert.equal(deadeyeAttack.playerStates[thorneTarget.id].hp, 7, "Deadeye's bonus changes synchronized target HP in actual card resolution");
assert.equal(deadeyeAttack.playerStates[thorne.id].completedPlayerTurns, 2, "the triggering turn completes before Deadeye's cadence restarts");

const mira = engine.createPlayerSession("Mira", 0, "Mira Ash", "mira-inferno");
const infernoTargetOne = engine.createPlayerSession("Inferno target one", 1, "Bram Coalhand", "inferno-target-one");
const infernoTargetTwo = engine.createPlayerSession("Inferno target two", 1, "Sable Fen", "inferno-target-two");
const infernoAlly = engine.createPlayerSession("Inferno ally", 0, "Elara Voss", "inferno-ally");
const infernoParty = [mira, infernoTargetOne, infernoTargetTwo, infernoAlly];
const inferno = mira.skillDeck.find((card) => card.id === "ma-inferno");
assert.equal(mira.hero.hp, 9, "Mira Ash's printed HP is 9");
assert.equal(mira.hero.maxHp, 9, "Mira Ash begins battle with 9 max HP");
assert.equal(inferno.value, 3, "Inferno has 3 base damage");
assert.equal(inferno.pityCost, 7, "Inferno's pity cost accounts for its increased team-wide damage");
assert.match(inferno.description, /3 damage.*4 with Spreading Flame/i, "Inferno describes its base and passive-enhanced damage");
const infernoGame = engine.createInitialGame(infernoParty, engine.createAdventure("INFERNO-DAMAGE"), 30);
infernoGame.turnOrder = [mira.id, infernoTargetOne.id, infernoTargetTwo.id, infernoAlly.id];
infernoGame.adventure.target = 8;
infernoGame.playerStates[mira.id].hand = [inferno.id];
infernoGame.playerStates[infernoTargetOne.id].shield = 1;
const infernoResult = engine.resolveCardTurn(infernoGame, infernoParty, inferno.id, infernoTargetOne.id, 20);
assert.equal(infernoResult.outcome.amount, 7, "Inferno deals 4 damage per enemy with Spreading Flame, reduced normally by shield");
assert.equal(infernoResult.playerStates[infernoTargetOne.id].hp, infernoTargetOne.hero.maxHp - 3, "shield blocks one point of Inferno's passive-enhanced damage");
assert.equal(infernoResult.playerStates[infernoTargetTwo.id].hp, infernoTargetTwo.hero.maxHp - 4, "Inferno deals 3 base plus 1 Spreading Flame damage to each unshielded enemy");
assert.equal(infernoResult.playerStates[infernoAlly.id].hp, infernoAlly.hero.maxHp, "Inferno never damages Mira's allies");

const nyx = engine.createPlayerSession("Nyx", 0, "Nyx Calder", "nyx-damage");
const nyxTarget = engine.createPlayerSession("Armor Pierce target", 1, "Bram Coalhand", "nyx-target");
const nyxParty = [nyx, nyxTarget];
const quietKnife = nyx.skillDeck.find((card) => card.id === "nc-knife");
const execute = nyx.skillDeck.find((card) => card.id === "nc-execute");
assert.equal(quietKnife.value, 3, "Quiet Knife has 3 base damage");
assert.equal(execute.value, 4, "Execute has 4 base damage");
assert.equal(quietKnife.pityCost, 6, "Quiet Knife's pity cost accounts for Armor Pierce");
assert.equal(execute.pityCost, 7, "Execute's pity cost follows the existing shield-piercing damage formula");
assert.match(quietKnife.description, /3 damage.*ignoring shield/i, "Quiet Knife describes its reduced shield-piercing damage");
assert.match(execute.description, /4 damage.*ignoring shield/i, "Execute describes its reduced shield-piercing damage");
const quietKnifeGame = engine.createInitialGame(nyxParty, engine.createAdventure("QUIET-KNIFE-DAMAGE"), 30);
quietKnifeGame.turnOrder = [nyx.id, nyxTarget.id];
quietKnifeGame.adventure.target = 8;
quietKnifeGame.playerStates[nyx.id].hand = [quietKnife.id];
quietKnifeGame.playerStates[nyxTarget.id].shield = 10;
const quietKnifeResult = engine.resolveCardTurn(quietKnifeGame, nyxParty, quietKnife.id, nyxTarget.id, 20);
assert.equal(quietKnifeResult.outcome.amount, 3, "Quiet Knife deals exactly 3 HP damage through Armor Pierce");
assert.equal(quietKnifeResult.playerStates[nyxTarget.id].hp, nyxTarget.hero.maxHp - 3, "Quiet Knife reduces target HP by its new base damage");
assert.equal(quietKnifeResult.playerStates[nyxTarget.id].shield, 10, "Quiet Knife ignores shield without consuming it");
const executeGame = engine.createInitialGame(nyxParty, engine.createAdventure("EXECUTE-DAMAGE"), 30);
executeGame.turnOrder = [nyx.id, nyxTarget.id];
executeGame.adventure.target = 8;
executeGame.playerStates[nyx.id].hand = [execute.id];
executeGame.playerStates[nyxTarget.id].shield = 10;
const executeResult = engine.resolveCardTurn(executeGame, nyxParty, execute.id, nyxTarget.id, 20);
assert.equal(executeResult.outcome.amount, 4, "Execute deals exactly 4 HP damage through Armor Pierce");
assert.equal(executeResult.playerStates[nyxTarget.id].hp, nyxTarget.hero.maxHp - 4, "Execute reduces target HP by its new base damage");
assert.equal(executeResult.playerStates[nyxTarget.id].shield, 10, "Execute ignores shield without consuming it");

const kael = engine.createPlayerSession("Kael", 0, "Kael Rook", "kael-damage");
const kaelTarget = engine.createPlayerSession("No Guard target", 1, "Bram Coalhand", "kael-target");
const kaelParty = [kael, kaelTarget];
const riposte = kael.skillDeck.find((card) => card.id === "kr-riposte");
const challenge = kael.skillDeck.find((card) => card.id === "kr-duel");
assert.equal(riposte.value, 3, "Riposte has 3 base damage");
assert.equal(challenge.value, 3, "Challenge has 3 base damage");
assert.equal(riposte.pityCost, 6, "Riposte's pity cost accounts for its No Guard damage ceiling");
assert.equal(challenge.pityCost, 6, "Challenge's pity cost accounts for its No Guard damage ceiling");
assert.match(kael.hero.passiveText, /\+2 damage.*enemies with no shield/i, "No Guard states its target-based condition and damage");
assert.match(riposte.description, /3 damage.*5 with No Guard.*target has no shield/i, "Riposte describes its base and No Guard damage");
assert.match(challenge.description, /3 damage.*5 with No Guard.*target has no shield/i, "Challenge describes its base and No Guard damage");
const challengeOpenGame = engine.createInitialGame(kaelParty, engine.createAdventure("CHALLENGE-NO-SHIELD"), 30);
challengeOpenGame.turnOrder = [kael.id, kaelTarget.id];
challengeOpenGame.adventure.target = 8;
challengeOpenGame.playerStates[kael.id].shield = 4;
challengeOpenGame.playerStates[kael.id].hand = [challenge.id];
const challengeOpenResult = engine.resolveCardTurn(challengeOpenGame, kaelParty, challenge.id, kaelTarget.id, 20);
assert.equal(challengeOpenResult.outcome.amount, 5, "Challenge deals 3 base plus 2 No Guard damage to an unshielded enemy");
assert.equal(challengeOpenResult.playerStates[kaelTarget.id].hp, kaelTarget.hero.maxHp - 5, "No Guard depends on the target's shield rather than Kael's shield");
const challengeShieldedGame = engine.createInitialGame(kaelParty, engine.createAdventure("CHALLENGE-SHIELDED"), 30);
challengeShieldedGame.turnOrder = [kael.id, kaelTarget.id];
challengeShieldedGame.adventure.target = 8;
challengeShieldedGame.playerStates[kael.id].hand = [challenge.id];
challengeShieldedGame.playerStates[kaelTarget.id].shield = 2;
const challengeShieldedResult = engine.resolveCardTurn(challengeShieldedGame, kaelParty, challenge.id, kaelTarget.id, 20);
assert.equal(challengeShieldedResult.outcome.amount, 1, "a shielded enemy receives no No Guard bonus before shield blocks Challenge");
assert.equal(challengeShieldedResult.playerStates[kaelTarget.id].shield, 0, "Challenge's 3 base damage removes the target's 2 shield normally");
const riposteOpenGame = engine.createInitialGame(kaelParty, engine.createAdventure("RIPOSTE-NO-SHIELD"), 30);
riposteOpenGame.turnOrder = [kael.id, kaelTarget.id];
riposteOpenGame.adventure.target = 8;
riposteOpenGame.playerStates[kael.id].hand = [riposte.id];
const riposteOpenResult = engine.resolveCardTurn(riposteOpenGame, kaelParty, riposte.id, kaelTarget.id, 20);
assert.equal(riposteOpenResult.outcome.amount, 5, "the updated No Guard passive also adds 2 damage to Riposte against an unshielded enemy");

const healer = engine.createPlayerSession("Orren", 0, "Brother Orren", "healer");
const supportAlly = engine.createPlayerSession("Support ally", 2, "Elara Voss", "support-ally");
const supportEnemy = engine.createPlayerSession("Support enemy", 1, "Thorne Vale", "support-enemy");
const supportParty = [healer, supportEnemy, supportAlly];
const prayerOfLife = healer.skillDeck.find((card) => card.id === "bo-prayer");
const sharedBlessing = healer.skillDeck.find((card) => card.id === "bo-blessing");
const orrenCommonHeal = healer.skillDeck.find((card) => !card.unique && card.effect === "heal");
assert.match(healer.hero.passiveText, /Orren's Heal cards restore \+1 HP/i, "Enduring Grace grants exactly +1 HP to Orren's Heal cards");
assert.equal(prayerOfLife.value, 3, "Prayer of Life restores 3 base HP");
assert.equal(prayerOfLife.pityCost, 5, "Prayer of Life follows the Heal-card pity formula after its reduction");
assert.match(prayerOfLife.description, /3 HP.*4 with Enduring Grace/i, "Prayer of Life describes its base and passive-enhanced healing");
assert.equal(sharedBlessing.effect, "heal", "Shared Blessing is a Heal card");
assert.equal(sharedBlessing.supportType, undefined, "Shared Blessing no longer carries a Support subtype");
assert.equal(sharedBlessing.value, 2, "Shared Blessing keeps its 2 base healing");
assert.equal(sharedBlessing.pityCost, 6, "Shared Blessing's pity cost accounts for healing every living ally");
assert.match(sharedBlessing.description, /2 HP.*3 with Enduring Grace/i, "Shared Blessing describes its base and passive-enhanced healing");
assert.equal(cardRules.getCardEffectLabel(sharedBlessing), "Heal all allies", "Shared Blessing's player-facing action type matches its all-allies Heal effect");
const healGame = engine.createInitialGame(supportParty, engine.createAdventure("HEAL"), 30);
healGame.turnOrder = [healer.id, supportEnemy.id, supportAlly.id];
healGame.playerStates[healer.id].hand = [prayerOfLife.id];
healGame.playerStates[supportAlly.id].hp = 1;
const allyHealed = engine.resolveCardTurn(healGame, supportParty, prayerOfLife.id, supportAlly.id, 20);
assert.equal(allyHealed.outcome.amount, 4, "Enduring Grace raises Prayer of Life from 3 to 4 restored HP");
assert.equal(allyHealed.playerStates[supportAlly.id].hp, 5, "Prayer of Life restores the chosen ally with its updated passive bonus");
assert.equal(allyHealed.playerStates[healer.id].hp, healer.hero.maxHp, "ally heal does not redirect to the caster");

const commonHealGame = engine.createInitialGame(supportParty, engine.createAdventure("ORREN-COMMON-HEAL"), 30);
commonHealGame.turnOrder = [healer.id, supportEnemy.id, supportAlly.id];
commonHealGame.playerStates[healer.id].hp = 1;
commonHealGame.playerStates[healer.id].hand = [orrenCommonHeal.id];
const commonHealed = engine.resolveCardTurn(commonHealGame, supportParty, orrenCommonHeal.id, healer.id, 20);
assert.equal(commonHealed.outcome.amount, orrenCommonHeal.value + 1, "Enduring Grace also strengthens Orren's common Heal card");
assert.equal(commonHealed.playerStates[healer.id].hp, 1 + orrenCommonHeal.value + 1, "Orren's common Heal card applies the passive in real resolution");

const tank = engine.createPlayerSession("Bram", 0, "Bram Coalhand", "tank");
const tankAlly = engine.createPlayerSession("Tank ally", 2, "Mira Ash", "tank-ally");
const tankEnemy = engine.createPlayerSession("Tank enemy", 1, "Nyx Calder", "tank-enemy");
const tankParty = [tank, tankEnemy, tankAlly];
const livingFortress = tank.skillDeck.find((card) => card.id === "bc-fortress");
const temperArmor = tank.skillDeck.find((card) => card.id === "bc-temper");
const shieldforgedAssault = tank.skillDeck.find((card) => card.id === "bc-march");
const bramBrace = tank.skillDeck.find((card) => !card.unique && card.effect === "guard");
assert.match(tank.hero.passiveText, /shield from Bram's Guard cards lasts for 2 turns/i, "Tempered Steel states its two-turn Guard duration");
assert.equal(livingFortress.value, 4, "Living Fortress grants 4 base shield");
assert.equal(livingFortress.pityCost, 6, "Living Fortress follows the Guard-card pity formula after its shield reduction");
assert.equal(temperArmor.effect, "guard", "Temper Armor is a Guard card");
assert.equal(temperArmor.supportType, undefined, "Temper Armor no longer carries a Support subtype");
assert.equal(temperArmor.value, 3, "Temper Armor grants 3 base shield");
assert.equal(temperArmor.pityCost, 7, "Temper Armor's pity cost accounts for team-wide, two-turn shield");
assert.match(bramBrace.description, /expires at the end of your second turn/i, "Bram's common Guard card describes Tempered Steel's duration");
assert.equal(shieldforgedAssault.name, "Shieldforged Assault", "Fortified March is renamed to match its shield conversion effect");
assert.equal(shieldforgedAssault.supportType, "shield-to-attack", "Shieldforged Assault uses the shield conversion rule");
assert.equal(shieldforgedAssault.target, "self", "Shieldforged Assault targets only Bram");
assert.equal(shieldforgedAssault.value, 0, "Shieldforged Assault derives its strength from current shield instead of a flat value");
assert.equal(shieldforgedAssault.pityCost, 6, "Shieldforged Assault's pity cost accounts for its self-only shield conversion");
assert.equal(shieldforgedAssault.failureEffect, "lose-shield", "Shieldforged Assault risks the shield it attempts to convert");
assert.equal(shieldforgedAssault.failureValue, 2, "Shieldforged Assault loses up to 2 shield on failure");
assert.equal(cardRules.getCardEffectLabel(shieldforgedAssault), "Empower yourself", "Shieldforged Assault's player-facing action type matches its self-only effect");
assert.match(shieldforgedAssault.description, /half.*your current shield.*rounded down.*equal attack damage bonus.*your next attack.*your next turn/i, "Shieldforged Assault fully describes its self-only conversion, rounding, use, and expiry");
const guardGame = engine.createInitialGame(tankParty, engine.createAdventure("GUARD"), 30);
guardGame.turnOrder = [tank.id, tankEnemy.id, tankAlly.id];
guardGame.playerStates[tank.id].hand = [livingFortress.id];
const allyGuarded = engine.resolveCardTurn(guardGame, tankParty, livingFortress.id, tankAlly.id, 20);
assert.equal(allyGuarded.outcome.amount, 4, "Tempered Steel no longer increases Guard shield strength");
assert.equal(allyGuarded.playerStates[tankAlly.id].shield, 4, "Living Fortress grants its updated 4 shield to the chosen ally");
engine.expireTimedEffectsAtTurnEnd(allyGuarded.playerStates[tankAlly.id]);
assert.equal(allyGuarded.playerStates[tankAlly.id].shield, 4, "Bram's Guard shield remains after the target's first turn");
engine.expireTimedEffectsAtTurnEnd(allyGuarded.playerStates[tankAlly.id]);
assert.equal(allyGuarded.playerStates[tankAlly.id].shield, 0, "Bram's Guard shield expires after the target's second turn");

const bramBraceGame = engine.createInitialGame(tankParty, engine.createAdventure("BRAM-BRACE"), 30);
bramBraceGame.turnOrder = [tank.id, tankEnemy.id, tankAlly.id];
bramBraceGame.playerStates[tank.id].hand = [bramBrace.id];
const bramBraced = engine.resolveCardTurn(bramBraceGame, tankParty, bramBrace.id, tank.id, 20);
assert.equal(bramBraced.playerStates[tank.id].shield, 3, "Bram's common Guard card keeps its base shield value");
engine.expireTimedEffectsAtTurnEnd(bramBraced.playerStates[tank.id]);
assert.equal(bramBraced.playerStates[tank.id].shield, 3, "a self-applied Bram Guard remains through Bram's next turn");
engine.expireTimedEffectsAtTurnEnd(bramBraced.playerStates[tank.id]);
assert.equal(bramBraced.playerStates[tank.id].shield, 0, "a self-applied Bram Guard expires after Bram's second future turn");

const temperGame = engine.createInitialGame(tankParty, engine.createAdventure("TEMPER-ARMOR"), 30);
temperGame.turnOrder = [tank.id, tankEnemy.id, tankAlly.id];
temperGame.playerStates[tank.id].hand = [temperArmor.id];
const teamTempered = engine.resolveCardTurn(temperGame, tankParty, temperArmor.id, tank.id, 20);
assert.equal(teamTempered.outcome.effect, "guard", "Temper Armor resolves and synchronizes as a Guard card");
assert.equal(teamTempered.outcome.amount, 3, "Temper Armor resolves at 3 shield per target");
assert.deepEqual(teamTempered.outcome.targetIds.sort(), [tank.id, tankAlly.id].sort(), "Temper Armor targets every living ally, including Bram");
assert.equal(teamTempered.playerStates[tank.id].shield, 3, "Temper Armor shields Bram");
assert.equal(teamTempered.playerStates[tankAlly.id].shield, 3, "Temper Armor shields each living ally");
assert.equal(teamTempered.playerStates[tankEnemy.id].shield, 0, "Temper Armor never shields enemies");
assert.equal(teamTempered.playerStates[tankAlly.id].timedEffects.find((effect) => effect.kind === "shield").expiresAfterTurn - teamTempered.playerStates[tankAlly.id].completedPlayerTurns, 2, "Temper Armor shield remains for two target turns");

const conversionGame = engine.createInitialGame(tankParty, engine.createAdventure("SHIELDFORGED-ASSAULT"), 30);
conversionGame.turnOrder = [tank.id, tankEnemy.id, tankAlly.id];
conversionGame.adventure.target = 8;
conversionGame.playerStates[tank.id].hand = [shieldforgedAssault.id];
conversionGame.playerStates[tank.id].shield = 5;
conversionGame.playerStates[tank.id].timedEffects = [{ kind: "shield", value: 5, expiresAfterTurn: 10 }];
conversionGame.playerStates[tankAlly.id].shield = 8;
conversionGame.playerStates[tankAlly.id].timedEffects = [{ kind: "shield", value: 8, expiresAfterTurn: 10 }];
conversionGame.playerStates[tankEnemy.id].shield = 10;
conversionGame.playerStates[tankEnemy.id].timedEffects = [{ kind: "shield", value: 10, expiresAfterTurn: 10 }];
const shieldsForged = engine.resolveCardTurn(conversionGame, tankParty, shieldforgedAssault.id, tank.id, 20);
assert.equal(shieldsForged.outcome.amount, 2, "Shieldforged Assault reports only Bram's converted shield");
assert.deepEqual(shieldsForged.outcome.targetIds, [tank.id], "Shieldforged Assault synchronizes Bram as its only target");
assert.equal(shieldsForged.playerStates[tank.id].shield, 3, "Shieldforged Assault rounds Bram's odd shield down before conversion");
assert.equal(shieldsForged.playerStates[tank.id].attackBuff, 2, "Bram gains attack damage equal to his converted shield");
assert.equal(shieldsForged.playerStates[tankAlly.id].shield, 8, "Shieldforged Assault preserves allied shield");
assert.equal(shieldsForged.playerStates[tankAlly.id].attackBuff, 0, "Shieldforged Assault never grants allies an attack bonus");
assert.equal(shieldsForged.playerStates[tankEnemy.id].shield, 10, "Shieldforged Assault never converts enemy shield");
assert.equal(shieldsForged.playerStates[tankEnemy.id].attackBuff, 0, "Shieldforged Assault never buffs enemies");
const forgedBramAttack = tank.skillDeck.find((card) => card.effect === "damage");
shieldsForged.turnOrder = [tank.id, tankEnemy.id, tankAlly.id];
shieldsForged.adventure.target = 8;
shieldsForged.playerStates[tank.id].hand = [forgedBramAttack.id];
shieldsForged.playerStates[tankEnemy.id].shield = 0;
shieldsForged.playerStates[tankEnemy.id].timedEffects = [];
const forgedAttack = engine.resolveCardTurn(shieldsForged, tankParty, forgedBramAttack.id, tankEnemy.id, 20);
assert.equal(forgedAttack.playerStates[tankEnemy.id].hp, tankEnemy.hero.maxHp - forgedBramAttack.value - 2, "converted shield adds damage to Bram's next real attack");
assert.equal(forgedAttack.playerStates[tank.id].attackBuff, 0, "Bram's converted attack bonus is consumed by that attack");

const expiringConversionGame = structuredClone(conversionGame);
expiringConversionGame.playerStates[tank.id].hand = [shieldforgedAssault.id];
const expiringConversion = engine.resolveCardTurn(expiringConversionGame, tankParty, shieldforgedAssault.id, tank.id, 20);
assert.equal(expiringConversion.playerStates[tank.id].attackBuff, 2, "Bram's unused converted attack bonus remains through the turn it is created");
engine.expireTimedEffectsAtTurnEnd(expiringConversion.playerStates[tank.id]);
assert.equal(expiringConversion.playerStates[tank.id].attackBuff, 0, "Bram's unused converted attack bonus expires at the end of his next turn");

const failedConversionGame = structuredClone(conversionGame);
failedConversionGame.adventure.target = 20;
failedConversionGame.playerStates[tank.id].hand = [shieldforgedAssault.id];
const failedConversion = engine.resolveCardTurn(failedConversionGame, tankParty, shieldforgedAssault.id, tank.id, 1);
assert.equal(failedConversion.outcome.success, false, "a failed Shieldforged Assault performs no conversion");
assert.equal(failedConversion.playerStates[tank.id].shield, 3, "failed conversion removes up to 2 of Bram's shield");
assert.equal(failedConversion.playerStates[tankAlly.id].shield, 8, "failed conversion preserves allied shield");
assert.equal(failedConversion.playerStates[tank.id].attackBuff, 0, "failed conversion grants no attack bonus");
assert.equal(failedConversion.playerStates[tank.id].hp, tank.hero.maxHp, "Shieldforged Assault failure no longer damages Bram");
assert.equal(failedConversion.playerStates[tankAlly.id].hp, tankAlly.hero.maxHp, "Shieldforged Assault failure no longer damages allies");

const teamHealGame = engine.createInitialGame(supportParty, engine.createAdventure("TEAM-HEAL"), 30);
teamHealGame.turnOrder = [healer.id, supportEnemy.id, supportAlly.id];
teamHealGame.playerStates[healer.id].hand = [sharedBlessing.id];
teamHealGame.playerStates[healer.id].hp = 5;
teamHealGame.playerStates[supportAlly.id].hp = 2;
const teamHealed = engine.resolveCardTurn(teamHealGame, supportParty, sharedBlessing.id, healer.id, 20);
assert.equal(teamHealed.outcome.effect, "heal", "Shared Blessing resolves and synchronizes as a Heal card");
assert.equal(teamHealed.outcome.amount, 6, "Shared Blessing reports the total HP restored across both living allies");
assert.deepEqual(teamHealed.outcome.targetIds.sort(), [healer.id, supportAlly.id].sort(), "Shared Blessing targets every living ally, including Orren");
assert.equal(teamHealed.playerStates[healer.id].hp, 8, "Shared Blessing restores 3 HP to Orren with Enduring Grace");
assert.equal(teamHealed.playerStates[supportAlly.id].hp, 5, "Shared Blessing restores 3 HP to each living ally");
assert.equal(teamHealed.playerStates[supportEnemy.id].hp, supportEnemy.hero.maxHp, "Shared Blessing never heals enemies");

const cappedBlessingGame = engine.createInitialGame(supportParty, engine.createAdventure("CAPPED-SHARED-BLESSING"), 30);
cappedBlessingGame.turnOrder = [healer.id, supportEnemy.id, supportAlly.id];
cappedBlessingGame.playerStates[healer.id].hand = [sharedBlessing.id];
cappedBlessingGame.playerStates[healer.id].hp = healer.hero.maxHp - 1;
cappedBlessingGame.playerStates[supportAlly.id].hp = supportAlly.hero.maxHp - 2;
const cappedBlessing = engine.resolveCardTurn(cappedBlessingGame, supportParty, sharedBlessing.id, healer.id, 20);
assert.equal(cappedBlessing.playerStates[healer.id].hp, healer.hero.maxHp, "Shared Blessing cannot heal Orren above max HP");
assert.equal(cappedBlessing.playerStates[supportAlly.id].hp, supportAlly.hero.maxHp, "Shared Blessing cannot heal an ally above max HP");
assert.equal(cappedBlessing.outcome.amount, 3, "Shared Blessing reports only HP actually restored when targets are capped");

const failedBlessingGame = engine.createInitialGame(supportParty, engine.createAdventure("FAILED-SHARED-BLESSING"), 30);
failedBlessingGame.turnOrder = [healer.id, supportEnemy.id, supportAlly.id];
failedBlessingGame.adventure.target = 20;
failedBlessingGame.playerStates[healer.id].hand = [sharedBlessing.id];
failedBlessingGame.playerStates[healer.id].hp = 5;
failedBlessingGame.playerStates[supportAlly.id].hp = 2;
const failedBlessing = engine.resolveCardTurn(failedBlessingGame, supportParty, sharedBlessing.id, healer.id, 1);
assert.equal(failedBlessing.outcome.success, false, "a failed Shared Blessing grants no healing");
assert.equal(failedBlessing.playerStates[healer.id].hp, 4, "Shared Blessing retains its 1 team-damage failure for Orren");
assert.equal(failedBlessing.playerStates[supportAlly.id].hp, 1, "Shared Blessing failure damages every living ally instead of healing them");
assert.equal(failedBlessing.playerStates[supportEnemy.id].hp, supportEnemy.hero.maxHp, "Shared Blessing failure never damages enemies");

const commander = engine.createPlayerSession("Ione", 0, "Ione Mire", "commander");
const diceAlly = engine.createPlayerSession("Dice ally", 2, "Dagan Flint", "dice-ally");
const diceEnemy = engine.createPlayerSession("Dice enemy", 1, "Kael Rook", "dice-enemy");
const diceParty = [commander, diceEnemy, diceAlly];
const diceGame = engine.createInitialGame(diceParty, engine.createAdventure("DICE"), 30);
diceGame.turnOrder = [commander.id, diceEnemy.id, diceAlly.id];
const diceCard = commander.skillDeck.find((card) => card.supportType === "dice");
assert.equal(diceCard.name, "Focus Order", "Focus Order is the only allied d20 buff card");
diceGame.playerStates[commander.id].hand = [diceCard.id];
const diceBuffed = engine.resolveCardTurn(diceGame, diceParty, diceCard.id, commander.id, 20);
assert.equal(diceBuffed.playerStates[commander.id].diceBuff, 2);
assert.equal(diceBuffed.playerStates[diceAlly.id].diceBuff, 2);
assert.equal(diceBuffed.playerStates[diceEnemy.id].diceBuff, 0);
const allyAttack = diceAlly.skillDeck.find((card) => card.effect === "damage");
diceBuffed.activePlayerIndex = 2;
diceBuffed.turnOrder = [diceAlly.id, commander.id, diceEnemy.id];
diceBuffed.adventure.target = 12;
diceBuffed.playerStates[diceAlly.id].hand = [allyAttack.id];
const boostedRoll = engine.resolveCardTurn(diceBuffed, diceParty, allyAttack.id, diceEnemy.id, 10);
assert.equal(boostedRoll.outcome.total, 10 + engine.getPassiveDiceBonus(diceAlly, allyAttack, diceBuffed.playerStates[diceAlly.id]) + 2);
assert.doesNotMatch(boostedRoll.history.at(-1).message, /\+ bonus|- penalty/, "shared history prose does not expose a player's dice modifier");
assert.equal(boostedRoll.playerStates[diceAlly.id].diceBuff, 0, "next-turn d20 bonus is consumed after one roll");
assert.equal(engine.getPassiveDiceBonus(commander, commander.skillDeck.find((card) => card.effect === "none"), diceBuffed.playerStates[commander.id]), 1, "Ione adds +1 to every d20 result");

const oracle = engine.createPlayerSession("Sable", 0, "Sable Fen", "oracle");
const cursedEnemy = engine.createPlayerSession("Cursed enemy", 1, "Thorne Vale", "cursed-enemy");
const oracleAlly = engine.createPlayerSession("Oracle ally", 2, "Dagan Flint", "oracle-ally");
const curseParty = [oracle, cursedEnemy, oracleAlly];
const favorableOmen = oracle.skillDeck.find((card) => card.id === "sf-favor");
assert.equal(favorableOmen.supportType, "zero-pity", "Favorable Omen grants a zero-pity card instead of shield or a d20 modifier");
assert.equal(favorableOmen.target, "ally", "Favorable Omen chooses one living ally, including Sable Fen");
assert.match(favorableOmen.description, /living ally.*including yourself.*next card.*next turn.*0 pity.*expires.*end of that turn/i, "Favorable Omen's description explains its complete updated effect");
assert.doesNotMatch(favorableOmen.description, /third use|graveyard/i, "Favorable Omen no longer describes a use limit");
const favorableGame = engine.createInitialGame(curseParty, engine.createAdventure("FAVOR"), 30);
favorableGame.turnOrder = [oracle.id, cursedEnemy.id, oracleAlly.id];
favorableGame.playerStates[oracle.id].hand = [favorableOmen.id];
const favorableResult = engine.resolveCardTurn(favorableGame, curseParty, favorableOmen.id, oracleAlly.id, 20);
assert.equal(favorableResult.playerStates[oracle.id].diceBuff, 0, "Favorable Omen cannot create a d20 buff");
assert.equal(favorableResult.playerStates[oracleAlly.id].diceBuff, 0, "Favorable Omen cannot create allied d20 buffs");
assert.equal(favorableResult.playerStates[oracle.id].shield, 0, "Favorable Omen no longer creates shield");
assert.equal(favorableResult.playerStates[oracleAlly.id].zeroPityUntilTurn, 1, "the chosen ally receives a zero-pity card for their next turn");
const skippedOmenState = structuredClone(favorableResult.playerStates[oracleAlly.id]);
engine.expireTimedEffectsAtTurnEnd(skippedOmenState);
assert.equal(skippedOmenState.zeroPityUntilTurn, 0, "Favorable Omen expires if the chosen ally's next turn ends without a card play");
favorableResult.turnOrder = [oracleAlly.id, cursedEnemy.id, oracle.id];
favorableResult.activePlayerIndex = curseParty.findIndex((player) => player.id === oracleAlly.id);
favorableResult.adventure.target = 16;
const omenAttack = oracleAlly.skillDeck.find((card) => card.effect === "damage" && card.pityCost > 0);
favorableResult.playerStates[oracleAlly.id].hand = [omenAttack.id];
const omenPlayed = engine.resolveCardTurn(favorableResult, curseParty, omenAttack.id, cursedEnemy.id, 1);
assert.equal(omenPlayed.outcome.success, true, "the chosen ally's next played card succeeds automatically at 0 pity cost");
assert.equal(omenPlayed.outcome.pityCost, 0, "Favorable Omen changes the next played card's effective pity cost to 0");
assert.equal(omenPlayed.playerStates[oracleAlly.id].pityPoints, 0, "a Favorable Omen card neither spends nor gains pity");
assert.equal(omenPlayed.playerStates[oracleAlly.id].zeroPityUntilTurn, 0, "Favorable Omen is consumed when the next card is played");

const failedFavorableGame = engine.createInitialGame(curseParty, engine.createAdventure("FAILED-FAVORABLE-OMEN"), 30);
failedFavorableGame.turnOrder = [oracle.id, cursedEnemy.id, oracleAlly.id];
failedFavorableGame.adventure.target = 20;
failedFavorableGame.playerStates[oracle.id].hp = 5;
failedFavorableGame.playerStates[oracle.id].hand = [favorableOmen.id];
const failedFavorable = engine.resolveCardTurn(failedFavorableGame, curseParty, favorableOmen.id, oracleAlly.id, 1);
assert.equal(failedFavorable.outcome.success, false, "a failed Favorable Omen grants no zero-pity effect");
assert.equal(failedFavorable.playerStates[oracleAlly.id].zeroPityUntilTurn, 0, "Favorable Omen cannot affect its target on failure");
assert.equal(failedFavorable.playerStates[oracle.id].hp, 3, "Favorable Omen applies its rebalanced 2 self-damage failure");

const selfFavorableGame = engine.createInitialGame(curseParty, engine.createAdventure("FAVOR-SELF"), 30);
selfFavorableGame.turnOrder = [oracle.id, cursedEnemy.id, oracleAlly.id];
selfFavorableGame.playerStates[oracle.id].hand = [favorableOmen.id];
const selfFavored = engine.resolveCardTurn(selfFavorableGame, curseParty, favorableOmen.id, oracle.id, 20);
assert.equal(selfFavored.playerStates[oracle.id].completedPlayerTurns, 1);
assert.equal(selfFavored.playerStates[oracle.id].zeroPityUntilTurn, 2, "self-targeted Favorable Omen survives its casting turn and applies on Sable's next turn");
selfFavored.turnOrder = [oracle.id, cursedEnemy.id, oracleAlly.id];
selfFavored.activePlayerIndex = 0;
selfFavored.adventure.target = 16;
const selfOmenCard = oracle.skillDeck.find((card) => card.id === "sf-hex");
selfFavored.playerStates[oracle.id].hand = [selfOmenCard.id];
const selfOmenPlayed = engine.resolveCardTurn(selfFavored, curseParty, selfOmenCard.id, cursedEnemy.id, 1);
assert.equal(selfOmenPlayed.outcome.success, true, "Sable can choose herself for Favorable Omen");
assert.equal(selfOmenPlayed.outcome.pityCost, 0);
assert.equal(selfOmenPlayed.playerStates[oracle.id].zeroPityUntilTurn, 0);

let favorableUseGame = engine.createInitialGame(curseParty, engine.createAdventure("FAVOR-USES"), 30);
const favorableReplacements = oracle.skillDeck.filter((card) => !card.unique).slice(0, 4).map((card) => card.id);
favorableUseGame.playerStates[oracle.id].drawPile = [...favorableReplacements];
favorableUseGame.playerStates[oracle.id].discardPile = [];
favorableUseGame.playerStates[oracle.id].graveyard = [];
for (let use = 1; use <= 4; use += 1) {
  favorableUseGame.turnOrder = [oracle.id, cursedEnemy.id, oracleAlly.id];
  favorableUseGame.activePlayerIndex = 0;
  favorableUseGame.playerStates[oracle.id].hand = [favorableOmen.id];
  favorableUseGame.playerStates[oracle.id].discardPile = favorableUseGame.playerStates[oracle.id].discardPile.filter((id) => id !== favorableOmen.id);
  favorableUseGame = engine.resolveCardTurn(favorableUseGame, curseParty, favorableOmen.id, oracleAlly.id, 20);
  assert.equal(favorableUseGame.playerStates[oracle.id].cardUses[favorableOmen.id], use);
  assert(!favorableUseGame.playerStates[oracle.id].graveyard.includes(favorableOmen.id), `Favorable Omen remains reusable after use ${use}`);
}
assert(favorableUseGame.playerStates[oracle.id].discardPile.includes(favorableOmen.id), "Favorable Omen returns to discard normally after repeated use");
const curseGame = engine.createInitialGame(curseParty, engine.createAdventure("CURSE"), 30);
curseGame.turnOrder = [oracle.id, cursedEnemy.id, oracleAlly.id];
const curseCard = oracle.skillDeck.find((card) => card.supportType === "enemy-dice");
assert.equal(curseCard.name, "Dark Omen");
curseGame.playerStates[oracle.id].hand = [curseCard.id];
const cursed = engine.resolveCardTurn(curseGame, curseParty, curseCard.id, cursedEnemy.id, 20);
assert.equal(cursed.playerStates[cursedEnemy.id].dicePenalty, 3);
const cursedAttack = cursedEnemy.skillDeck.find((card) => card.effect === "damage");
cursed.adventure.target = 10;
cursed.playerStates[cursedEnemy.id].hand = [cursedAttack.id];
const penalizedRoll = engine.resolveCardTurn(cursed, curseParty, cursedAttack.id, oracle.id, 10);
assert.equal(penalizedRoll.outcome.total, 10 + engine.getPassiveDiceBonus(cursedEnemy, cursedAttack, cursed.playerStates[cursedEnemy.id]) - 3);
assert.equal(penalizedRoll.history.at(-1).dicePenalty, 3);
assert.equal(penalizedRoll.playerStates[cursedEnemy.id].dicePenalty, 0, "enemy d20 penalty is consumed after one turn");

const sableReviveGame = engine.createInitialGame(curseParty, engine.createAdventure("SECOND-SIGHT"), 30);
sableReviveGame.playerStates[oracle.id].hp = 1;
sableReviveGame.turnOrder = [cursedEnemy.id, oracle.id, oracleAlly.id];
sableReviveGame.activePlayerIndex = 1;
sableReviveGame.playerStates[cursedEnemy.id].hand = [cursedAttack.id];
const sableRevived = engine.resolveCardTurn(sableReviveGame, curseParty, cursedAttack.id, oracle.id, 20);
assert.equal(sableRevived.playerStates[oracle.id].hp, Math.ceil(oracle.hero.maxHp / 2), "Sable revives with half max HP");
assert.equal(sableRevived.playerStates[oracle.id].passiveReviveUsed, true, "Sable's passive revive is consumed once");
assert.deepEqual(sableRevived.outcome.lifeEvents.map((event) => event.kind), ["defeat", "revive"], "Second Sight queues the defeat panel before the revival panel");
assert.match(sableRevived.outcome.lifeEvents[1].reason, /Second Sight.*half HP/, "the revival panel explains Sable's passive");
sableRevived.playerStates[oracle.id].hp = 1;
sableRevived.turnOrder = [cursedEnemy.id, oracle.id, oracleAlly.id];
sableRevived.activePlayerIndex = 1;
sableRevived.playerStates[cursedEnemy.id].hand = [cursedAttack.id];
const sableDefeatedAgain = engine.resolveCardTurn(sableRevived, curseParty, cursedAttack.id, oracle.id, 20);
assert.equal(sableDefeatedAgain.playerStates[oracle.id].hp, 0, "Sable cannot trigger Second Sight twice");

const commanderGame = engine.createInitialGame([first, second, supportAlly], engine.createAdventure("ADVANCE"), 30);
commanderGame.turnOrder = [first.id, second.id, supportAlly.id];
const advanceCard = first.skillDeck.find((card) => card.supportType === "advance-ally");
commanderGame.playerStates[first.id].hand = [advanceCard.id];
const advanced = engine.resolveCardTurn(commanderGame, [first, second, supportAlly], advanceCard.id, supportAlly.id, 20);
assert.equal(advanced.turnOrder[0], supportAlly.id, "chosen ally moves to the next turn");

const trickster = engine.createPlayerSession("Nyx", 0, "Nyx Calder", "trickster");
const delayedEnemy = engine.createPlayerSession("Stolen enemy", 1, "Thorne Vale", "delayed-enemy");
const tricksterAlly = engine.createPlayerSession("Nyx ally", 2, "Mira Ash", "trickster-ally");
const delayParty = [trickster, delayedEnemy, tricksterAlly];
const delayGame = engine.createInitialGame(delayParty, engine.createAdventure("DELAY"), 30);
const stealCard = trickster.skillDeck.find((card) => card.supportType === "steal-card");
assert.match(stealCard.description, /random card.*hand.*preferring special cards.*discard pile.*Nyx's next turn ends/i, "Pilfered Chance's description explains its complete updated effect");
const stolenSpecial = delayedEnemy.skillDeck.find((card) => card.unique);
const fallbackCommon = delayedEnemy.skillDeck.find((card) => !card.unique);
const tricksterCommon = trickster.skillDeck.find((card) => !card.unique && card.effect === "none");
delayGame.playerStates[trickster.id].hand = [stealCard.id];
delayGame.playerStates[trickster.id].drawPile = [tricksterCommon.id];
delayGame.playerStates[trickster.id].discardPile = [];
delayGame.playerStates[delayedEnemy.id].hand = [stolenSpecial.id, fallbackCommon.id];
delayGame.playerStates[delayedEnemy.id].drawPile = [];
delayGame.playerStates[delayedEnemy.id].discardPile = [];
const stolen = engine.resolveCardTurn(delayGame, delayParty, stealCard.id, delayedEnemy.id, 20);
assert(stolen.playerStates[trickster.id].hand.includes(stolenSpecial.id), "Pilfered Chance prefers a special card from the enemy hand");
assert(stolen.playerStates[delayedEnemy.id].hand.includes(fallbackCommon.id), "a common card remains when a special card is available");
assert(!stolen.playerStates[delayedEnemy.id].hand.includes(stolenSpecial.id), "the stolen special card leaves the enemy hand");
assert.equal(stolen.playerStates[trickster.id].borrowedCards[0].ownerId, delayedEnemy.id);
assert.equal(stolen.playerStates[trickster.id].borrowedCards[0].expiresAfterBorrowerTurn, 2, "the stolen card is tied to the end of Nyx's next turn");
stolen.turnOrder = [delayedEnemy.id, tricksterAlly.id, trickster.id];
stolen.activePlayerIndex = 1;
const targetAction = fallbackCommon;
stolen.playerStates[delayedEnemy.id].hand = [targetAction.id];
const afterTargetTurn = engine.resolveCardTurn(stolen, delayParty, targetAction.id, trickster.id, 20);
assert(afterTargetTurn.playerStates[trickster.id].hand.includes(stolenSpecial.id), "the target's turn does not return the stolen card");
afterTargetTurn.turnOrder = [trickster.id, tricksterAlly.id, delayedEnemy.id];
afterTargetTurn.activePlayerIndex = 0;
const nyxNextCard = afterTargetTurn.playerStates[trickster.id].hand.find((id) => id !== stolenSpecial.id) ?? tricksterCommon.id;
afterTargetTurn.playerStates[trickster.id].hand = [nyxNextCard, stolenSpecial.id];
const returned = engine.resolveCardTurn(afterTargetTurn, delayParty, nyxNextCard, delayedEnemy.id, 20);
assert(!returned.playerStates[trickster.id].hand.includes(stolenSpecial.id), "an unplayed stolen card returns when Nyx's next turn ends");
assert(returned.playerStates[delayedEnemy.id].discardPile.includes(stolenSpecial.id), "the stolen card returns to the target's discard pile");
assert.equal(returned.playerStates[trickster.id].borrowedCards.length, 0);

const fallbackStealGame = engine.createInitialGame(delayParty, engine.createAdventure("STEAL-FALLBACK"), 30);
fallbackStealGame.turnOrder = [trickster.id, delayedEnemy.id, tricksterAlly.id];
fallbackStealGame.playerStates[trickster.id].hand = [stealCard.id];
fallbackStealGame.playerStates[delayedEnemy.id].hand = [fallbackCommon.id];
const fallbackStolen = engine.resolveCardTurn(fallbackStealGame, delayParty, stealCard.id, delayedEnemy.id, 20);
assert(fallbackStolen.playerStates[trickster.id].hand.includes(fallbackCommon.id), "Pilfered Chance falls back to a common card when no special card is in hand");

const revivalGame = engine.createInitialGame(supportParty, engine.createAdventure("REVIVE"), 30);
revivalGame.turnOrder = [healer.id, supportEnemy.id];
revivalGame.roundOrder = [supportAlly.id, supportEnemy.id, healer.id];
revivalGame.actedThisRound = [supportAlly.id, supportEnemy.id];
const reviveCard = healer.skillDeck.find((card) => card.supportType === "revive");
assert.match(reviveCard.description, /immediately.*one-third HP.*then.*graveyard/i, "Returning Light describes its immediate revival and one-use graveyard rule");
assert.doesNotMatch(reviveCard.description, /next turn|current phase/i, "Returning Light no longer promises the revived ally an immediate bonus turn");
revivalGame.playerStates[supportAlly.id].hp = 0;
revivalGame.playerStates[healer.id].hand = [reviveCard.id];
const revived = engine.resolveCardTurn(revivalGame, supportParty, reviveCard.id, supportAlly.id, 20);
assert.equal(revived.playerStates[supportAlly.id].reviveIn, 0, "Returning Light has no delayed countdown");
assert.equal(revived.playerStates[supportAlly.id].hp, Math.ceil(supportAlly.hero.maxHp / 3), "Returning Light immediately restores one-third max HP");
assert.equal(revived.turnOrder[0], supportEnemy.id, "Returning Light follows normal next-phase speed order instead of granting the revived ally the next turn");
assert.equal(revived.activePlayerIndex, supportParty.findIndex((player) => player.id === supportEnemy.id), "the normal fastest living player becomes active after the phase completes");
assert.equal(revived.completedPhases, revivalGame.completedPhases + 1, "reviving an ally who already acted does not reopen the completed phase");
assert.deepEqual(revived.roundOrder, [supportEnemy.id, healer.id, supportAlly.id], "the revived ally returns to normal speed order for the next phase");
assert(revived.playerStates[healer.id].graveyard.includes(reviveCard.id), "Returning Light enters the graveyard after its first use");
assert(![...revived.playerStates[healer.id].hand, ...revived.playerStates[healer.id].drawPile, ...revived.playerStates[healer.id].discardPile].includes(reviveCard.id), "graveyard cards cannot return to a reusable card zone");
const returningLightEvent = revived.outcome.lifeEvents.find((event) => event.playerId === supportAlly.id && event.kind === "revive");
assert(returningLightEvent, "Returning Light produces a synchronized revival event immediately");
assert.match(returningLightEvent.reason, /Returning Light.*one-third HP/i, "the revival panel explains the immediately restored HP");
assert.doesNotMatch(returningLightEvent.reason, /next turn/i, "the revival panel no longer claims an extra turn");

const waitingRevivalGame = engine.createInitialGame(supportParty, engine.createAdventure("REVIVE-WAIT-NORMAL-ORDER"), 30);
waitingRevivalGame.turnOrder = [healer.id, supportEnemy.id];
waitingRevivalGame.roundOrder = [supportEnemy.id, healer.id, supportAlly.id];
waitingRevivalGame.actedThisRound = [];
waitingRevivalGame.adventure.target = 8;
waitingRevivalGame.playerStates[supportAlly.id].hp = 0;
waitingRevivalGame.playerStates[healer.id].hand = [reviveCard.id];
const waitingRevived = engine.resolveCardTurn(waitingRevivalGame, supportParty, reviveCard.id, supportAlly.id, 20);
assert.equal(waitingRevived.turnOrder[0], supportEnemy.id, "a revived ally waits while the next unacted player takes their normal turn");
assert(waitingRevived.actedThisRound.includes(supportAlly.id), "the revived ally is not owed an extra turn during the current phase");
assert(waitingRevived.actedThisRound.includes(healer.id), "Orren's Returning Light still completes Orren's own turn");
const enemyPhaseCard = supportEnemy.skillDeck.find((card) => card.effect === "none");
waitingRevived.playerStates[supportEnemy.id].hand = [enemyPhaseCard.id];
const phaseAfterRevival = engine.resolveCardTurn(waitingRevived, supportParty, enemyPhaseCard.id, supportEnemy.id, 20);
assert.equal(phaseAfterRevival.completedPhases, waitingRevivalGame.completedPhases + 1, "the phase completes without duplicate turns after Returning Light");
assert.deepEqual(phaseAfterRevival.turnOrder, [supportEnemy.id, healer.id, supportAlly.id], "the revived ally rejoins normal speed order in the next phase");

const noTargetGame = engine.createInitialGame([healer, supportEnemy], engine.createAdventure("NO-TARGET"), 30);
noTargetGame.turnOrder = [healer.id, supportEnemy.id];
noTargetGame.playerStates[healer.id].hand = [reviveCard.id];
const noTarget = engine.resolveCardTurn(noTargetGame, [healer, supportEnemy], reviveCard.id, undefined, 20);
assert.match(noTarget.outcome.detail, /no valid target/i, "a targeted card succeeds with no effect when no valid target exists");

const oracleControl = engine.createPlayerSession("Sable", 0, "Sable Fen", "oracle-control");
const controlEnemy = engine.createPlayerSession("Control enemy", 1, "Kael Rook", "control-enemy");
const controlGame = engine.createInitialGame([oracleControl, controlEnemy], engine.createAdventure("SKIP"), 30);
controlGame.turnOrder = [oracleControl.id, controlEnemy.id];
const skipEnemyCard = oracleControl.skillDeck.find((card) => card.supportType === "skip-enemy");
controlGame.playerStates[oracleControl.id].hand = [skipEnemyCard.id];
const controlled = engine.resolveCardTurn(controlGame, [oracleControl, controlEnemy], skipEnemyCard.id, controlEnemy.id, 20);
assert.equal(controlled.playerStates[controlEnemy.id].skipTurns, 1, "oracle can cancel exactly one upcoming enemy turn");

const commanderPurge = engine.createInitialGame([commander, diceEnemy], engine.createAdventure("PURGE"), 30);
commanderPurge.turnOrder = [commander.id, diceEnemy.id];
const purgeCard = commander.skillDeck.find((card) => card.supportType === "purge-card");
assert.equal(purgeCard.target, "enemy", "Tactical Purge only exposes living enemies as targets");
assert.match(purgeCard.description, /random card.*hand.*graveyard.*2 phases.*draw pile.*third use/i, "Tactical Purge's description explains its complete updated effect");
const purgedEnemyCards = diceEnemy.skillDeck.filter((card) => card.unique);
const purgeReplacement = diceEnemy.skillDeck.find((card) => !card.unique && card.effect === "none");
const commanderBlank = commander.skillDeck.find((card) => !card.unique && card.effect === "none");
commanderPurge.playerStates[commander.id].hand = [purgeCard.id];
commanderPurge.playerStates[commander.id].drawPile = [commanderBlank.id];
commanderPurge.playerStates[commander.id].discardPile = [];
commanderPurge.playerStates[diceEnemy.id].hand = [purgedEnemyCards[0].id];
commanderPurge.playerStates[diceEnemy.id].drawPile = [purgeReplacement.id];
commanderPurge.playerStates[diceEnemy.id].discardPile = [];
const purged = engine.resolveCardTurn(commanderPurge, [commander, diceEnemy], purgeCard.id, diceEnemy.id, 20);
assert(purged.playerStates[diceEnemy.id].graveyard.includes(purgedEnemyCards[0].id), "Tactical Purge moves a random enemy hand card to that enemy's graveyard");
assert(!purged.playerStates[diceEnemy.id].hand.includes(purgedEnemyCards[0].id), "the purged card immediately leaves the enemy hand");
assert.deepEqual(purged.playerStates[diceEnemy.id].purgedCards, [{ cardId: purgedEnemyCards[0].id, returnAfterPhase: 2 }], "the purged card records a two-phase return boundary");
assert(!purged.playerStates[commander.id].graveyard.includes(purgeCard.id), "Tactical Purge remains reusable after its first use");

const enemyPhaseOneCard = purged.playerStates[diceEnemy.id].hand[0];
const afterOnePhase = engine.resolveCardTurn(purged, [commander, diceEnemy], enemyPhaseOneCard, diceEnemy.id, 20);
assert.equal(afterOnePhase.completedPhases, 1);
assert(afterOnePhase.playerStates[diceEnemy.id].graveyard.includes(purgedEnemyCards[0].id), "the purged card remains in the graveyard after one phase");
assert(!afterOnePhase.playerStates[diceEnemy.id].drawPile.includes(purgedEnemyCards[0].id), "the purged card cannot return to draw after only one phase");
assert(!afterOnePhase.playerStates[diceEnemy.id].discardPile.includes(purgedEnemyCards[0].id), "the purged card cannot leak into discard while its timer is active");
assert.equal(afterOnePhase.playerStates[diceEnemy.id].purgedCards.length, 1);

const enemyPhaseTwoCard = afterOnePhase.playerStates[diceEnemy.id].hand[0];
const midSecondPhase = engine.resolveCardTurn(afterOnePhase, [commander, diceEnemy], enemyPhaseTwoCard, diceEnemy.id, 20);
const commanderPhaseTwoCard = midSecondPhase.playerStates[commander.id].hand.find((id) => id !== purgeCard.id) ?? commanderBlank.id;
midSecondPhase.playerStates[commander.id].hand = [commanderPhaseTwoCard];
const afterTwoPhases = engine.resolveCardTurn(midSecondPhase, [commander, diceEnemy], commanderPhaseTwoCard, commander.id, 20);
assert.equal(afterTwoPhases.completedPhases, 2);
assert(!afterTwoPhases.playerStates[diceEnemy.id].graveyard.includes(purgedEnemyCards[0].id), "the purged card leaves the graveyard after two phases");
assert(afterTwoPhases.playerStates[diceEnemy.id].drawPile.includes(purgedEnemyCards[0].id), "the purged card returns to its owner's draw pile after two phases");
assert(!afterTwoPhases.playerStates[diceEnemy.id].discardPile.includes(purgedEnemyCards[0].id), "the purged card never returns to discard");
assert.equal(afterTwoPhases.playerStates[diceEnemy.id].purgedCards.length, 0, "the completed purge timer is removed");

const redrawPurgedGame = structuredClone(afterTwoPhases);
const redrawSource = diceEnemy.skillDeck.find((card) => !card.unique && card.effect === "none");
redrawPurgedGame.turnOrder = [diceEnemy.id, commander.id];
redrawPurgedGame.activePlayerIndex = 1;
redrawPurgedGame.adventure.target = 8;
redrawPurgedGame.playerStates[diceEnemy.id].hand = [redrawSource.id];
redrawPurgedGame.playerStates[diceEnemy.id].drawPile = [purgedEnemyCards[0].id];
redrawPurgedGame.playerStates[diceEnemy.id].discardPile = [];
const redrawnPurge = engine.resolveCardTurn(redrawPurgedGame, [commander, diceEnemy], redrawSource.id, diceEnemy.id, 20);
assert(redrawnPurge.playerStates[diceEnemy.id].hand.includes(purgedEnemyCards[0].id), "the returned card can be drawn normally on a later card replacement");
assert(!redrawnPurge.playerStates[diceEnemy.id].drawPile.includes(purgedEnemyCards[0].id), "drawing the returned card removes it from the draw pile");

afterTwoPhases.turnOrder = [commander.id, diceEnemy.id];
afterTwoPhases.activePlayerIndex = 0;
afterTwoPhases.playerStates[commander.id].hand = [purgeCard.id];
afterTwoPhases.playerStates[diceEnemy.id].hand = [purgedEnemyCards[1].id];
const secondPurge = engine.resolveCardTurn(afterTwoPhases, [commander, diceEnemy], purgeCard.id, diceEnemy.id, 20);
assert(!secondPurge.playerStates[commander.id].graveyard.includes(purgeCard.id), "Tactical Purge remains reusable after its second use");
secondPurge.turnOrder = [commander.id, diceEnemy.id];
secondPurge.activePlayerIndex = 0;
secondPurge.playerStates[commander.id].hand = [purgeCard.id];
secondPurge.playerStates[diceEnemy.id].hand = [purgedEnemyCards[2].id];
const thirdPurge = engine.resolveCardTurn(secondPurge, [commander, diceEnemy], purgeCard.id, diceEnemy.id, 20);
assert(thirdPurge.playerStates[commander.id].graveyard.includes(purgeCard.id), "Tactical Purge enters Ione's graveyard after its third use");
assert(![...thirdPurge.playerStates[commander.id].hand, ...thirdPurge.playerStates[commander.id].drawPile, ...thirdPurge.playerStates[commander.id].discardPile].includes(purgeCard.id), "Tactical Purge cannot be drawn after entering the graveyard");

for (const option of options) {
  for (const templateCard of option.skillDeck.filter((card) => card.unique)) {
    const matrixActor = engine.createPlayerSession(`Failure ${templateCard.id}`, 0, option.hero.name, `failure-${templateCard.id}-actor`);
    const matrixAlly = engine.createPlayerSession(`Ally ${templateCard.id}`, 2, "Elara Voss", `failure-${templateCard.id}-ally`);
    const matrixEnemyOne = engine.createPlayerSession(`Enemy one ${templateCard.id}`, 1, "Thorne Vale", `failure-${templateCard.id}-enemy-one`);
    const matrixEnemyTwo = engine.createPlayerSession(`Enemy two ${templateCard.id}`, 3, "Mira Ash", `failure-${templateCard.id}-enemy-two`);
    const matrixParty = [matrixActor, matrixEnemyOne, matrixAlly, matrixEnemyTwo];
    const matrixCard = matrixActor.skillDeck.find((card) => card.id === templateCard.id);
    const matrixGame = engine.createInitialGame(matrixParty, engine.createAdventure(`FAILURE-MATRIX-${templateCard.id}`), 30);
    matrixGame.turnOrder = matrixParty.map((player) => player.id);
    matrixGame.adventure.target = 20;
    matrixGame.playerStates[matrixActor.id].hand = [matrixCard.id];
    matrixGame.playerStates[matrixActor.id].shield = 10;
    matrixGame.playerStates[matrixActor.id].timedEffects = [{ kind: "shield", value: 10, expiresAfterTurn: 99 }];
    if (matrixCard.target === "defeated-ally") matrixGame.playerStates[matrixAlly.id].hp = 0;
    const targetId = matrixCard.target === "ally" || matrixCard.target === "defeated-ally"
      ? matrixAlly.id
      : matrixCard.target === "enemy" || matrixCard.target === "player"
        ? matrixEnemyOne.id
        : matrixActor.id;
    const beforeFailure = structuredClone(matrixGame);
    const matrixFailure = engine.resolveCardTurn(matrixGame, matrixParty, matrixCard.id, targetId, 1);
    assert.equal(matrixFailure.outcome.success, false, `${matrixCard.name} must fail below the d20 target`);
    assert.equal(matrixFailure.outcome.amount, 0, `${matrixCard.name} must not apply its main effect on failure`);
    assert.equal(matrixFailure.playerStates[matrixActor.id].pityPoints, 1, `${matrixCard.name} failure must grant 1 pity point`);
    assert(matrixFailure.outcome.failureDetail, `${matrixCard.name} must publish its failure impact`);
    if (matrixCard.failureEffect === "self-damage") {
      assert.equal(matrixFailure.playerStates[matrixActor.id].hp, matrixActor.hero.maxHp - matrixCard.failureValue, `${matrixCard.name} must apply its exact self backlash`);
      assert.equal(matrixFailure.playerStates[matrixAlly.id].hp, beforeFailure.playerStates[matrixAlly.id].hp, `${matrixCard.name} self backlash must not damage allies`);
    } else if (matrixCard.failureEffect === "team-damage") {
      for (const ally of [matrixActor, matrixAlly]) {
        const hpBefore = beforeFailure.playerStates[ally.id].hp;
        const expectedHp = hpBefore > 0 ? Math.max(0, hpBefore - matrixCard.failureValue) : 0;
        assert.equal(matrixFailure.playerStates[ally.id].hp, expectedHp, `${matrixCard.name} must apply its exact backlash to each living ally`);
      }
    } else if (matrixCard.failureEffect === "lose-shield") {
      assert.equal(matrixFailure.playerStates[matrixActor.id].shield, 10 - matrixCard.failureValue, `${matrixCard.name} must remove its exact shield penalty`);
      assert.equal(matrixFailure.playerStates[matrixActor.id].hp, matrixActor.hero.maxHp, `${matrixCard.name} shield loss must not deal HP damage`);
    } else if (matrixCard.failureEffect === "enemy-shield") {
      for (const enemy of [matrixEnemyOne, matrixEnemyTwo]) {
        assert.equal(matrixFailure.playerStates[enemy.id].shield, matrixCard.failureValue, `${matrixCard.name} must grant its exact shield penalty to every living enemy`);
        assert(matrixFailure.playerStates[enemy.id].timedEffects.some((effect) => effect.kind === "shield" && effect.value === matrixCard.failureValue && effect.expiresAfterTurn === 1), `${matrixCard.name} enemy shield must expire after that enemy's next turn`);
      }
    } else {
      assert.fail(`${matrixCard.name} uses an unsupported failure effect`);
    }
    assert.equal(matrixFailure.playerStates[matrixEnemyOne.id].hp, matrixEnemyOne.hero.maxHp, `${matrixCard.name} failure must never damage enemies`);
    assert.equal(matrixFailure.playerStates[matrixEnemyTwo.id].hp, matrixEnemyTwo.hero.maxHp, `${matrixCard.name} failure must never damage enemies`);
  }
}

const duelist = engine.createPlayerSession("Kael", 0, "Kael Rook", "duelist");
const failureEnemy = engine.createPlayerSession("Failure target", 1, "Thorne Vale", "failure-enemy");
const failureGame = engine.createInitialGame([duelist, failureEnemy], engine.createAdventure("FAILURE"), 30);
failureGame.turnOrder = [duelist.id, failureEnemy.id];
const riskyCard = duelist.skillDeck.find((card) => card.failureEffect === "self-damage" && card.failureValue >= 2);
failureGame.adventure.target = 20;
failureGame.playerStates[duelist.id].hand = [riskyCard.id];
const failedStrongCard = engine.resolveCardTurn(failureGame, [duelist, failureEnemy], riskyCard.id, failureEnemy.id, 1);
assert.equal(failedStrongCard.playerStates[duelist.id].hp, duelist.hero.maxHp - riskyCard.failureValue);
assert(failedStrongCard.outcome.failureDetail, "strong failed card explains its negative effect");
assert.equal(failedStrongCard.history.at(-1).failureDetail, failedStrongCard.outcome.failureDetail, "failed-card history preserves the exact penalty description");

const failureHealer = engine.createPlayerSession("Failure healer", 0, "Brother Orren", "failure-healer");
const failureHealEnemy = engine.createPlayerSession("Failure heal enemy", 1, "Thorne Vale", "failure-heal-enemy");
const failureHealAlly = engine.createPlayerSession("Failure heal ally", 2, "Elara Voss", "failure-heal-ally");
const failedHealCard = failureHealer.skillDeck.find((card) => card.name === "Prayer of Life");
const failedHealGame = engine.createInitialGame([failureHealer, failureHealEnemy, failureHealAlly], engine.createAdventure("FAILURE-HEAL"), 30);
failedHealGame.turnOrder = [failureHealer.id, failureHealEnemy.id, failureHealAlly.id];
failedHealGame.adventure.target = 20;
failedHealGame.playerStates[failureHealer.id].hp = 5;
failedHealGame.playerStates[failureHealAlly.id].hp = 2;
failedHealGame.playerStates[failureHealer.id].hand = [failedHealCard.id];
const failedHeal = engine.resolveCardTurn(failedHealGame, [failureHealer, failureHealEnemy, failureHealAlly], failedHealCard.id, failureHealAlly.id, 1);
assert.equal(failedHeal.outcome.success, false, "a low Prayer of Life roll fails");
assert.equal(failedHeal.playerStates[failureHealer.id].hp, 4, "a failed heal authoritatively damages its user");
assert.equal(failedHeal.playerStates[failureHealAlly.id].hp, 2, "a failed heal never applies its healing effect");

const teamFailureActor = engine.createPlayerSession("Team failure actor", 0, "Mira Ash", "team-failure-actor");
const teamFailureEnemy = engine.createPlayerSession("Team failure enemy", 1, "Thorne Vale", "team-failure-enemy");
const teamFailureAlly = engine.createPlayerSession("Team failure ally", 2, "Elara Voss", "team-failure-ally");
const teamFailureCard = teamFailureActor.skillDeck.find((card) => card.failureEffect === "team-damage");
const teamFailureGame = engine.createInitialGame([teamFailureActor, teamFailureEnemy, teamFailureAlly], engine.createAdventure("FAILURE-TEAM"), 30);
teamFailureGame.turnOrder = [teamFailureActor.id, teamFailureEnemy.id, teamFailureAlly.id];
teamFailureGame.adventure.target = 20;
teamFailureGame.playerStates[teamFailureActor.id].hand = [teamFailureCard.id];
const failedTeamCard = engine.resolveCardTurn(teamFailureGame, [teamFailureActor, teamFailureEnemy, teamFailureAlly], teamFailureCard.id, teamFailureEnemy.id, 1);
assert.equal(failedTeamCard.playerStates[teamFailureActor.id].hp, teamFailureActor.hero.maxHp - teamFailureCard.failureValue, "team backlash damages the user");
assert.equal(failedTeamCard.playerStates[teamFailureAlly.id].hp, teamFailureAlly.hero.maxHp - teamFailureCard.failureValue, "team backlash damages every living ally");
assert.equal(failedTeamCard.playerStates[teamFailureEnemy.id].hp, teamFailureEnemy.hero.maxHp, "team backlash never damages the opposing team");

const shieldFailureActor = engine.createPlayerSession("Shield failure actor", 0, "Bram Coalhand", "shield-failure-actor");
const shieldFailureEnemy = engine.createPlayerSession("Shield failure enemy", 1, "Thorne Vale", "shield-failure-enemy");
const shieldFailureCard = shieldFailureActor.skillDeck.find((card) => card.failureEffect === "lose-shield");
const shieldFailureGame = engine.createInitialGame([shieldFailureActor, shieldFailureEnemy], engine.createAdventure("FAILURE-SHIELD"), 30);
shieldFailureGame.turnOrder = [shieldFailureActor.id, shieldFailureEnemy.id];
shieldFailureGame.adventure.target = 20;
shieldFailureGame.playerStates[shieldFailureActor.id].shield = 5;
shieldFailureGame.playerStates[shieldFailureActor.id].timedEffects = [{ kind: "shield", value: 5, expiresAfterTurn: 2 }];
shieldFailureGame.playerStates[shieldFailureActor.id].hand = [shieldFailureCard.id];
const failedShieldCard = engine.resolveCardTurn(shieldFailureGame, [shieldFailureActor, shieldFailureEnemy], shieldFailureCard.id, shieldFailureActor.id, 1);
assert.equal(failedShieldCard.playerStates[shieldFailureActor.id].shield, 5 - shieldFailureCard.failureValue, "guard-break failure removes the printed shield amount");
assert.equal(failedShieldCard.playerStates[shieldFailureActor.id].timedEffects.reduce((sum, effect) => sum + (effect.kind === "shield" ? effect.value : 0), 0), 5 - shieldFailureCard.failureValue, "guard-break failure keeps timed shield bookkeeping synchronized");

const emptyGame = engine.createInitialGame([first, second], engine.createAdventure("EMPTY"), 30);
emptyGame.turnOrder = [first.id, second.id];
const emptyCard = first.skillDeck.find((card) => card.effect === "none");
emptyGame.playerStates[first.id].hand = [emptyCard.id];
emptyGame.playerStates[first.id].drawPile = [attack.id];
const emptyResult = engine.resolveCardTurn(emptyGame, [first, second], emptyCard.id, first.id, 20);
assert.equal(emptyResult.playerStates[first.id].hp, emptyGame.playerStates[first.id].hp);
assert.equal(emptyResult.playerStates[second.id].hp, emptyGame.playerStates[second.id].hp);
assert.equal(emptyResult.playerStates[first.id].shield, emptyGame.playerStates[first.id].shield);
assert(emptyResult.playerStates[first.id].discardPile.includes(emptyCard.id), "played no-effect card still cycles normally");
assert.match(emptyResult.history.at(-1).message, /had no effect/);

const cycleGame = engine.createInitialGame([first, second], engine.createAdventure("CYCLE"), 30);
cycleGame.turnOrder = [first.id, second.id];
const guard = first.skillDeck.find((card) => card.effect === "guard");
const heal = first.skillDeck.find((card) => card.effect === "heal");
cycleGame.playerStates[first.id].hand = [guard.id, heal.id, attack.id];
cycleGame.playerStates[first.id].drawPile = [emptyCard.id];
cycleGame.playerStates[first.id].discardPile = [];
const cycled = engine.resolveCardTurn(cycleGame, [first, second], attack.id, second.id, 20);
assert(cycled.playerStates[first.id].hand.includes(guard.id) && cycled.playerStates[first.id].hand.includes(heal.id), "unplayed hand cards stay in hand");
assert(cycled.playerStates[first.id].hand.includes(emptyCard.id), "a replacement is drawn only after a card is played");
assert.equal(cycled.playerStates[first.id].hand[2], emptyCard.id, "a replacement occupies the exact slot of the played card");
assert.deepEqual(cycled.playerStates[first.id].discardPile, [attack.id], "only the played card enters discard");

cycled.playerStates[first.id].hand = [guard.id, heal.id];
cycled.playerStates[first.id].drawPile = [];
cycled.playerStates[first.id].discardPile = [attack.id, emptyCard.id];
cycled.activePlayerIndex = 0;
cycled.turnOrder = [first.id, second.id];
const reshuffled = engine.resolveCardTurn(cycled, [first, second], guard.id, first.id, 20);
assert.equal(reshuffled.playerStates[first.id].hand.length, 2, "an empty draw pile still replaces exactly one played card while other cards remain in hand");
assert(reshuffled.playerStates[first.id].hand.includes(heal.id), "unplayed cards remain in hand when discard refills an empty draw pile");
assert.equal(reshuffled.playerStates[first.id].drawPile.length, 2, "recycled cards not selected as the one random replacement remain in draw");
assert.equal(reshuffled.playerStates[first.id].discardPile.length, 0, "all discarded cards move to draw as soon as an empty draw pile needs a replacement");
assert.deepEqual(new Set([...reshuffled.playerStates[first.id].hand, ...reshuffled.playerStates[first.id].drawPile]), new Set([attack.id, emptyCard.id, guard.id, heal.id]), "the immediate recycle preserves every reusable card across hand and draw");

const fiveCardCycle = engine.createInitialGame([first, second], engine.createAdventure("FIVE-CARD-CYCLE"), 30);
fiveCardCycle.turnOrder = [first.id, second.id];
const fiveReusableCards = first.skillDeck.slice(0, 5).map((card) => card.id);
fiveCardCycle.playerStates[first.id].hand = [fiveReusableCards[4]];
fiveCardCycle.playerStates[first.id].drawPile = [];
fiveCardCycle.playerStates[first.id].discardPile = fiveReusableCards.slice(0, 4);
const fiveCardRefill = engine.resolveCardTurn(fiveCardCycle, [first, second], fiveReusableCards[4], first.id, 20);
assert.equal(fiveCardRefill.playerStates[first.id].hand.length, 1, "an empty draw pile always draws one replacement instead of dealing four cards");
assert.equal(fiveCardRefill.playerStates[first.id].drawPile.length, 4, "the other four recycled cards remain in draw");
assert.equal(fiveCardRefill.playerStates[first.id].discardPile.length, 0, "all discarded cards move out of discard when draw is refilled");
assert.deepEqual(new Set([...fiveCardRefill.playerStates[first.id].hand, ...fiveCardRefill.playerStates[first.id].drawPile]), new Set(fiveReusableCards), "the one-card refill preserves every reusable card across hand and draw");

const eventGame = engine.createInitialGame([first, second], engine.createAdventure("EVENT"), 30);
eventGame.turnOrder = [first.id, second.id];
eventGame.completedTurns = 8;
eventGame.completedPhases = 4;
eventGame.roundNumber = 5;
eventGame.actedThisRound = [second.id];
eventGame.playerStates[first.id].hand = [attack.id];
const eventTurn = engine.resolveCardTurn(eventGame, [first, second], attack.id, second.id, 20);
assert.equal(eventTurn.completedPhases, 5);
assert.equal(eventTurn.worldEvent, null, "the client-oriented turn resolver does not select or mutate a World Event");
assert.deepEqual(eventTurn.worldEventHistory, [], "the ordinary turn resolver cannot manufacture authoritative World Event history");
assert.equal(eventTurn.pendingWorldEvent, null, "the ordinary turn resolver cannot create an interactive World Event");
assert(!eventTurn.history.some((entry) => entry.kind === "world"), "World Event public history is created only by the shared authoritative engine");

const finalGame = engine.createInitialGame([first, second], engine.createAdventure("FINAL"), 30);
finalGame.turnOrder = [first.id, second.id];
finalGame.completedTurns = 58;
finalGame.completedPhases = 29;
finalGame.roundNumber = 30;
finalGame.actedThisRound = [second.id];
finalGame.playerStates[first.id].hp = 50;
finalGame.playerStates[first.id].maxHp = 50;
finalGame.playerStates[second.id].hp = 15;
finalGame.playerStates[second.id].maxHp = 30;
finalGame.playerStates[first.id].hand = [attack.id];
const finalTurn = engine.resolveCardTurn(finalGame, [first, second], attack.id, second.id, 20);
assert.equal(finalTurn.ended, true);
assert.equal(finalTurn.winnerTeam, "veil");
assert.equal(finalTurn.completedPhases, 30);
assert(finalTurn.playerStates[second.id].hp > 0, "phase-30 winner is decided by team HP while both teams still live");

const deadGame = engine.createInitialGame([first, second], engine.createAdventure("DEAD"), 30);
deadGame.turnOrder = [first.id, second.id];
deadGame.playerStates[first.id].hp = 0;
deadGame.playerStates[first.id].hand = [attack.id];
assert.equal(engine.resolveCardTurn(deadGame, [first, second], attack.id, second.id, 20), deadGame, "defeated players cannot act");

const speedRound = engine.createInitialGame([first, second], engine.createAdventure("SPEED-ROUND"), 30);
const secondBlank = second.skillDeck.find((card) => card.effect === "none");
const firstBlank = first.skillDeck.find((card) => card.effect === "none");
speedRound.playerStates[second.id].hand = [secondBlank.id];
const afterFastTurn = engine.resolveCardTurn(speedRound, [first, second], secondBlank.id, second.id, 20);
assert.equal(afterFastTurn.turnOrder[0], first.id, "the slower living player follows in the same round");
assert.equal(afterFastTurn.completedPhases, 0, "one player's turn does not complete a phase");
assert.equal(afterFastTurn.history.at(-1).phase, 1, "history records the active phase starting at one");
afterFastTurn.playerStates[first.id].hand = [firstBlank.id];
const nextSpeedRound = engine.resolveCardTurn(afterFastTurn, [first, second], firstBlank.id, first.id, 20);
assert.equal(nextSpeedRound.roundNumber, 2);
assert.equal(nextSpeedRound.completedPhases, 1, "a phase completes only after every living player acts");
assert.equal(nextSpeedRound.history.at(-1).phase, 1, "the final turn in a phase keeps that phase number");
assert.equal(nextSpeedRound.turnOrder[0], second.id, "a completed round resets to the fastest living player");
assert.deepEqual(nextSpeedRound.actedThisRound, []);

if (originalTestMode === undefined) delete process.env.TEST_MODE;
else process.env.TEST_MODE = originalTestMode;

console.log("Game-rule test passed: TEST_MODE pity overrides, random targets, pity earning/spending, balanced card costs, special-card penalties, support effects, turn order, event history, victory, and defeated-player lockout.");
