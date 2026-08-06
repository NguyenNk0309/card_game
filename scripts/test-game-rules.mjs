import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const compile = (source, fileName) => ts.transpileModule(source, {
  fileName,
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;

const catalogSource = await readFile(new URL("../backend/game/catalog.ts", import.meta.url), "utf8");
const characterPassiveRulesUrl = new URL("../shared/characterPassives.mjs", import.meta.url).href;
const daganRulesUrl = new URL("../shared/daganFlint.mjs", import.meta.url).href;
const lioraRulesUrl = new URL("../shared/lioraVenn.mjs", import.meta.url).href;
const mirefieldRulesUrl = new URL("../shared/mirefieldSeizure.mjs", import.meta.url).href;
const compiledCatalog = compile(catalogSource, "catalog.ts")
  .replace('from "@/shared/daganFlint.mjs"', `from "${daganRulesUrl}"`)
  .replace('from "@/shared/lioraVenn.mjs"', `from "${lioraRulesUrl}"`)
  .replace('from "@/shared/mirefieldSeizure.mjs"', `from "${mirefieldRulesUrl}"`);
const catalogUrl = `data:text/javascript;base64,${Buffer.from(compiledCatalog).toString("base64")}`;
const catalog = await import(catalogUrl);
const characterPassiveRules = await import(characterPassiveRulesUrl);
const daganRules = await import(daganRulesUrl);
const lioraRules = await import(lioraRulesUrl);
const mirefieldRules = await import(mirefieldRulesUrl);
const pityCostUrl = new URL("../shared/pityCost.mjs", import.meta.url).href;
const pityCostRules = await import(pityCostUrl);
const bulwarkRules = await import(new URL("../shared/bulwarkToBlade.mjs", import.meta.url).href);
const battlePhasesUrl = new URL("../shared/battlePhases.mjs", import.meta.url).href;
const battlePhases = await import(battlePhasesUrl);
const shopRulesUrl = new URL("../shared/shop.mjs", import.meta.url).href;
const shopRules = await import(shopRulesUrl);
const cardRulesSource = await readFile(new URL("../shared/cardRules.ts", import.meta.url), "utf8");
const compiledCardRules = compile(cardRulesSource, "cardRules.ts").replace('from "./pityCost.mjs"', `from "${pityCostUrl}"`);
const cardRules = await import(`data:text/javascript;base64,${Buffer.from(compiledCardRules).toString("base64")}`);
const diceVisibilitySource = await readFile(new URL("../shared/diceVisibility.ts", import.meta.url), "utf8");
const diceVisibility = await import(`data:text/javascript;base64,${Buffer.from(compile(diceVisibilitySource, "diceVisibility.ts")).toString("base64")}`);
const engineSource = await readFile(new URL("../backend/game/engine.ts", import.meta.url), "utf8");
const compiledEngine = compile(engineSource, "engine.ts")
  .replace('from "./catalog"', `from "${catalogUrl}"`)
  .replace('from "@/shared/characterPassives.mjs"', `from "${characterPassiveRulesUrl}"`)
  .replace('from "@/shared/pityCost.mjs"', `from "${pityCostUrl}"`)
  .replace('from "@/shared/lioraVenn.mjs"', `from "${lioraRulesUrl}"`)
  .replace('from "@/shared/battlePhases.mjs"', `from "${battlePhasesUrl}"`)
  .replace('from "@/shared/shop.mjs"', `from "${shopRulesUrl}"`);
const engine = await import(`data:text/javascript;base64,${Buffer.from(compiledEngine).toString("base64")}`);

const sampledTargets = Array.from({ length: 256 }, () => engine.randomDiceTarget());
const sampledRolls = Array.from({ length: 256 }, () => engine.randomD20Roll());
assert.equal(diceVisibility.visibleDiceModifier(3, "affected-player", "affected-player"), 3, "the affected player sees their dice modifier");
assert.equal(diceVisibility.visibleDiceModifier(3, "affected-player", "observer"), 0, "other players see a zero dice modifier");
assert(sampledTargets.every((value) => Number.isInteger(value) && value >= 8 && value <= 16), "every target must be an independent integer from 8 through 16");
assert(sampledRolls.every((value) => Number.isInteger(value) && value >= 1 && value <= 20), "every d20 result must be an independent integer from 1 through 20");
assert(new Set(sampledTargets).size > 1, "target sampling must not return a fixed value");
assert(new Set(sampledRolls).size > 1, "d20 sampling must not return a fixed value");
assert.equal(engine.BATTLE_TURN_SECONDS, 60, "the exported battle-turn duration stays synchronized with created games");
assert.equal(battlePhases.getCurrentBattlePhase(30), 31, "phase counting continues beyond the 30-cell timeline");
assert.equal(battlePhases.getVisualizedCompletedPhases(31), 30, "the phase visualization freezes after its first 30 phases");
assert.equal(battlePhases.getPhaseCountDenominator(30), "30");
assert.equal(battlePhases.getPhaseCountDenominator(31), "\u221e", "phase 31 and later display an unlimited denominator");
assert.equal(engine.randomIntInclusive(5, 5), 5, "inclusive random ranges support a single valid value");
assert.throws(() => engine.randomIntInclusive(2, 1), RangeError, "invalid random ranges fail explicitly");
assert.match(engine.createSeed(), /^[A-Z0-9]{0,6}$/, "generated adventure seeds use the compact uppercase format");
const minimumParty = engine.createParty(1);
const maximumParty = engine.createParty(99);
assert.equal(minimumParty.length, 2, "party creation enforces the two-player minimum");
assert.equal(maximumParty.length, 10, "party creation enforces the ten-character maximum");
assert.deepEqual(maximumParty.map((hero) => hero.team), ["veil", "ember", "veil", "ember", "veil", "ember", "veil", "ember", "veil", "ember"], "generated parties alternate teams");
assert.deepEqual(maximumParty.map((hero) => hero.isYou), [true, false, false, false, false, false, false, false, false, false], "only the first generated hero is the local preview hero");

const options = engine.getCharacterOptions();
assert.equal(options.length, 11);
assert.deepEqual(options.map((option) => option.hero.name), catalog.HERO_TEMPLATES.map((hero) => hero.name), "character options expose every catalog hero in canonical order");
assert.equal(catalog.ACTION_CARDS.length, 7, "the reusable common-card catalog contains exactly seven cards");
assert.equal(Object.values(catalog.CHARACTER_SKILL_CARDS).flat().length, 33, "the special-card catalog contains exactly thirty-three cards");
assert.equal(catalog.REALMS.length, 1, "the current battle uses one authoritative realm definition");
assert.equal(catalog.STORY_BEATS.length, catalog.EVENTS.length, "story and event narration catalogs remain index-compatible");
const helperAdventure = engine.createAdventure("HELPERS");
assert.equal(helperAdventure.seed, "HELPERS");
assert.equal(helperAdventure.realm, catalog.REALMS[0]);
const nextNarrative = engine.nextStory(helperAdventure);
assert(catalog.STORY_BEATS.includes(nextNarrative.story), "nextStory selects a catalog story beat");
assert(catalog.EVENTS.includes(nextNarrative.event), "nextStory selects the paired catalog event copy");
assert.equal(engine.createSkillDeck(catalog.HERO_TEMPLATES[0]).length, 10, "direct skill-deck creation returns three special and seven common cards");
assert.equal(catalog.calculatePityCost({ ...catalog.ACTION_CARDS[0], pityCost: 9.8 }), 8, "stored pity costs are floored and capped at eight");
const everyCard = options.flatMap((option) => option.skillDeck);
const expectedPassiveNames = {
  "Elara Voss": "Lantern-Forged Guard",
  "Thorne Vale": "Second-Beat Deadeye",
  "Mira Ash": "Wildfire Reach",
  "Brother Orren": "Graceful Restoration",
  "Liora Venn": "Sanguine Recompense",
  "Nyx Calder": "Veilpiercer",
  "Bram Coalhand": "Two-Turn Temper",
  "Sable Fen": "Foreseen Return",
  "Kael Rook": "Unshielded Edge",
  "Ione Mire": "Marshal's Fortune",
  "Dagan Flint": "Bloodied Power"
};
const expectedSpecialNames = {
  "ev-aegis": "Lantern Phalanx",
  "ev-ward": "Undying Ward",
  "ev-command": "Rescue Order",
  "tv-mark": "Deadeye Bolt",
  "tv-pierce": "Armor-Piercing Bolt",
  "tv-hunt": "Predator's Boon",
  "ma-inferno": "Wildfire Inferno",
  "ma-comet": "Piercing Ashfall",
  "ma-gravity": "Gravitic Misfortune",
  "bo-prayer": "Graceful Renewal",
  "bo-blessing": "Shared Restoration",
  "bo-return": "Immediate Resurrection",
  "lv-verdict": "Crimson Verdict",
  "lv-remedy": "Bloodbound Remedy",
  "lv-communion": "Red Communion",
  "nc-knife": "Veilpiercing Knife",
  "nc-execute": "Veilpiercing Execution",
  "nc-pilfer": "Borrowed Fate",
  "bc-fortress": "Two-Turn Bastion",
  "bc-temper": "Tempered Phalanx",
  "bc-march": "Bulwark to Blade",
  "sf-favor": "Foretold Success",
  "sf-hex": "Foretold Misfortune",
  "sf-stolen": "Foretold Delay",
  "kr-riposte": "Unshielded Riposte",
  "kr-duel": "Baresteel Challenge",
  "kr-break": "Buffbreaker",
  "im-command": "Assault Order",
  "im-focus": "Precision Order",
  "im-purge": "Mirefield Seizure",
  "df-none": "Bloodied Onslaught",
  "df-cleave": "Bloodied Cleave",
  "df-frenzy": "Flintblood Fury"
};
assert.equal(Object.keys(expectedPassiveNames).length, 11, "the naming contract must cover all eleven character passives");
assert.equal(Object.keys(expectedSpecialNames).length, 33, "the naming contract must cover all thirty-three special cards");
for (const option of options) {
  assert.equal(option.hero.passiveName, expectedPassiveNames[option.hero.name], `${option.hero.name} must use its effect-aligned passive name`);
  assert.equal(option.hero.skill, option.skillDeck[0].name, `${option.hero.name}'s featured skill name must match their first special card`);
}
for (const card of everyCard.filter((candidate) => candidate.unique)) assert.equal(card.name, expectedSpecialNames[card.id], `${card.id} must use its effect-aligned special-card name`);
assert.equal(new Set(Object.values(expectedPassiveNames)).size, 11, "every passive name must be unique");
assert.equal(new Set(Object.values(expectedSpecialNames)).size, 33, "every special-card name must be unique");
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
  "lv-verdict": { pityCost: 6, failureEffect: "self-damage", failureValue: 2 },
  "lv-remedy": { pityCost: 7, failureEffect: "self-damage", failureValue: 2 },
  "lv-communion": { pityCost: 7, failureEffect: "team-damage", failureValue: 1 },
  "nc-knife": { pityCost: 6, failureEffect: "self-damage", failureValue: 2 },
  "nc-execute": { pityCost: 7, failureEffect: "self-damage", failureValue: 3 },
  "nc-pilfer": { pityCost: 7, failureEffect: "enemy-shield", failureValue: 2 },
  "bc-fortress": { pityCost: 6, failureEffect: "lose-shield", failureValue: 3 },
  "bc-temper": { pityCost: 7, failureEffect: "team-damage", failureValue: 1 },
  "bc-march": { pityCost: 7, failureEffect: "lose-shield", failureValue: 4 },
  "sf-favor": { pityCost: 6, failureEffect: "self-damage", failureValue: 2 },
  "sf-hex": { pityCost: 6, failureEffect: "enemy-shield", failureValue: 1 },
  "sf-stolen": { pityCost: 8, failureEffect: "team-damage", failureValue: 2 },
  "kr-riposte": { pityCost: 5, failureEffect: "self-damage", failureValue: 2 },
  "kr-duel": { pityCost: 6, failureEffect: "lose-shield", failureValue: 2 },
  "kr-break": { pityCost: 6, failureEffect: "enemy-shield", failureValue: 2 },
  "im-command": { pityCost: 6, failureEffect: "team-damage", failureValue: 1 },
  "im-focus": { pityCost: 6, failureEffect: "team-damage", failureValue: 1 },
  "im-purge": { pityCost: 7, failureEffect: "enemy-shield", failureValue: 3 },
  "df-none": { pityCost: 7, failureEffect: "self-damage", failureValue: 2 },
  "df-cleave": { pityCost: 7, failureEffect: "self-damage", failureValue: 2 },
  "df-frenzy": { pityCost: 6, failureEffect: "self-damage", failureValue: 2 }
};
const expectedCommonPityCosts = { slash: 2, heavy: 3, brace: 2, "second-wind": 3, "empty-gesture": 0, "broken-plan": 0, "lost-momentum": 0 };
const expectedReducedCommonBalance = {
  slash: { name: "Slash", description: "Deal 2 damage to one living enemy.", value: 2, pityCost: 2 },
  heavy: { name: "Heavy Blow", description: "Deal 3 damage to one living enemy.", value: 3, pityCost: 3 },
  brace: { name: "Brace", description: "Gain 2 shield; expires at the end of your next turn.", value: 2, pityCost: 2 },
  "second-wind": { name: "Second Wind", description: "Restore 3 HP to yourself; cannot revive.", value: 3, pityCost: 3 }
};
const specialCards = everyCard.filter((card) => card.unique);
assert.equal(Object.keys(expectedSpecialBalance).length, 33, "the rebalance contract must cover all 33 special cards");
assert.equal(specialCards.length, 33, "the live catalog must expose all 33 special cards");
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
for (const [cardId, expected] of Object.entries(expectedReducedCommonBalance)) {
  const card = catalog.ACTION_CARDS.find((candidate) => candidate.id === cardId);
  assert.deepEqual(
    { name: card.name, description: card.description, value: card.value, pityCost: card.pityCost },
    expected,
    `${expected.name} must align its common-card effect and pity cost`
  );
  const { pityCost: _pityCost, ...cardWithoutPityCost } = card;
  assert.equal(catalog.calculatePityCost(cardWithoutPityCost), expected.pityCost, `${expected.name} must derive its new pity cost in the catalog`);
  assert.equal(pityCostRules.calculateRuntimePityCost(cardWithoutPityCost, false), expected.pityCost, `${expected.name} must derive its new pity cost in realtime authorities`);
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
const cardRuleSample = options[0].skillDeck.find((card) => card.id === "ev-command");
assert.equal(cardRules.hasFavorableOmen({ completedPlayerTurns: 2, zeroPityUntilTurn: 3 }), true, "Foretold Success is active before its target-turn boundary");
assert.equal(cardRules.hasFavorableOmen({ completedPlayerTurns: 3, zeroPityUntilTurn: 3 }), false, "Foretold Success expires at its target-turn boundary");
assert.equal(cardRules.getEffectiveCardPityCost(cardRuleSample, { completedPlayerTurns: 2, zeroPityUntilTurn: 3 }), 0, "Foretold Success overrides an affected card to zero pity");
assert.equal(cardRules.getEffectiveCardPityCost(cardRuleSample, { completedPlayerTurns: 3, zeroPityUntilTurn: 3 }), cardRuleSample.pityCost, "an expired Foretold Success restores the printed pity cost");
assert.equal(cardRules.getCardTargetLabel(cardRuleSample), "One other living ally", "advance-ally cards exclude the acting player in target copy");
assert.equal(cardRules.describeCardImpact(cardRuleSample), `Success: ${cardRules.describeCardSuccess(cardRuleSample)} Failure: ${cardRules.describeCardFailure(cardRuleSample)}`, "combined impact copy uses the canonical success and failure descriptions");
for (const card of everyCard) {
  assert(cardRules.getCardEffectLabel(card).length > 0, `${card.name} exposes a player-facing effect label`);
  assert(cardRules.getCardTargetLabel(card).length > 0, `${card.name} exposes a player-facing target label`);
  assert(cardRules.describeCardImpact(card).length > 0, `${card.name} exposes a complete player-facing impact description`);
}
for (const option of options) {
  assert.equal(option.skillDeck.length, 10, `${option.hero.name} must have 10 cards`);
  assert.equal(option.skillDeck.filter((card) => card.unique).length, 3);
  assert.equal(option.skillDeck.filter((card) => !card.unique).length, 7);
  assert(option.skillDeck.every((card) => Number.isInteger(card.pityCost) && card.pityCost >= 0 && card.pityCost <= 8), "every card must have a reachable integer pity cost");
  assert(option.skillDeck.filter((card) => card.effect === "none").every((card) => card.pityCost === 0), "no-effect cards must cost zero pity");
  assert(option.skillDeck.filter((card) => card.effect !== "none").every((card) => card.pityCost >= 2), "effect cards must require accumulated pity");
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
assert.deepEqual([...supportTypes].sort(), ["advance-ally", "attack", "dice", "dispel-enemy", "enemy-dice", "purge-card", "revive", "skip-enemy", "steal-card", "zero-pity"]);
const diceModifierCards = options.flatMap((option) => option.skillDeck).filter((card) => card.supportType === "dice" || card.supportType === "enemy-dice");
assert.deepEqual(diceModifierCards.map((card) => card.name).sort(), ["Foretold Misfortune", "Gravitic Misfortune", "Precision Order"], "only the approved cards can create stored d20 modifiers");
const durationCards = options.flatMap((option) => option.skillDeck).filter((card) =>
  card.effect === "guard" || ["attack", "shield", "dice", "enemy-dice", "skip-enemy", "steal-card", "zero-pity"].includes(card.supportType)
);
assert(durationCards.every((card) => /expires at the end|effects expire normally|next turn ends/i.test(card.description)), "every buff and debuff card must state the target-turn expiry rule");
for (const classId of ["warden", "healer", "oracle", "support"]) {
  const option = options.find((candidate) => candidate.hero.classId === classId);
  assert.equal(option.skillDeck.filter((card) => card.unique && ["damage", "aoe"].includes(card.effect)).length, 0, `${classId} must focus on its non-damage team role`);
}
for (const classId of ["ranger", "mage", "assassin", "duelist", "berserker"]) {
  const option = options.find((candidate) => candidate.hero.classId === classId);
  assert.equal(option.skillDeck.filter((card) => card.unique && ["damage", "aoe"].includes(card.effect)).length, 2, `${classId} must have exactly two damage specials and one role utility special`);
}
const bloodweaver = options.find((candidate) => candidate.hero.classId === "bloodweaver");
assert.equal(bloodweaver.skillDeck.filter((card) => card.unique && ["damage", "aoe"].includes(card.effect)).length, 2, "Liora must have two health-exchange attacks");
assert.equal(bloodweaver.skillDeck.filter((card) => card.unique && card.effect === "heal").length, 1, "Liora must have one team-healing special");
assert.equal(options.find((option) => option.hero.classId === "tank").skillDeck.filter((card) => card.unique && ["damage", "aoe"].includes(card.effect)).length, 1, "Bram has one shield-powered damage special alongside two Guard specials");
assert.equal(options.find((option) => option.hero.classId === "tank").hero.maxHp, 14);
assert.equal(options.find((option) => option.hero.classId === "mage").hero.maxHp, 9);
assert.deepEqual([...options].sort((a, b) => b.hero.speed - a.hero.speed).map((option) => option.hero.name), ["Nyx Calder", "Thorne Vale", "Kael Rook", "Sable Fen", "Ione Mire", "Mira Ash", "Brother Orren", "Elara Voss", "Liora Venn", "Dagan Flint", "Bram Coalhand"]);

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
assert.equal(game.maxTurns, 0, "the synchronized turn limit uses zero to represent an unlimited battle");
assert.equal(game.maxPhases, 0, "the synchronized phase limit uses zero to represent an unlimited battle");
assert.equal(game.completedPhases, 0);
assert.equal(game.playerStates[first.id].pityPoints, 0, "every player begins with zero pity");
assert.equal(game.playerStates[first.id].sanguineRecompense, false, "every player begins without a Sanguine Recompense charge");
assert.equal(game.playerStates[first.id].hand.length + game.playerStates[first.id].drawPile.length + game.playerStates[first.id].discardPile.length + game.playerStates[first.id].graveyard.length, 10, "all cards begin in reusable zones with an empty graveyard");
assert.equal(engine.createInitialGame([first, second], engine.createAdventure("TIMER"), 5).turnSeconds, 60, "battle turns always last exactly 60 seconds");
assert(game.adventure.target >= 8 && game.adventure.target <= 16, "the initial target is randomly selected from the balanced target range");
const resolveReducedCommonCard = (cardId, targetId, configure = () => {}) => {
  const card = second.skillDeck.find((candidate) => candidate.id.endsWith(`-common-${cardId}`));
  const commonGame = engine.createInitialGame([first, second], engine.createAdventure(`COMMON-${cardId.toUpperCase()}`), 30);
  commonGame.turnOrder = [second.id, first.id];
  commonGame.adventure.target = 8;
  commonGame.playerStates[second.id].hand = [card.id];
  configure(commonGame);
  return engine.resolveCardTurn(commonGame, [first, second], card.id, targetId, 20);
};
const slashResult = resolveReducedCommonCard("slash", first.id);
assert.equal(slashResult.outcome.amount, 2, "Slash deals 2 damage in real card resolution");
assert.equal(slashResult.playerStates[first.id].hp, first.hero.maxHp - 2, "Slash synchronizes its reduced damage to target HP");
const heavyBlowResult = resolveReducedCommonCard("heavy", first.id);
assert.equal(heavyBlowResult.outcome.amount, 3, "Heavy Blow deals 3 damage in real card resolution");
assert.equal(heavyBlowResult.playerStates[first.id].hp, first.hero.maxHp - 3, "Heavy Blow synchronizes its reduced damage to target HP");
const braceResult = resolveReducedCommonCard("brace", second.id);
assert.equal(braceResult.outcome.amount, 2, "Brace grants 2 shield in real card resolution");
assert.equal(braceResult.playerStates[second.id].shield, 2, "Brace synchronizes its reduced shield to the actor");
const secondWindResult = resolveReducedCommonCard("second-wind", second.id, (commonGame) => {
  commonGame.playerStates[second.id].hp = 2;
});
assert.equal(secondWindResult.outcome.amount, 3, "Second Wind restores 3 HP in real card resolution");
assert.equal(secondWindResult.playerStates[second.id].hp, 5, "Second Wind synchronizes its reduced healing to the actor");
const normalizedOrderGame = structuredClone(game);
normalizedOrderGame.turnOrder = [first.id, first.id, "missing-player"];
assert.deepEqual(engine.normalizeTurnOrder(normalizedOrderGame, [first, second]), [first.id, second.id], "turn-order normalization removes duplicates and stale IDs while restoring missing players");
const nextLivingStates = structuredClone(game.playerStates);
nextLivingStates[second.id].hp = 0;
assert.equal(engine.findNextLivingPlayerIndex([first, second], nextLivingStates, 0), 0, "next-player lookup falls back to the current living player when every opponent is defeated");
const legacyAttack = first.skillDeck.find((card) => card.effect === "damage") ?? first.skillDeck[0];
const legacyAction = engine.resolveAction({ ...game.adventure, target: 12 }, legacyAttack.id, 12, true, first.skillDeck);
assert.equal(legacyAction.success, true, "the legacy action resolver succeeds exactly at its d20 target");
assert.equal(legacyAction.total, 12);
assert.equal(legacyAction.card.id, legacyAttack.id);
assert(legacyAction.adventure.target >= 8 && legacyAction.adventure.target <= 16, "the legacy action resolver generates the next balanced target");

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
assert.equal(pitySuccess.playerStates[first.id].goldUnits, 2, "a successful pity play earns one Gold just like a successful roll");
assert.equal(pitySuccess.outcome.goldChange, 1, "the pity-success outcome reports its one-Gold reward");
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
assert.match(elara.hero.passiveText, /Guard cards grant \+1 shield/i, "Lantern-Forged Guard applies only to Elara's Guard cards");
assert.equal(rallyingAegis.effect, "guard", "Lantern Phalanx is a Guard card");
assert.equal(rallyingAegis.supportType, undefined, "Lantern Phalanx no longer carries a Support subtype");
assert.equal(rallyingAegis.pityCost, 5, "Lantern Phalanx accounts for shielding the entire living team");
assert.equal(lanternWard.value, 3, "Undying Ward has 3 base shield");
assert.equal(lanternWard.pityCost, 5, "Undying Ward follows the existing Guard-card pity formula after its shield reduction");
assert.match(lanternWard.description, /3 shield.*4 with Lantern-Forged Guard/i, "Undying Ward describes its base and passive-enhanced shield");
const aegisGame = engine.createInitialGame(elaraParty, engine.createAdventure("RALLYING-AEGIS-GUARD"), 30);
aegisGame.turnOrder = [elara.id, elaraEnemy.id, elaraAlly.id];
aegisGame.adventure.target = 8;
aegisGame.playerStates[elara.id].hand = [rallyingAegis.id];
const aegisResult = engine.resolveCardTurn(aegisGame, elaraParty, rallyingAegis.id, elara.id, 20);
assert.equal(aegisResult.outcome.effect, "guard", "Lantern Phalanx resolves and synchronizes as a Guard card");
assert.equal(aegisResult.outcome.amount, 3, "Lantern-Forged Guard raises Lantern Phalanx from 2 to 3 shield per target");
assert.deepEqual(aegisResult.outcome.targetIds.sort(), [elara.id, elaraAlly.id].sort(), "Lantern Phalanx targets every living ally, including Elara");
assert.equal(aegisResult.playerStates[elara.id].shield, 3, "Lantern Phalanx shields Elara");
assert.equal(aegisResult.playerStates[elaraAlly.id].shield, 3, "Lantern Phalanx shields each living ally");
assert.equal(aegisResult.playerStates[elaraEnemy.id].shield, 0, "Lantern Phalanx never shields enemies");
engine.expireTimedEffectsAtTurnEnd(aegisResult.playerStates[elaraAlly.id]);
assert.equal(aegisResult.playerStates[elaraAlly.id].shield, 0, "Lantern Phalanx expires when an ally's next turn ends");
engine.expireTimedEffectsAtTurnEnd(aegisResult.playerStates[elara.id]);
assert.equal(aegisResult.playerStates[elara.id].shield, 0, "self-applied Lantern Phalanx expires when Elara's following turn ends");
const wardGame = engine.createInitialGame(elaraParty, engine.createAdventure("LANTERN-WARD-GUARD"), 30);
wardGame.turnOrder = [elara.id, elaraEnemy.id, elaraAlly.id];
wardGame.adventure.target = 8;
wardGame.playerStates[elara.id].hand = [lanternWard.id];
const wardResult = engine.resolveCardTurn(wardGame, elaraParty, lanternWard.id, elaraAlly.id, 20);
assert.equal(wardResult.outcome.amount, 4, "Lantern-Forged Guard raises Undying Ward from 3 to 4 shield");
const wardBreakdown = wardResult.outcome.effectBreakdowns.find((entry) => entry.id === `shield-${elaraAlly.id}`);
assert.deepEqual(wardBreakdown.parts.map((part) => [part.value, part.label]), [[3, "from Undying Ward card"], [1, "from Elara's Lantern-Forged Guard passive"]], "Guard outcomes separate base Shield from the character passive");
assert.equal(wardResult.playerStates[elaraAlly.id].shield, 4, "Undying Ward applies its passive-enhanced shield to the chosen ally");
const commonGuardGame = engine.createInitialGame(elaraParty, engine.createAdventure("ELARA-COMMON-GUARD"), 30);
commonGuardGame.turnOrder = [elara.id, elaraEnemy.id, elaraAlly.id];
commonGuardGame.adventure.target = 8;
commonGuardGame.playerStates[elara.id].hand = [elaraCommonGuard.id];
const commonGuardResult = engine.resolveCardTurn(commonGuardGame, elaraParty, elaraCommonGuard.id, elara.id, 20);
assert.equal(commonGuardResult.outcome.amount, elaraCommonGuard.value + 1, "Lantern-Forged Guard also strengthens Elara's common Guard cards");
const failedAegisGame = engine.createInitialGame(elaraParty, engine.createAdventure("RALLYING-AEGIS-FAILURE"), 30);
failedAegisGame.turnOrder = [elara.id, elaraEnemy.id, elaraAlly.id];
failedAegisGame.adventure.target = 20;
failedAegisGame.playerStates[elara.id].hand = [rallyingAegis.id];
const failedAegis = engine.resolveCardTurn(failedAegisGame, elaraParty, rallyingAegis.id, elara.id, 1);
assert.equal(failedAegis.outcome.success, false, "a failed Lantern Phalanx remains unsuccessful after becoming a Guard card");
assert.equal(failedAegis.playerStates[elara.id].shield, 0, "a failed Lantern Phalanx grants no shield to Elara");
assert.equal(failedAegis.playerStates[elaraAlly.id].shield, 0, "a failed Lantern Phalanx grants no shield to allies");
assert.equal(failedAegis.playerStates[elara.id].hp, elara.hero.maxHp - 1, "Lantern Phalanx failure still damages Elara's team");
assert.equal(failedAegis.playerStates[elaraAlly.id].hp, elaraAlly.hero.maxHp - 1, "Lantern Phalanx failure still damages every living ally");
assert.equal(failedAegis.playerStates[elaraEnemy.id].hp, elaraEnemy.hero.maxHp, "Lantern Phalanx failure never damages enemies");

const thorne = engine.createPlayerSession("Thorne", 0, "Thorne Vale", "thorne-passive");
const thorneTarget = engine.createPlayerSession("Second-Beat Deadeye target", 1, "Bram Coalhand", "thorne-target");
const thorneParty = [thorne, thorneTarget];
const markedArrow = thorne.skillDeck.find((card) => card.id === "tv-mark");
const thorneBlank = thorne.skillDeck.find((card) => card.effect === "none");
assert.equal(thorne.hero.passiveText, "Every second turn, Thorne's single-target attacks deal +1 damage.", "Second-Beat Deadeye uses the requested concise passive text");
assert.match(markedArrow.description, /5 when Second-Beat Deadeye triggers/i, "Deadeye Bolt states its triggered Second-Beat Deadeye damage");
assert.match(thorne.skillDeck.find((card) => card.id === "tv-pierce").description, /4 when Second-Beat Deadeye triggers/i, "Armor-Piercing Bolt states its triggered Second-Beat Deadeye damage");
const thorneCadenceState = engine.createInitialGame(thorneParty, engine.createAdventure("DEADEYE-CADENCE"), 30).playerStates[thorne.id];
assert.equal(engine.getThorneValePassiveDamageBonus(thorne, markedArrow, thorneCadenceState), 0, "Second-Beat Deadeye is inactive on Thorne's first battle turn");
engine.completeThorneValePassiveTurn(thorne, thorneCadenceState);
assert.equal(engine.getThorneValePassiveDamageBonus(thorne, markedArrow, thorneCadenceState), 1, "completing Thorne's first turn readies Second-Beat Deadeye for the second turn");
engine.completeThorneValePassiveTurn(thorne, thorneCadenceState);
engine.completeThorneValePassiveTurn(thorne, thorneCadenceState);
assert.equal(engine.getThorneValePassiveDamageBonus(thorne, markedArrow, thorneCadenceState), 1, "an unused Second-Beat Deadeye charge lasts through any number of Thorne turns");
assert.equal(engine.getThorneValePassiveDamageBonus(thorne, thorneBlank, thorneCadenceState), 0, "Second-Beat Deadeye only adds damage to single-target attacks");
const deadeyeGame = engine.createInitialGame(thorneParty, engine.createAdventure("DEADEYE-DAMAGE"), 30);
deadeyeGame.turnOrder = [thorne.id, thorneTarget.id];
deadeyeGame.adventure.target = 8;
deadeyeGame.playerStates[thorne.id].thorneDeadeyeCharge = true;
deadeyeGame.playerStates[thorne.id].attackBuff = 2;
deadeyeGame.playerStates[thorne.id].hand = [markedArrow.id];
deadeyeGame.playerStates[thorneTarget.id].hp = 14;
deadeyeGame.playerStates[thorneTarget.id].maxHp = 14;
const deadeyeAttack = engine.resolveCardTurn(deadeyeGame, thorneParty, markedArrow.id, thorneTarget.id, 20);
assert.equal(deadeyeAttack.outcome.amount, 7, "a charged Deadeye Bolt deals its 4 base damage, +1 Second-Beat Deadeye damage, and +2 attack buff");
const deadeyeBreakdown = deadeyeAttack.outcome.effectBreakdowns.find((entry) => entry.id === `damage-${thorneTarget.id}`);
assert.equal(deadeyeBreakdown.value, 7, "the Deadeye effect breakdown publishes the final HP loss");
assert.deepEqual(deadeyeBreakdown.parts.map((part) => [part.value, part.label]), [[4, "from Deadeye Bolt card"], [2, "from attack buff"], [1, "from Thorne's Second-Beat Deadeye passive"]], "the Deadeye effect breakdown separates card base damage, buff, and passive damage");
assert.deepEqual(deadeyeAttack.outcome.effectBreakdowns.find((entry) => entry.id === `gold-${thorne.id}`).parts.map((part) => [part.value, part.label]), [[1, "from a successful card action"]], "earned Gold publishes its own source");
assert.equal(deadeyeAttack.playerStates[thorneTarget.id].hp, 7, "Second-Beat Deadeye's bonus changes synchronized target HP in actual card resolution");
assert.equal(deadeyeAttack.playerStates[thorne.id].thorneDeadeyeCharge, false, "a successful single-target Attack consumes Thorne's ready passive charge");

const heldDeadeyeGame = engine.createInitialGame(thorneParty, engine.createAdventure("DEADEYE-HOLD"), 30);
heldDeadeyeGame.turnOrder = [thorne.id, thorneTarget.id];
heldDeadeyeGame.playerStates[thorne.id].thorneDeadeyeCharge = true;
heldDeadeyeGame.playerStates[thorne.id].hand = [thorneBlank.id];
const heldDeadeye = engine.resolveCardTurn(heldDeadeyeGame, thorneParty, thorneBlank.id, thorne.id, 20);
assert.equal(heldDeadeye.playerStates[thorne.id].thorneDeadeyeCharge, true, "playing a non-Attack card preserves Thorne's passive charge indefinitely");

const failedDeadeyeGame = engine.createInitialGame(thorneParty, engine.createAdventure("DEADEYE-FAIL"), 30);
failedDeadeyeGame.turnOrder = [thorne.id, thorneTarget.id];
failedDeadeyeGame.adventure.target = 20;
failedDeadeyeGame.playerStates[thorne.id].thorneDeadeyeCharge = true;
failedDeadeyeGame.playerStates[thorne.id].hand = [markedArrow.id];
const failedDeadeye = engine.resolveCardTurn(failedDeadeyeGame, thorneParty, markedArrow.id, thorneTarget.id, 1);
assert.equal(failedDeadeye.outcome.success, false);
assert.equal(failedDeadeye.playerStates[thorne.id].thorneDeadeyeCharge, true, "a failed Attack cannot apply or consume Thorne's passive charge");

const restartedDeadeyeGame = engine.createInitialGame(thorneParty, engine.createAdventure("DEADEYE-RESTART"), 30);
restartedDeadeyeGame.turnOrder = [thorne.id, thorneTarget.id];
restartedDeadeyeGame.playerStates[thorne.id].thorneDeadeyeCharge = false;
restartedDeadeyeGame.playerStates[thorne.id].hand = [thorneBlank.id];
const restartedDeadeye = engine.resolveCardTurn(restartedDeadeyeGame, thorneParty, thorneBlank.id, thorne.id, 20);
assert.equal(restartedDeadeye.playerStates[thorne.id].thorneDeadeyeCharge, true, "the turn after consumption counts as one and readies the buff for Thorne's following turn");

const reconciledDeadeyeAttack = structuredClone(deadeyeAttack);
reconciledDeadeyeAttack.playerStates[thorne.id].thorneDeadeyeCharge = true;
characterPassiveRules.reconcileThorneValePassive(deadeyeGame, reconciledDeadeyeAttack, thorne, thorneParty);
assert.equal(reconciledDeadeyeAttack.playerStates[thorne.id].thorneDeadeyeCharge, false, "realtime reconciliation consumes a forged retained charge after a successful Attack");
const reconciledDeadeyeRestart = structuredClone(restartedDeadeye);
reconciledDeadeyeRestart.playerStates[thorne.id].thorneDeadeyeCharge = false;
characterPassiveRules.reconcileThorneValePassive(restartedDeadeyeGame, reconciledDeadeyeRestart, thorne, thorneParty);
assert.equal(reconciledDeadeyeRestart.playerStates[thorne.id].thorneDeadeyeCharge, true, "realtime reconciliation starts the next passive count after an uncharged turn");

const mira = engine.createPlayerSession("Mira", 0, "Mira Ash", "mira-inferno");
const infernoTargetOne = engine.createPlayerSession("Wildfire Inferno target one", 1, "Bram Coalhand", "inferno-target-one");
const infernoTargetTwo = engine.createPlayerSession("Wildfire Inferno target two", 1, "Sable Fen", "inferno-target-two");
const infernoAlly = engine.createPlayerSession("Wildfire Inferno ally", 0, "Elara Voss", "inferno-ally");
const infernoParty = [mira, infernoTargetOne, infernoTargetTwo, infernoAlly];
const inferno = mira.skillDeck.find((card) => card.id === "ma-inferno");
assert.equal(mira.hero.hp, 9, "Mira Ash's printed HP is 9");
assert.equal(mira.hero.maxHp, 9, "Mira Ash begins battle with 9 max HP");
assert.equal(inferno.value, 3, "Wildfire Inferno has 3 base damage");
assert.equal(inferno.pityCost, 7, "Wildfire Inferno's pity cost accounts for its increased team-wide damage");
assert.match(inferno.description, /3 damage.*4 with Wildfire Reach/i, "Wildfire Inferno describes its base and passive-enhanced damage");
const infernoGame = engine.createInitialGame(infernoParty, engine.createAdventure("INFERNO-DAMAGE"), 30);
infernoGame.turnOrder = [mira.id, infernoTargetOne.id, infernoTargetTwo.id, infernoAlly.id];
infernoGame.adventure.target = 8;
infernoGame.playerStates[mira.id].hand = [inferno.id];
infernoGame.playerStates[infernoTargetOne.id].shield = 1;
const infernoResult = engine.resolveCardTurn(infernoGame, infernoParty, inferno.id, infernoTargetOne.id, 20);
assert.equal(infernoResult.outcome.amount, 7, "Wildfire Inferno deals 4 damage per enemy with Wildfire Reach, reduced normally by shield");
assert.deepEqual(infernoResult.outcome.effectBreakdowns.find((entry) => entry.id === `damage-${infernoTargetOne.id}`).parts.map((part) => part.value), [3, 1, -1], "damage breakdowns subtract blocked Shield from card and passive power");
assert.equal(infernoResult.playerStates[infernoTargetOne.id].hp, infernoTargetOne.hero.maxHp - 3, "shield blocks one point of Wildfire Inferno's passive-enhanced damage");
assert.equal(infernoResult.playerStates[infernoTargetTwo.id].hp, infernoTargetTwo.hero.maxHp - 4, "Wildfire Inferno deals 3 base plus 1 Wildfire Reach damage to each unshielded enemy");
assert.equal(infernoResult.playerStates[infernoAlly.id].hp, infernoAlly.hero.maxHp, "Wildfire Inferno never damages Mira's allies");

const nyx = engine.createPlayerSession("Nyx", 0, "Nyx Calder", "nyx-damage");
const nyxTarget = engine.createPlayerSession("Veilpiercer target", 1, "Bram Coalhand", "nyx-target");
const nyxParty = [nyx, nyxTarget];
const quietKnife = nyx.skillDeck.find((card) => card.id === "nc-knife");
const execute = nyx.skillDeck.find((card) => card.id === "nc-execute");
assert.equal(quietKnife.value, 3, "Veilpiercing Knife has 3 base damage");
assert.equal(execute.value, 4, "Veilpiercing Execution has 4 base damage");
assert.equal(quietKnife.pityCost, 6, "Veilpiercing Knife's pity cost accounts for Veilpiercer");
assert.equal(execute.pityCost, 7, "Veilpiercing Execution's pity cost follows the existing shield-piercing damage formula");
assert.match(quietKnife.description, /3 damage.*ignoring shield/i, "Veilpiercing Knife describes its reduced shield-piercing damage");
assert.match(execute.description, /4 damage.*ignoring shield/i, "Veilpiercing Execution describes its reduced shield-piercing damage");
const quietKnifeGame = engine.createInitialGame(nyxParty, engine.createAdventure("QUIET-KNIFE-DAMAGE"), 30);
quietKnifeGame.turnOrder = [nyx.id, nyxTarget.id];
quietKnifeGame.adventure.target = 8;
quietKnifeGame.playerStates[nyx.id].hand = [quietKnife.id];
quietKnifeGame.playerStates[nyxTarget.id].shield = 10;
const quietKnifeResult = engine.resolveCardTurn(quietKnifeGame, nyxParty, quietKnife.id, nyxTarget.id, 20);
assert.equal(quietKnifeResult.outcome.amount, 3, "Veilpiercing Knife deals exactly 3 HP damage through Veilpiercer");
assert.equal(quietKnifeResult.playerStates[nyxTarget.id].hp, nyxTarget.hero.maxHp - 3, "Veilpiercing Knife reduces target HP by its new base damage");
assert.equal(quietKnifeResult.playerStates[nyxTarget.id].shield, 10, "Veilpiercing Knife ignores shield without consuming it");
const executeGame = engine.createInitialGame(nyxParty, engine.createAdventure("EXECUTE-DAMAGE"), 30);
executeGame.turnOrder = [nyx.id, nyxTarget.id];
executeGame.adventure.target = 8;
executeGame.playerStates[nyx.id].hand = [execute.id];
executeGame.playerStates[nyxTarget.id].shield = 10;
const executeResult = engine.resolveCardTurn(executeGame, nyxParty, execute.id, nyxTarget.id, 20);
assert.equal(executeResult.outcome.amount, 4, "Veilpiercing Execution deals exactly 4 HP damage through Veilpiercer");
assert.equal(executeResult.playerStates[nyxTarget.id].hp, nyxTarget.hero.maxHp - 4, "Veilpiercing Execution reduces target HP by its new base damage");
assert.equal(executeResult.playerStates[nyxTarget.id].shield, 10, "Veilpiercing Execution ignores shield without consuming it");

const kael = engine.createPlayerSession("Kael", 0, "Kael Rook", "kael-damage");
const kaelTarget = engine.createPlayerSession("Unshielded Edge target", 1, "Bram Coalhand", "kael-target");
const kaelParty = [kael, kaelTarget];
const riposte = kael.skillDeck.find((card) => card.id === "kr-riposte");
const challenge = kael.skillDeck.find((card) => card.id === "kr-duel");
const kaelCommonAttack = kael.skillDeck.find((card) => !card.unique && card.id.endsWith("common-slash"));
assert.equal(riposte.value, 3, "Unshielded Riposte has 3 base damage");
assert.equal(challenge.value, 3, "Baresteel Challenge has 3 base damage");
assert.equal(riposte.pityCost, 5, "Unshielded Riposte's pity cost accounts for its reduced Unshielded Edge damage ceiling");
assert.equal(challenge.pityCost, 6, "Baresteel Challenge's pity cost accounts for its Unshielded Edge damage ceiling");
assert.match(kael.hero.passiveText, /Attack cards deal \+1 damage while he has no shield/i, "Unshielded Edge states Kael's shield condition and general Attack-card bonus");
assert.match(riposte.description, /3 damage.*\+1 with Unshielded Edge.*Kael has no shield/i, "Unshielded Riposte concisely describes its base and Unshielded Edge damage");
assert.match(challenge.description, /3 damage.*Unshielded Edge.*\+2 if Kael and the target have no shield.*\+1 if only Kael has no shield/i, "Baresteel Challenge concisely describes both Unshielded Edge levels");
const challengeOpenGame = engine.createInitialGame(kaelParty, engine.createAdventure("CHALLENGE-NO-SHIELD"), 30);
challengeOpenGame.turnOrder = [kael.id, kaelTarget.id];
challengeOpenGame.adventure.target = 8;
challengeOpenGame.playerStates[kael.id].hand = [challenge.id];
const challengeOpenResult = engine.resolveCardTurn(challengeOpenGame, kaelParty, challenge.id, kaelTarget.id, 20);
assert.equal(challengeOpenResult.outcome.amount, 5, "Baresteel Challenge deals 3 base plus 2 Unshielded Edge damage to an unshielded enemy");
assert.equal(challengeOpenResult.playerStates[kaelTarget.id].hp, kaelTarget.hero.maxHp - 5, "Baresteel Challenge receives +2 only when both Kael and the target have no shield");
const challengeTargetShieldedGame = engine.createInitialGame(kaelParty, engine.createAdventure("CHALLENGE-TARGET-SHIELDED"), 30);
challengeTargetShieldedGame.turnOrder = [kael.id, kaelTarget.id];
challengeTargetShieldedGame.adventure.target = 8;
challengeTargetShieldedGame.playerStates[kael.id].hand = [challenge.id];
challengeTargetShieldedGame.playerStates[kaelTarget.id].shield = 2;
const challengeTargetShieldedResult = engine.resolveCardTurn(challengeTargetShieldedGame, kaelParty, challenge.id, kaelTarget.id, 20);
assert.equal(challengeTargetShieldedResult.outcome.amount, 2, "Baresteel Challenge gains +1 when only Kael has no shield before the target blocks damage");
assert.equal(challengeTargetShieldedResult.playerStates[kaelTarget.id].shield, 0, "Baresteel Challenge removes the shielded target's 2 shield");
const challengeKaelShieldedGame = engine.createInitialGame(kaelParty, engine.createAdventure("CHALLENGE-KAEL-SHIELDED"), 30);
challengeKaelShieldedGame.turnOrder = [kael.id, kaelTarget.id];
challengeKaelShieldedGame.adventure.target = 8;
challengeKaelShieldedGame.playerStates[kael.id].shield = 2;
challengeKaelShieldedGame.playerStates[kael.id].hand = [challenge.id];
const challengeKaelShieldedResult = engine.resolveCardTurn(challengeKaelShieldedGame, kaelParty, challenge.id, kaelTarget.id, 20);
assert.equal(challengeKaelShieldedResult.outcome.amount, 3, "Baresteel Challenge receives no Unshielded Edge bonus when only the target has no shield");
const challengeBothShieldedGame = engine.createInitialGame(kaelParty, engine.createAdventure("CHALLENGE-BOTH-SHIELDED"), 30);
challengeBothShieldedGame.turnOrder = [kael.id, kaelTarget.id];
challengeBothShieldedGame.adventure.target = 8;
challengeBothShieldedGame.playerStates[kael.id].shield = 2;
challengeBothShieldedGame.playerStates[kael.id].hand = [challenge.id];
challengeBothShieldedGame.playerStates[kaelTarget.id].shield = 2;
const challengeBothShieldedResult = engine.resolveCardTurn(challengeBothShieldedGame, kaelParty, challenge.id, kaelTarget.id, 20);
assert.equal(challengeBothShieldedResult.outcome.amount, 1, "Baresteel Challenge receives no Unshielded Edge bonus when both Kael and the target have shield");
assert.equal(challengeBothShieldedResult.playerStates[kaelTarget.id].shield, 0, "the target's shield blocks Baresteel Challenge normally when Unshielded Edge is inactive");
const riposteOpenGame = engine.createInitialGame(kaelParty, engine.createAdventure("RIPOSTE-NO-SHIELD"), 30);
riposteOpenGame.turnOrder = [kael.id, kaelTarget.id];
riposteOpenGame.adventure.target = 8;
riposteOpenGame.playerStates[kael.id].hand = [riposte.id];
const riposteOpenResult = engine.resolveCardTurn(riposteOpenGame, kaelParty, riposte.id, kaelTarget.id, 20);
assert.equal(riposteOpenResult.outcome.amount, 4, "Unshielded Edge adds exactly 1 damage to Unshielded Riposte while Kael has no shield");
const commonAttackGame = engine.createInitialGame(kaelParty, engine.createAdventure("KAEL-COMMON-ATTACK"), 30);
commonAttackGame.turnOrder = [kael.id, kaelTarget.id];
commonAttackGame.adventure.target = 8;
commonAttackGame.playerStates[kael.id].hand = [kaelCommonAttack.id];
const commonAttackResult = engine.resolveCardTurn(commonAttackGame, kaelParty, kaelCommonAttack.id, kaelTarget.id, 20);
assert.equal(commonAttackResult.outcome.amount, kaelCommonAttack.value + 1, "Unshielded Edge also adds 1 damage to Kael's common Attack cards while he has no shield");
const shieldedCommonAttackGame = engine.createInitialGame(kaelParty, engine.createAdventure("KAEL-SHIELDED-COMMON-ATTACK"), 30);
shieldedCommonAttackGame.turnOrder = [kael.id, kaelTarget.id];
shieldedCommonAttackGame.adventure.target = 8;
shieldedCommonAttackGame.playerStates[kael.id].shield = 2;
shieldedCommonAttackGame.playerStates[kael.id].hand = [kaelCommonAttack.id];
const shieldedCommonAttackResult = engine.resolveCardTurn(shieldedCommonAttackGame, kaelParty, kaelCommonAttack.id, kaelTarget.id, 20);
assert.equal(shieldedCommonAttackResult.outcome.amount, kaelCommonAttack.value, "Unshielded Edge is inactive for common Attack cards while Kael has shield");

const dagan = engine.createPlayerSession("Dagan", 0, "Dagan Flint", "dagan-cleave");
const daganTarget = engine.createPlayerSession("Bloodied Cleave target", 1, "Elara Voss", "dagan-cleave-target");
const daganParty = [dagan, daganTarget];
const onslaught = dagan.skillDeck.find((card) => card.id === "df-none");
const cleave = dagan.skillDeck.find((card) => card.id === "df-cleave");
const daganCommonAttack = dagan.skillDeck.find((card) => !card.unique && card.id.endsWith("common-slash"));
const flintbloodFury = dagan.skillDeck.find((card) => card.id === "df-frenzy");
assert.equal(dagan.hero.passiveText, "At half HP or lower, Dagan's attacks deal +2 damage.", "Bloodied Power states the requested half-HP attack bonus");
assert.equal(onslaught.value, 3, "Bloodied Onslaught keeps 3 base damage");
assert.match(onslaught.description, /3 damage.*5 while Dagan is at half HP or lower/i, "Bloodied Onslaught describes its base and Bloodied Power damage");
assert.equal(cleave.value, 3, "Bloodied Cleave has 3 base damage");
assert.equal(cleave.pityCost, 7, "Bloodied Cleave's pity cost reflects its reduced damage tier");
assert.equal(cleave.failureValue, 2, "Bloodied Cleave's failure backlash reflects its reduced damage tier");
assert.match(cleave.description, /3 damage.*5 while Dagan is at half HP or lower/i, "Bloodied Cleave describes its base and Bloodied Power damage");
assert.equal(daganRules.getDaganFlintPassiveDamageBonus(dagan, cleave, { hp: 7, maxHp: 12 }), 0, "Bloodied Power is inactive above half HP");
assert.equal(daganRules.getDaganFlintPassiveDamageBonus(dagan, cleave, { hp: 6, maxHp: 12 }), 2, "Bloodied Power grants exactly +2 damage at half HP");
assert.equal(daganRules.getDaganFlintPassiveDamageBonus(dagan, cleave, { hp: 5, maxHp: 12 }), 2, "Bloodied Power remains active below half HP");
assert.equal(daganRules.getDaganFlintPassiveDamageBonus(dagan, flintbloodFury, { hp: 6, maxHp: 12 }), 0, "Bloodied Power does not add damage to Support cards");
assert.deepEqual(
  dagan.skillDeck.filter((card) => card.unique).map(({ unique: _unique, ...card }) => card),
  daganRules.DAGAN_FLINT_SPECIAL_CARDS.map((card) => ({ ...card })),
  "the catalog and authoritative Dagan migration share one exact special-card contract"
);
const legacyDaganPlayers = structuredClone(daganParty);
Object.assign(legacyDaganPlayers[0].skillDeck.find((card) => card.id === "df-cleave"), { value: 4, description: "Deal 4 damage to one living enemy (5 while Dagan is at half HP)." });
assert.equal(daganRules.normalizeDaganFlintCards(legacyDaganPlayers), true, "persisted rooms detect Dagan's previous special-card balance");
assert.deepEqual(
  legacyDaganPlayers[0].skillDeck.find((card) => card.id === "df-cleave"),
  { ...daganRules.DAGAN_FLINT_SPECIAL_CARDS.find((card) => card.id === "df-cleave"), unique: true },
  "persisted rooms migrate Bloodied Cleave to 3 base damage"
);
assert.equal(daganRules.normalizeDaganFlintCards(legacyDaganPlayers), false, "the Dagan persisted-room migration is idempotent");
const cleaveHealthyGame = engine.createInitialGame(daganParty, engine.createAdventure("CLEAVE-HEALTHY"), 30);
cleaveHealthyGame.turnOrder = [dagan.id, daganTarget.id];
cleaveHealthyGame.adventure.target = 8;
cleaveHealthyGame.playerStates[dagan.id].hp = dagan.hero.maxHp / 2 + 1;
cleaveHealthyGame.playerStates[dagan.id].hand = [cleave.id];
const cleaveHealthyResult = engine.resolveCardTurn(cleaveHealthyGame, daganParty, cleave.id, daganTarget.id, 20);
assert.equal(cleaveHealthyResult.outcome.amount, 3, "Bloodied Cleave deals exactly 3 damage while Dagan is above half HP");
assert.equal(cleaveHealthyResult.playerStates[daganTarget.id].hp, daganTarget.hero.maxHp - 3, "Bloodied Cleave applies its reduced base damage to synchronized target HP");
const cleaveWoundedGame = engine.createInitialGame(daganParty, engine.createAdventure("CLEAVE-WOUNDED"), 30);
cleaveWoundedGame.turnOrder = [dagan.id, daganTarget.id];
cleaveWoundedGame.adventure.target = 8;
cleaveWoundedGame.playerStates[dagan.id].hp = dagan.hero.maxHp / 2;
cleaveWoundedGame.playerStates[dagan.id].hand = [cleave.id];
const cleaveWoundedResult = engine.resolveCardTurn(cleaveWoundedGame, daganParty, cleave.id, daganTarget.id, 20);
assert.equal(cleaveWoundedResult.outcome.amount, 5, "Bloodied Power raises Bloodied Cleave from 3 to 5 damage at half HP");
assert.equal(cleaveWoundedResult.playerStates[daganTarget.id].hp, daganTarget.hero.maxHp - 5, "Bloodied Cleave's half-HP bonus updates synchronized target HP");
const onslaughtWoundedGame = engine.createInitialGame(daganParty, engine.createAdventure("ONSLAUGHT-WOUNDED"), 30);
onslaughtWoundedGame.turnOrder = [dagan.id, daganTarget.id];
onslaughtWoundedGame.adventure.target = 8;
onslaughtWoundedGame.playerStates[dagan.id].hp = dagan.hero.maxHp / 2;
onslaughtWoundedGame.playerStates[dagan.id].hand = [onslaught.id];
const onslaughtWoundedResult = engine.resolveCardTurn(onslaughtWoundedGame, daganParty, onslaught.id, daganTarget.id, 20);
assert.equal(onslaughtWoundedResult.outcome.amount, 5, "Bloodied Power raises Bloodied Onslaught from 3 to 5 damage per enemy at half HP");
assert.equal(onslaughtWoundedResult.playerStates[daganTarget.id].hp, daganTarget.hero.maxHp - 5, "Bloodied Onslaught applies the +2 passive bonus to synchronized enemy HP");
const commonBloodiedGame = engine.createInitialGame(daganParty, engine.createAdventure("COMMON-BLOODIED"), 30);
commonBloodiedGame.turnOrder = [dagan.id, daganTarget.id];
commonBloodiedGame.adventure.target = 8;
commonBloodiedGame.playerStates[dagan.id].hp = dagan.hero.maxHp / 2 - 1;
commonBloodiedGame.playerStates[dagan.id].hand = [daganCommonAttack.id];
const commonBloodiedResult = engine.resolveCardTurn(commonBloodiedGame, daganParty, daganCommonAttack.id, daganTarget.id, 20);
assert.equal(commonBloodiedResult.outcome.amount, daganCommonAttack.value + 2, "Bloodied Power also grants +2 damage to Dagan's common Attack cards below half HP");

const healer = engine.createPlayerSession("Orren", 0, "Brother Orren", "healer");
const supportAlly = engine.createPlayerSession("Support ally", 2, "Elara Voss", "support-ally");
const supportEnemy = engine.createPlayerSession("Support enemy", 1, "Thorne Vale", "support-enemy");
const supportParty = [healer, supportEnemy, supportAlly];
const prayerOfLife = healer.skillDeck.find((card) => card.id === "bo-prayer");
const sharedBlessing = healer.skillDeck.find((card) => card.id === "bo-blessing");
const orrenCommonHeal = healer.skillDeck.find((card) => !card.unique && card.effect === "heal");
assert.match(healer.hero.passiveText, /Orren's Heal cards restore \+1 HP/i, "Graceful Restoration grants exactly +1 HP to Orren's Heal cards");
assert.equal(prayerOfLife.value, 3, "Graceful Renewal restores 3 base HP");
assert.equal(prayerOfLife.pityCost, 5, "Graceful Renewal follows the Heal-card pity formula after its reduction");
assert.match(prayerOfLife.description, /3 HP.*4 with Graceful Restoration/i, "Graceful Renewal describes its base and passive-enhanced healing");
assert.equal(sharedBlessing.effect, "heal", "Shared Restoration is a Heal card");
assert.equal(sharedBlessing.supportType, undefined, "Shared Restoration no longer carries a Support subtype");
assert.equal(sharedBlessing.value, 2, "Shared Restoration keeps its 2 base healing");
assert.equal(sharedBlessing.pityCost, 6, "Shared Restoration's pity cost accounts for healing every living ally");
assert.match(sharedBlessing.description, /2 HP.*3 with Graceful Restoration/i, "Shared Restoration describes its base and passive-enhanced healing");
assert.equal(cardRules.getCardEffectLabel(sharedBlessing), "Heal all allies", "Shared Restoration's player-facing action type matches its all-allies Heal effect");
const healGame = engine.createInitialGame(supportParty, engine.createAdventure("HEAL"), 30);
healGame.turnOrder = [healer.id, supportEnemy.id, supportAlly.id];
healGame.playerStates[healer.id].hand = [prayerOfLife.id];
healGame.playerStates[supportAlly.id].hp = 1;
const allyHealed = engine.resolveCardTurn(healGame, supportParty, prayerOfLife.id, supportAlly.id, 20);
assert.equal(allyHealed.outcome.amount, 4, "Graceful Restoration raises Graceful Renewal from 3 to 4 restored HP");
assert.deepEqual(allyHealed.outcome.effectBreakdowns.find((entry) => entry.id === `healing-${supportAlly.id}`).parts.map((part) => [part.value, part.label]), [[3, "from Graceful Renewal card"], [1, "from Orren's Graceful Restoration passive"]], "Heal outcomes separate card healing from passive healing");
assert.equal(allyHealed.playerStates[supportAlly.id].hp, 5, "Graceful Renewal restores the chosen ally with its updated passive bonus");
assert.equal(allyHealed.playerStates[healer.id].hp, healer.hero.maxHp, "ally heal does not redirect to the caster");

const commonHealGame = engine.createInitialGame(supportParty, engine.createAdventure("ORREN-COMMON-HEAL"), 30);
commonHealGame.turnOrder = [healer.id, supportEnemy.id, supportAlly.id];
commonHealGame.playerStates[healer.id].hp = 1;
commonHealGame.playerStates[healer.id].hand = [orrenCommonHeal.id];
const commonHealed = engine.resolveCardTurn(commonHealGame, supportParty, orrenCommonHeal.id, healer.id, 20);
assert.equal(commonHealed.outcome.amount, orrenCommonHeal.value + 1, "Graceful Restoration also strengthens Orren's common Heal card");
assert.equal(commonHealed.playerStates[healer.id].hp, 1 + orrenCommonHeal.value + 1, "Orren's common Heal card applies the passive in real resolution");

const tank = engine.createPlayerSession("Bram", 0, "Bram Coalhand", "tank");
const tankAlly = engine.createPlayerSession("Tank ally", 2, "Mira Ash", "tank-ally");
const tankEnemy = engine.createPlayerSession("Tank enemy", 1, "Nyx Calder", "tank-enemy");
const tankParty = [tank, tankEnemy, tankAlly];
const livingFortress = tank.skillDeck.find((card) => card.id === "bc-fortress");
const temperArmor = tank.skillDeck.find((card) => card.id === "bc-temper");
const shieldforgedAssault = tank.skillDeck.find((card) => card.id === "bc-march");
const bramBrace = tank.skillDeck.find((card) => !card.unique && card.effect === "guard");
assert.match(tank.hero.passiveText, /shields granted by Bram's Guard cards last for 2 turns/i, "Two-Turn Temper states its two-turn Guard duration");
assert.equal(livingFortress.value, 4, "Two-Turn Bastion grants 4 base shield");
assert.equal(livingFortress.pityCost, 6, "Two-Turn Bastion follows the Guard-card pity formula after its shield reduction");
assert.equal(temperArmor.effect, "guard", "Tempered Phalanx is a Guard card");
assert.equal(temperArmor.supportType, undefined, "Tempered Phalanx no longer carries a Support subtype");
assert.equal(temperArmor.value, 3, "Tempered Phalanx grants 3 base shield");
assert.equal(temperArmor.pityCost, 7, "Tempered Phalanx's pity cost accounts for team-wide, two-turn shield");
assert.match(bramBrace.description, /expires at the end of your second turn/i, "Bram's common Guard card describes Two-Turn Temper's duration");
assert.equal(shieldforgedAssault.name, "Bulwark to Blade", "Fortified March is renamed to match its shield conversion effect");
assert.equal(shieldforgedAssault.effect, "damage", "Bulwark to Blade is an Attack card");
assert.equal(shieldforgedAssault.supportType, undefined, "Bulwark to Blade no longer uses a delayed Support effect");
assert.equal(shieldforgedAssault.target, "enemy", "Bulwark to Blade targets one living enemy");
assert.equal(shieldforgedAssault.value, 0, "Bulwark to Blade derives its base damage from current shield instead of a flat value");
assert.equal(shieldforgedAssault.pityCost, 7, "Bulwark to Blade's pity cost reflects its variable high damage and full shield sacrifice");
assert.equal(shieldforgedAssault.failureEffect, "lose-shield", "Bulwark to Blade risks its defensive resource on failure");
assert.equal(shieldforgedAssault.failureValue, 4, "Bulwark to Blade loses up to one Bastion-sized shield on failure");
assert.equal(cardRules.getCardEffectLabel(shieldforgedAssault), "Single-target attack", "Bulwark to Blade's player-facing action type is Attack");
assert.match(shieldforgedAssault.description, /remove all.*current shield.*deal that much damage.*one living enemy/i, "Bulwark to Blade fully describes its immediate shield sacrifice and enemy damage");
assert.deepEqual(
  Object.fromEntries(Object.keys(bulwarkRules.BULWARK_TO_BLADE_CARD).map((key) => [key, shieldforgedAssault[key]])),
  { ...bulwarkRules.BULWARK_TO_BLADE_CARD },
  "the catalog and authoritative Bulwark to Blade migration share one exact runtime contract"
);
const legacyBulwarkPlayers = structuredClone(tankParty);
const legacyBulwark = legacyBulwarkPlayers[0].skillDeck.find((card) => card.id === "bc-march");
Object.assign(legacyBulwark, { description: "Convert half your shield.", effect: "support", target: "self", supportType: "shield-to-attack", failureValue: 2, pityCost: 6 });
assert.equal(bulwarkRules.normalizeBulwarkToBladeCards(legacyBulwarkPlayers), true, "persisted rooms detect the legacy Bulwark to Blade snapshot");
assert.deepEqual(legacyBulwarkPlayers[0].skillDeck.find((card) => card.id === "bc-march"), bulwarkRules.BULWARK_TO_BLADE_CARD, "persisted rooms migrate Bulwark to Blade to the new Attack contract");
assert.equal(bulwarkRules.normalizeBulwarkToBladeCards(legacyBulwarkPlayers), false, "the persisted-room migration is idempotent");
const guardGame = engine.createInitialGame(tankParty, engine.createAdventure("GUARD"), 30);
guardGame.turnOrder = [tank.id, tankEnemy.id, tankAlly.id];
guardGame.playerStates[tank.id].hand = [livingFortress.id];
const allyGuarded = engine.resolveCardTurn(guardGame, tankParty, livingFortress.id, tankAlly.id, 20);
assert.equal(allyGuarded.outcome.amount, 4, "Two-Turn Temper no longer increases Guard shield strength");
assert.equal(allyGuarded.playerStates[tankAlly.id].shield, 4, "Two-Turn Bastion grants its updated 4 shield to the chosen ally");
engine.expireTimedEffectsAtTurnEnd(allyGuarded.playerStates[tankAlly.id]);
assert.equal(allyGuarded.playerStates[tankAlly.id].shield, 4, "Bram's Guard shield remains after the target's first turn");
engine.expireTimedEffectsAtTurnEnd(allyGuarded.playerStates[tankAlly.id]);
assert.equal(allyGuarded.playerStates[tankAlly.id].shield, 0, "Bram's Guard shield expires after the target's second turn");

const bramBraceGame = engine.createInitialGame(tankParty, engine.createAdventure("BRAM-BRACE"), 30);
bramBraceGame.turnOrder = [tank.id, tankEnemy.id, tankAlly.id];
bramBraceGame.playerStates[tank.id].hand = [bramBrace.id];
const bramBraced = engine.resolveCardTurn(bramBraceGame, tankParty, bramBrace.id, tank.id, 20);
assert.equal(bramBraced.playerStates[tank.id].shield, 2, "Bram's common Guard card uses Brace's reduced base shield value");
engine.expireTimedEffectsAtTurnEnd(bramBraced.playerStates[tank.id]);
assert.equal(bramBraced.playerStates[tank.id].shield, 2, "a self-applied Bram Guard remains through Bram's next turn");
engine.expireTimedEffectsAtTurnEnd(bramBraced.playerStates[tank.id]);
assert.equal(bramBraced.playerStates[tank.id].shield, 0, "a self-applied Bram Guard expires after Bram's second future turn");

const temperGame = engine.createInitialGame(tankParty, engine.createAdventure("TEMPER-ARMOR"), 30);
temperGame.turnOrder = [tank.id, tankEnemy.id, tankAlly.id];
temperGame.playerStates[tank.id].hand = [temperArmor.id];
const teamTempered = engine.resolveCardTurn(temperGame, tankParty, temperArmor.id, tank.id, 20);
assert.equal(teamTempered.outcome.effect, "guard", "Tempered Phalanx resolves and synchronizes as a Guard card");
assert.equal(teamTempered.outcome.amount, 3, "Tempered Phalanx resolves at 3 shield per target");
assert.deepEqual(teamTempered.outcome.targetIds.sort(), [tank.id, tankAlly.id].sort(), "Tempered Phalanx targets every living ally, including Bram");
assert.equal(teamTempered.playerStates[tank.id].shield, 3, "Tempered Phalanx shields Bram");
assert.equal(teamTempered.playerStates[tankAlly.id].shield, 3, "Tempered Phalanx shields each living ally");
assert.equal(teamTempered.playerStates[tankEnemy.id].shield, 0, "Tempered Phalanx never shields enemies");
assert.equal(teamTempered.playerStates[tankAlly.id].timedEffects.find((effect) => effect.kind === "shield").expiresAfterTurn - teamTempered.playerStates[tankAlly.id].completedPlayerTurns, 2, "Tempered Phalanx shield remains for two target turns");

const conversionGame = engine.createInitialGame(tankParty, engine.createAdventure("BULWARK-TO-BLADE"), 30);
conversionGame.turnOrder = [tank.id, tankEnemy.id, tankAlly.id];
conversionGame.adventure.target = 8;
conversionGame.playerStates[tank.id].hand = [shieldforgedAssault.id];
conversionGame.playerStates[tank.id].shield = 5;
conversionGame.playerStates[tank.id].timedEffects = [{ kind: "shield", value: 5, expiresAfterTurn: 10 }];
conversionGame.playerStates[tankAlly.id].shield = 8;
conversionGame.playerStates[tankAlly.id].timedEffects = [{ kind: "shield", value: 8, expiresAfterTurn: 10 }];
conversionGame.playerStates[tankEnemy.id].shield = 0;
conversionGame.playerStates[tankEnemy.id].timedEffects = [];
const shieldsForged = engine.resolveCardTurn(conversionGame, tankParty, shieldforgedAssault.id, tankEnemy.id, 20);
assert.equal(shieldsForged.outcome.amount, 5, "Bulwark to Blade reports the HP damage dealt from Bram's five shield");
assert.equal(shieldsForged.outcome.effect, "damage", "Bulwark to Blade synchronizes as an Attack card");
assert.deepEqual(shieldsForged.outcome.targetIds, [tankEnemy.id], "Bulwark to Blade synchronizes its chosen living enemy");
assert.equal(shieldsForged.playerStates[tank.id].shield, 0, "Bulwark to Blade removes all of Bram's current shield");
assert.equal(shieldsForged.playerStates[tank.id].timedEffects.some((effect) => effect.kind === "shield"), false, "Bulwark to Blade removes Bram's timed shield bookkeeping");
assert.equal(shieldsForged.playerStates[tankEnemy.id].hp, tankEnemy.hero.maxHp - 5, "Bulwark to Blade immediately deals damage equal to the removed shield");
assert.equal(shieldsForged.playerStates[tank.id].attackBuff, 0, "Bulwark to Blade creates no delayed attack bonus");
assert.equal(shieldsForged.playerStates[tankAlly.id].shield, 8, "Bulwark to Blade preserves allied shield");
assert.match(shieldsForged.outcome.detail, /removed 5 shield.*lost 5 HP/i, "Bulwark to Blade reports both the shield sacrifice and immediate damage");

const authorityReconciled = structuredClone(shieldsForged);
authorityReconciled.playerStates[tank.id].shield = 5;
authorityReconciled.playerStates[tank.id].timedEffects = [{ kind: "shield", value: 5, expiresAfterTurn: 10 }];
authorityReconciled.playerStates[tankEnemy.id].hp = tankEnemy.hero.maxHp;
authorityReconciled.outcome.amount = 0;
authorityReconciled.outcome.detail = "Client omitted the effect.";
assert.equal(bulwarkRules.reconcileBulwarkToBladeImpact(conversionGame, authorityReconciled, tank, tankParty), "", "the realtime authority accepts a valid Bulwark to Blade target");
assert.equal(authorityReconciled.playerStates[tank.id].shield, 0, "the realtime authority enforces the complete shield sacrifice");
assert.equal(authorityReconciled.playerStates[tank.id].timedEffects.some((effect) => effect.kind === "shield"), false, "the realtime authority removes sacrificed timed shield");
assert.equal(authorityReconciled.playerStates[tankEnemy.id].hp, tankEnemy.hero.maxHp - 5, "the realtime authority restores omitted shield-powered damage");
assert.equal(authorityReconciled.outcome.amount, 5, "the realtime authority publishes corrected damage");
assert.match(authorityReconciled.outcome.detail, /removed 5 shield.*lost 5 HP/i, "the realtime authority publishes corrected effect detail");

const bloodiedBulwarkParty = [dagan, daganTarget, tank];
const bloodiedBulwarkGame = engine.createInitialGame(bloodiedBulwarkParty, engine.createAdventure("BLOODIED-BULWARK"), 30);
bloodiedBulwarkGame.turnOrder = [dagan.id, daganTarget.id, tank.id];
bloodiedBulwarkGame.adventure.target = 8;
bloodiedBulwarkGame.playerStates[dagan.id].hp = dagan.hero.maxHp / 2;
bloodiedBulwarkGame.playerStates[dagan.id].shield = 1;
bloodiedBulwarkGame.playerStates[dagan.id].hand = [shieldforgedAssault.id];
bloodiedBulwarkGame.playerStates[dagan.id].borrowedCards = [{ cardId: shieldforgedAssault.id, ownerId: tank.id, borrowedAtTurn: 0, expiresAfterBorrowerTurn: 2 }];
const bloodiedBulwark = engine.resolveCardTurn(bloodiedBulwarkGame, bloodiedBulwarkParty, shieldforgedAssault.id, daganTarget.id, 20);
assert.equal(bloodiedBulwark.outcome.amount, 3, "Bloodied Power adds +2 damage when Dagan uses a borrowed Attack card");
const reconciledBloodiedBulwark = structuredClone(bloodiedBulwark);
reconciledBloodiedBulwark.playerStates[daganTarget.id].hp = daganTarget.hero.maxHp;
reconciledBloodiedBulwark.outcome.amount = 0;
assert.equal(bulwarkRules.reconcileBulwarkToBladeImpact(bloodiedBulwarkGame, reconciledBloodiedBulwark, dagan, bloodiedBulwarkParty), "", "the realtime authority accepts Dagan's valid borrowed Bulwark to Blade target");
assert.equal(reconciledBloodiedBulwark.playerStates[daganTarget.id].hp, daganTarget.hero.maxHp - 3, "the realtime authority applies Dagan's +2 passive to a borrowed Attack card");
assert.equal(reconciledBloodiedBulwark.outcome.amount, 3, "the realtime authority publishes Dagan's corrected borrowed-card damage");

const rejectedAuthorityTarget = structuredClone(shieldsForged);
rejectedAuthorityTarget.outcome.targetIds = [tankAlly.id];
assert.match(bulwarkRules.reconcileBulwarkToBladeImpact(conversionGame, rejectedAuthorityTarget, tank, tankParty), /one living enemy/i, "the realtime authority rejects an allied Bulwark to Blade target");

const blockedConversionGame = structuredClone(conversionGame);
blockedConversionGame.playerStates[tank.id].hand = [shieldforgedAssault.id];
blockedConversionGame.playerStates[tank.id].attackBuff = 2;
blockedConversionGame.playerStates[tank.id].timedEffects.push({ kind: "attackBuff", value: 2, expiresAfterTurn: 10 });
blockedConversionGame.playerStates[tankEnemy.id].shield = 3;
blockedConversionGame.playerStates[tankEnemy.id].timedEffects = [{ kind: "shield", value: 3, expiresAfterTurn: 10 }];
const blockedConversion = engine.resolveCardTurn(blockedConversionGame, tankParty, shieldforgedAssault.id, tankEnemy.id, 20);
assert.equal(blockedConversion.playerStates[tank.id].shield, 0, "a shielded target does not reduce Bram's full shield sacrifice");
assert.equal(blockedConversion.playerStates[tankEnemy.id].shield, 0, "the target's shield blocks Bulwark to Blade through normal Attack rules");
assert.equal(blockedConversion.playerStates[tankEnemy.id].hp, tankEnemy.hero.maxHp - 4, "five sacrificed shield plus two attack bonus deals four HP after three shield is blocked");
assert.equal(blockedConversion.outcome.amount, 4, "Bulwark to Blade reports actual HP damage after blocking");
assert.equal(blockedConversion.playerStates[tank.id].attackBuff, 0, "Bulwark to Blade consumes an existing next-attack bonus");

const zeroShieldGame = structuredClone(conversionGame);
zeroShieldGame.playerStates[tank.id].hand = [shieldforgedAssault.id];
zeroShieldGame.playerStates[tank.id].shield = 0;
zeroShieldGame.playerStates[tank.id].timedEffects = [];
const zeroShieldAttack = engine.resolveCardTurn(zeroShieldGame, tankParty, shieldforgedAssault.id, tankEnemy.id, 20);
assert.equal(zeroShieldAttack.outcome.success, true, "Bulwark to Blade can succeed with zero shield");
assert.equal(zeroShieldAttack.outcome.amount, 0, "zero current shield produces zero base damage");
assert.equal(zeroShieldAttack.playerStates[tankEnemy.id].hp, tankEnemy.hero.maxHp, "zero-shield Bulwark to Blade does not reduce enemy HP");

const invalidTargetGame = structuredClone(conversionGame);
invalidTargetGame.playerStates[tank.id].hand = [shieldforgedAssault.id];
const invalidTargetAttack = engine.resolveCardTurn(invalidTargetGame, tankParty, shieldforgedAssault.id, tankAlly.id, 20);
assert.equal(invalidTargetAttack.outcome.success, true, "an invalid target does not falsify a successful roll");
assert.equal(invalidTargetAttack.outcome.amount, 0, "an invalid target produces no damage");
assert.equal(invalidTargetAttack.playerStates[tank.id].shield, 5, "an invalid enemy target does not consume Bram's shield");
assert.equal(invalidTargetAttack.playerStates[tankAlly.id].hp, tankAlly.hero.maxHp, "Bulwark to Blade cannot damage an ally");

const failedConversionGame = structuredClone(conversionGame);
failedConversionGame.adventure.target = 20;
failedConversionGame.playerStates[tank.id].hand = [shieldforgedAssault.id];
const failedConversion = engine.resolveCardTurn(failedConversionGame, tankParty, shieldforgedAssault.id, tankEnemy.id, 1);
assert.equal(failedConversion.outcome.success, false, "a failed Bulwark to Blade deals no damage");
assert.equal(failedConversion.playerStates[tank.id].shield, 1, "failed Bulwark to Blade removes up to 4 of Bram's shield");
assert.equal(failedConversion.playerStates[tank.id].timedEffects.filter((effect) => effect.kind === "shield").reduce((sum, effect) => sum + effect.value, 0), 1, "failed Bulwark to Blade keeps remaining timed shield synchronized");
assert.equal(failedConversion.playerStates[tankEnemy.id].hp, tankEnemy.hero.maxHp, "failed Bulwark to Blade preserves enemy HP");
assert.equal(failedConversion.playerStates[tankAlly.id].shield, 8, "failed Bulwark to Blade preserves allied shield");
assert.equal(failedConversion.playerStates[tank.id].hp, tank.hero.maxHp, "Bulwark to Blade failure does not damage Bram");

const pityConversionGame = structuredClone(conversionGame);
pityConversionGame.adventure.target = 20;
pityConversionGame.playerStates[tank.id].hand = [shieldforgedAssault.id];
pityConversionGame.playerStates[tank.id].pityPoints = 7;
const pityConversion = engine.resolveCardTurn(pityConversionGame, tankParty, shieldforgedAssault.id, tankEnemy.id, 1, true);
assert.equal(pityConversion.outcome.success, true, "a 7-pity Bulwark to Blade succeeds regardless of the d20");
assert.equal(pityConversion.outcome.pityCost, 7, "Bulwark to Blade spends its rebalanced pity cost");
assert.equal(pityConversion.playerStates[tank.id].pityPoints, 0, "Bulwark to Blade deducts all seven pity points");
assert.equal(pityConversion.playerStates[tank.id].shield, 0, "pity success still pays the full shield sacrifice");
assert.equal(pityConversion.playerStates[tankEnemy.id].hp, tankEnemy.hero.maxHp - 5, "pity success applies the same shield-powered damage");

const insufficientBulwarkPityGame = structuredClone(conversionGame);
insufficientBulwarkPityGame.playerStates[tank.id].hand = [shieldforgedAssault.id];
insufficientBulwarkPityGame.playerStates[tank.id].pityPoints = 6;
const insufficientPity = engine.resolveCardTurn(insufficientBulwarkPityGame, tankParty, shieldforgedAssault.id, tankEnemy.id, 1, true);
assert.equal(insufficientPity, insufficientBulwarkPityGame, "six pity cannot activate the rebalanced seven-pity Bulwark to Blade");
assert.equal(insufficientPity.playerStates[tank.id].shield, 5, "a rejected pity attempt cannot consume Bram's shield");

const teamHealGame = engine.createInitialGame(supportParty, engine.createAdventure("TEAM-HEAL"), 30);
teamHealGame.turnOrder = [healer.id, supportEnemy.id, supportAlly.id];
teamHealGame.playerStates[healer.id].hand = [sharedBlessing.id];
teamHealGame.playerStates[healer.id].hp = 5;
teamHealGame.playerStates[supportAlly.id].hp = 2;
const teamHealed = engine.resolveCardTurn(teamHealGame, supportParty, sharedBlessing.id, healer.id, 20);
assert.equal(teamHealed.outcome.effect, "heal", "Shared Restoration resolves and synchronizes as a Heal card");
assert.equal(teamHealed.outcome.amount, 6, "Shared Restoration reports the total HP restored across both living allies");
assert.deepEqual(teamHealed.outcome.targetIds.sort(), [healer.id, supportAlly.id].sort(), "Shared Restoration targets every living ally, including Orren");
assert.equal(teamHealed.playerStates[healer.id].hp, 8, "Shared Restoration restores 3 HP to Orren with Graceful Restoration");
assert.equal(teamHealed.playerStates[supportAlly.id].hp, 5, "Shared Restoration restores 3 HP to each living ally");
assert.equal(teamHealed.playerStates[supportEnemy.id].hp, supportEnemy.hero.maxHp, "Shared Restoration never heals enemies");

const cappedBlessingGame = engine.createInitialGame(supportParty, engine.createAdventure("CAPPED-SHARED-BLESSING"), 30);
cappedBlessingGame.turnOrder = [healer.id, supportEnemy.id, supportAlly.id];
cappedBlessingGame.playerStates[healer.id].hand = [sharedBlessing.id];
cappedBlessingGame.playerStates[healer.id].hp = healer.hero.maxHp - 1;
cappedBlessingGame.playerStates[supportAlly.id].hp = supportAlly.hero.maxHp - 2;
const cappedBlessing = engine.resolveCardTurn(cappedBlessingGame, supportParty, sharedBlessing.id, healer.id, 20);
assert.equal(cappedBlessing.playerStates[healer.id].hp, healer.hero.maxHp, "Shared Restoration cannot heal Orren above max HP");
assert.equal(cappedBlessing.playerStates[supportAlly.id].hp, supportAlly.hero.maxHp, "Shared Restoration cannot heal an ally above max HP");
assert.equal(cappedBlessing.outcome.amount, 3, "Shared Restoration reports only HP actually restored when targets are capped");

const failedBlessingGame = engine.createInitialGame(supportParty, engine.createAdventure("FAILED-SHARED-BLESSING"), 30);
failedBlessingGame.turnOrder = [healer.id, supportEnemy.id, supportAlly.id];
failedBlessingGame.adventure.target = 20;
failedBlessingGame.playerStates[healer.id].hand = [sharedBlessing.id];
failedBlessingGame.playerStates[healer.id].hp = 5;
failedBlessingGame.playerStates[supportAlly.id].hp = 2;
const failedBlessing = engine.resolveCardTurn(failedBlessingGame, supportParty, sharedBlessing.id, healer.id, 1);
assert.equal(failedBlessing.outcome.success, false, "a failed Shared Restoration grants no healing");
assert.equal(failedBlessing.playerStates[healer.id].hp, 4, "Shared Restoration retains its 1 team-damage failure for Orren");
assert.equal(failedBlessing.playerStates[supportAlly.id].hp, 1, "Shared Restoration failure damages every living ally instead of healing them");
assert.equal(failedBlessing.playerStates[supportEnemy.id].hp, supportEnemy.hero.maxHp, "Shared Restoration failure never damages enemies");

const commander = engine.createPlayerSession("Ione", 0, "Ione Mire", "commander");
const diceAlly = engine.createPlayerSession("Dice ally", 2, "Dagan Flint", "dice-ally");
const diceEnemy = engine.createPlayerSession("Dice enemy", 1, "Kael Rook", "dice-enemy");
const diceParty = [commander, diceEnemy, diceAlly];
const diceGame = engine.createInitialGame(diceParty, engine.createAdventure("DICE"), 30);
diceGame.turnOrder = [commander.id, diceEnemy.id, diceAlly.id];
const diceCard = commander.skillDeck.find((card) => card.supportType === "dice");
assert.equal(diceCard.name, "Precision Order", "Precision Order is the only allied d20 buff card");
diceGame.playerStates[commander.id].hand = [diceCard.id];
const diceBuffed = engine.resolveCardTurn(diceGame, diceParty, diceCard.id, commander.id, 20);
assert.equal(diceBuffed.outcome.bonus, 1, "Marshal's Fortune applies to Ione's special cards");
assert.equal(diceBuffed.outcome.cardBonus, 0, "the outcome captures the played card's direct d20 contribution");
assert.equal(diceBuffed.outcome.passiveBonus, 1, "the outcome captures Marshal's Fortune separately");
assert.equal(diceBuffed.outcome.diceBuff, 0, "the outcome captures the pre-roll stored buff separately");
assert.equal(diceBuffed.outcome.shopDiceBonus, 0, "the outcome captures the pre-roll Shop contribution separately");
assert.equal(diceBuffed.outcome.markedTargetBonus, 0, "the outcome captures the pre-roll Marked Target contribution separately");
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
assert.equal(boostedRoll.outcome.diceBuff, 2, "the consumed Precision Order value remains available to the result breakdown");
assert.doesNotMatch(boostedRoll.history.at(-1).message, /\+ bonus|- penalty/, "shared history prose does not expose a player's dice modifier");
assert.equal(boostedRoll.playerStates[diceAlly.id].diceBuff, 0, "next-turn d20 bonus is consumed after one roll");
assert.equal(engine.getPassiveDiceBonus(commander, commander.skillDeck.find((card) => card.effect === "none"), diceBuffed.playerStates[commander.id]), 1, "Ione adds +1 to every d20 result");

const oracle = engine.createPlayerSession("Sable", 0, "Sable Fen", "oracle");
const cursedEnemy = engine.createPlayerSession("Cursed enemy", 1, "Thorne Vale", "cursed-enemy");
const oracleAlly = engine.createPlayerSession("Oracle ally", 2, "Dagan Flint", "oracle-ally");
const curseParty = [oracle, cursedEnemy, oracleAlly];
const favorableOmen = oracle.skillDeck.find((card) => card.id === "sf-favor");
assert.equal(favorableOmen.supportType, "zero-pity", "Foretold Success grants a zero-pity card instead of shield or a d20 modifier");
assert.equal(favorableOmen.target, "ally", "Foretold Success chooses one living ally, including Sable Fen");
assert.match(favorableOmen.description, /living ally.*including yourself.*next card.*next turn.*0 pity.*expires.*end of that turn/i, "Foretold Success's description explains its complete updated effect");
assert.doesNotMatch(favorableOmen.description, /third use|graveyard/i, "Foretold Success no longer describes a use limit");
const favorableGame = engine.createInitialGame(curseParty, engine.createAdventure("FAVOR"), 30);
favorableGame.turnOrder = [oracle.id, cursedEnemy.id, oracleAlly.id];
favorableGame.playerStates[oracle.id].hand = [favorableOmen.id];
const favorableResult = engine.resolveCardTurn(favorableGame, curseParty, favorableOmen.id, oracleAlly.id, 20);
assert.equal(favorableResult.playerStates[oracle.id].diceBuff, 0, "Foretold Success cannot create a d20 buff");
assert.equal(favorableResult.playerStates[oracleAlly.id].diceBuff, 0, "Foretold Success cannot create allied d20 buffs");
assert.equal(favorableResult.playerStates[oracle.id].shield, 0, "Foretold Success no longer creates shield");
assert.equal(favorableResult.playerStates[oracleAlly.id].zeroPityUntilTurn, 1, "the chosen ally receives a zero-pity card for their next turn");
const skippedOmenState = structuredClone(favorableResult.playerStates[oracleAlly.id]);
engine.expireTimedEffectsAtTurnEnd(skippedOmenState);
assert.equal(skippedOmenState.zeroPityUntilTurn, 0, "Foretold Success expires if the chosen ally's next turn ends without a card play");
favorableResult.turnOrder = [oracleAlly.id, cursedEnemy.id, oracle.id];
favorableResult.activePlayerIndex = curseParty.findIndex((player) => player.id === oracleAlly.id);
favorableResult.adventure.target = 16;
const omenAttack = oracleAlly.skillDeck.find((card) => card.effect === "damage" && card.pityCost > 0);
favorableResult.playerStates[oracleAlly.id].hand = [omenAttack.id];
const omenPlayed = engine.resolveCardTurn(favorableResult, curseParty, omenAttack.id, cursedEnemy.id, 1);
assert.equal(omenPlayed.outcome.success, true, "the chosen ally's next played card succeeds automatically at 0 pity cost");
assert.equal(omenPlayed.outcome.pityCost, 0, "Foretold Success changes the next played card's effective pity cost to 0");
assert.equal(omenPlayed.playerStates[oracleAlly.id].pityPoints, 0, "a Foretold Success card neither spends nor gains pity");
assert.equal(omenPlayed.playerStates[oracleAlly.id].zeroPityUntilTurn, 0, "Foretold Success is consumed when the next card is played");

const failedFavorableGame = engine.createInitialGame(curseParty, engine.createAdventure("FAILED-FAVORABLE-OMEN"), 30);
failedFavorableGame.turnOrder = [oracle.id, cursedEnemy.id, oracleAlly.id];
failedFavorableGame.adventure.target = 20;
failedFavorableGame.playerStates[oracle.id].hp = 5;
failedFavorableGame.playerStates[oracle.id].hand = [favorableOmen.id];
const failedFavorable = engine.resolveCardTurn(failedFavorableGame, curseParty, favorableOmen.id, oracleAlly.id, 1);
assert.equal(failedFavorable.outcome.success, false, "a failed Foretold Success grants no zero-pity effect");
assert.equal(failedFavorable.playerStates[oracleAlly.id].zeroPityUntilTurn, 0, "Foretold Success cannot affect its target on failure");
assert.equal(failedFavorable.playerStates[oracle.id].hp, 3, "Foretold Success applies its rebalanced 2 self-damage failure");

const selfFavorableGame = engine.createInitialGame(curseParty, engine.createAdventure("FAVOR-SELF"), 30);
selfFavorableGame.turnOrder = [oracle.id, cursedEnemy.id, oracleAlly.id];
selfFavorableGame.playerStates[oracle.id].hand = [favorableOmen.id];
const selfFavored = engine.resolveCardTurn(selfFavorableGame, curseParty, favorableOmen.id, oracle.id, 20);
assert.equal(selfFavored.playerStates[oracle.id].completedPlayerTurns, 1);
assert.equal(selfFavored.playerStates[oracle.id].zeroPityUntilTurn, 2, "self-targeted Foretold Success survives its casting turn and applies on Sable's next turn");
selfFavored.turnOrder = [oracle.id, cursedEnemy.id, oracleAlly.id];
selfFavored.activePlayerIndex = 0;
selfFavored.adventure.target = 16;
const selfOmenCard = oracle.skillDeck.find((card) => card.id === "sf-hex");
selfFavored.playerStates[oracle.id].hand = [selfOmenCard.id];
const selfOmenPlayed = engine.resolveCardTurn(selfFavored, curseParty, selfOmenCard.id, cursedEnemy.id, 1);
assert.equal(selfOmenPlayed.outcome.success, true, "Sable can choose herself for Foretold Success");
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
  assert(!favorableUseGame.playerStates[oracle.id].graveyard.includes(favorableOmen.id), `Foretold Success remains reusable after use ${use}`);
}
assert([...favorableUseGame.playerStates[oracle.id].hand, ...favorableUseGame.playerStates[oracle.id].drawPile, ...favorableUseGame.playerStates[oracle.id].discardPile].includes(favorableOmen.id), "Foretold Success remains in a reusable card zone after repeated use and refill recycling");
const curseGame = engine.createInitialGame(curseParty, engine.createAdventure("CURSE"), 30);
curseGame.turnOrder = [oracle.id, cursedEnemy.id, oracleAlly.id];
const curseCard = oracle.skillDeck.find((card) => card.supportType === "enemy-dice");
assert.equal(curseCard.name, "Foretold Misfortune");
curseGame.playerStates[oracle.id].hand = [curseCard.id];
const cursed = engine.resolveCardTurn(curseGame, curseParty, curseCard.id, cursedEnemy.id, 20);
assert.equal(cursed.playerStates[cursedEnemy.id].dicePenalty, 3);
const cursedAttack = cursedEnemy.skillDeck.find((card) => card.effect === "damage");
cursed.adventure.target = 10;
cursed.playerStates[cursedEnemy.id].hand = [cursedAttack.id];
const penalizedRoll = engine.resolveCardTurn(cursed, curseParty, cursedAttack.id, oracle.id, 10);
assert.equal(penalizedRoll.outcome.total, 10 + engine.getPassiveDiceBonus(cursedEnemy, cursedAttack, cursed.playerStates[cursedEnemy.id]) - 3);
assert.equal(penalizedRoll.outcome.dicePenalty, 3, "the consumed debuff remains available to the result breakdown");
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
assert.deepEqual(sableRevived.outcome.lifeEvents.map((event) => event.kind), ["defeat", "revive"], "Foreseen Return queues the defeat panel before the revival panel");
assert.match(sableRevived.outcome.lifeEvents[1].reason, /Foreseen Return.*half HP/, "the revival panel explains Sable's passive");
sableRevived.playerStates[oracle.id].hp = 1;
sableRevived.turnOrder = [cursedEnemy.id, oracle.id, oracleAlly.id];
sableRevived.activePlayerIndex = 1;
sableRevived.playerStates[cursedEnemy.id].hand = [cursedAttack.id];
const sableDefeatedAgain = engine.resolveCardTurn(sableRevived, curseParty, cursedAttack.id, oracle.id, 20);
assert.equal(sableDefeatedAgain.playerStates[oracle.id].hp, 0, "Sable cannot trigger Foreseen Return twice");

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
assert.match(stealCard.description, /random card.*hand.*preferring special cards.*discard pile.*Nyx's next turn ends/i, "Borrowed Fate's description explains its complete updated effect");
const stolenSpecial = delayedEnemy.skillDeck.find((card) => card.unique);
const fallbackCommon = delayedEnemy.skillDeck.find((card) => !card.unique);
const tricksterCommon = trickster.skillDeck.find((card) => !card.unique && card.effect === "none");
const tricksterOwnedHand = trickster.skillDeck.filter((card) => card.id !== stealCard.id).slice(0, 3).map((card) => card.id);
const tricksterRefillCard = trickster.skillDeck.find((card) => card.id !== stealCard.id && !tricksterOwnedHand.includes(card.id));
const delayedEnemyCommons = delayedEnemy.skillDeck.filter((card) => !card.unique).slice(0, 5);
delayGame.playerStates[trickster.id].hand = [stealCard.id, ...tricksterOwnedHand];
delayGame.playerStates[trickster.id].drawPile = [tricksterRefillCard.id];
delayGame.playerStates[trickster.id].discardPile = [];
delayGame.playerStates[delayedEnemy.id].hand = [stolenSpecial.id, ...delayedEnemyCommons.slice(0, 3).map((card) => card.id)];
delayGame.playerStates[delayedEnemy.id].drawPile = delayedEnemyCommons.slice(3).map((card) => card.id);
delayGame.playerStates[delayedEnemy.id].discardPile = [];
const stolen = engine.resolveCardTurn(delayGame, delayParty, stealCard.id, delayedEnemy.id, 20);
assert(stolen.playerStates[trickster.id].hand.includes(stolenSpecial.id), "Borrowed Fate prefers a special card from the enemy hand");
assert(stolen.playerStates[delayedEnemy.id].hand.includes(fallbackCommon.id), "a common card remains when a special card is available");
assert(!stolen.playerStates[delayedEnemy.id].hand.includes(stolenSpecial.id), "the stolen special card leaves the enemy hand");
assert.equal(stolen.playerStates[trickster.id].hand.length, 4, "Borrowed Fate supplies the fourth card itself, so Nyx draws no extra card");
assert.deepEqual(stolen.playerStates[trickster.id].drawPile, [tricksterRefillCard.id], "Borrowed Fate does not consume the draw pile when Nyx already ends with 4 cards");
assert.equal(stolen.playerStates[trickster.id].borrowedCards[0].ownerId, delayedEnemy.id);
assert.equal(stolen.playerStates[trickster.id].borrowedCards[0].expiresAfterBorrowerTurn, 2, "the stolen card is tied to the end of Nyx's next turn");
stolen.turnOrder = [delayedEnemy.id, tricksterAlly.id, trickster.id];
stolen.activePlayerIndex = 1;
const targetAction = fallbackCommon;
const afterTargetTurn = engine.resolveCardTurn(stolen, delayParty, targetAction.id, trickster.id, 20);
assert(afterTargetTurn.playerStates[trickster.id].hand.includes(stolenSpecial.id), "the target's turn does not return the stolen card");
assert.equal(afterTargetTurn.playerStates[delayedEnemy.id].hand.length, 4, "Borrowed Fate's target draws two cards after playing from a three-card hand, restoring the general four-card minimum");
afterTargetTurn.turnOrder = [trickster.id, tricksterAlly.id, delayedEnemy.id];
afterTargetTurn.activePlayerIndex = 0;
const nyxNextCard = afterTargetTurn.playerStates[trickster.id].hand.find((id) => id !== stolenSpecial.id) ?? tricksterCommon.id;
const returned = engine.resolveCardTurn(afterTargetTurn, delayParty, nyxNextCard, delayedEnemy.id, 20);
assert(!returned.playerStates[trickster.id].hand.includes(stolenSpecial.id), "an unplayed stolen card returns when Nyx's next turn ends");
assert(returned.playerStates[delayedEnemy.id].discardPile.includes(stolenSpecial.id), "the stolen card returns to the target's discard pile");
assert.equal(returned.playerStates[trickster.id].borrowedCards.length, 0);
assert.equal(returned.playerStates[trickster.id].hand.length, 4, "Nyx refills only after the borrowed card leaves, ending with exactly 4 cards rather than 5");

const fallbackStealGame = engine.createInitialGame(delayParty, engine.createAdventure("STEAL-FALLBACK"), 30);
fallbackStealGame.turnOrder = [trickster.id, delayedEnemy.id, tricksterAlly.id];
fallbackStealGame.playerStates[trickster.id].hand = [stealCard.id];
fallbackStealGame.playerStates[delayedEnemy.id].hand = [fallbackCommon.id];
const fallbackStolen = engine.resolveCardTurn(fallbackStealGame, delayParty, stealCard.id, delayedEnemy.id, 20);
assert(fallbackStolen.playerStates[trickster.id].hand.includes(fallbackCommon.id), "Borrowed Fate falls back to a common card when no special card is in hand");

const revivalGame = engine.createInitialGame(supportParty, engine.createAdventure("REVIVE"), 30);
revivalGame.turnOrder = [healer.id, supportEnemy.id];
revivalGame.roundOrder = [supportAlly.id, supportEnemy.id, healer.id];
revivalGame.actedThisRound = [supportAlly.id, supportEnemy.id];
const reviveCard = healer.skillDeck.find((card) => card.supportType === "revive");
assert.match(reviveCard.description, /immediately.*one-third HP.*then.*graveyard/i, "Immediate Resurrection describes its immediate revival and one-use graveyard rule");
assert.doesNotMatch(reviveCard.description, /next turn|current phase/i, "Immediate Resurrection no longer promises the revived ally an immediate bonus turn");
revivalGame.playerStates[supportAlly.id].hp = 0;
revivalGame.playerStates[healer.id].hand = [reviveCard.id];
const revived = engine.resolveCardTurn(revivalGame, supportParty, reviveCard.id, supportAlly.id, 20);
assert.equal(revived.playerStates[supportAlly.id].reviveIn, 0, "Immediate Resurrection has no delayed countdown");
assert.equal(revived.playerStates[supportAlly.id].hp, Math.ceil(supportAlly.hero.maxHp / 3), "Immediate Resurrection immediately restores one-third max HP");
assert.equal(revived.turnOrder[0], supportEnemy.id, "Immediate Resurrection follows normal next-phase speed order instead of granting the revived ally the next turn");
assert.equal(revived.activePlayerIndex, supportParty.findIndex((player) => player.id === supportEnemy.id), "the normal fastest living player becomes active after the phase completes");
assert.equal(revived.completedPhases, revivalGame.completedPhases + 1, "reviving an ally who already acted does not reopen the completed phase");
assert.deepEqual(revived.roundOrder, [supportEnemy.id, healer.id, supportAlly.id], "the revived ally returns to normal speed order for the next phase");
assert(revived.playerStates[healer.id].graveyard.includes(reviveCard.id), "Immediate Resurrection enters the graveyard after its first use");
assert(![...revived.playerStates[healer.id].hand, ...revived.playerStates[healer.id].drawPile, ...revived.playerStates[healer.id].discardPile].includes(reviveCard.id), "graveyard cards cannot return to a reusable card zone");
const returningLightEvent = revived.outcome.lifeEvents.find((event) => event.playerId === supportAlly.id && event.kind === "revive");
assert(returningLightEvent, "Immediate Resurrection produces a synchronized revival event immediately");
assert.match(returningLightEvent.reason, /Immediate Resurrection.*one-third HP/i, "the revival panel explains the immediately restored HP");
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
assert(waitingRevived.actedThisRound.includes(healer.id), "Orren's Immediate Resurrection still completes Orren's own turn");
const enemyPhaseCard = supportEnemy.skillDeck.find((card) => card.effect === "none");
waitingRevived.playerStates[supportEnemy.id].hand = [enemyPhaseCard.id];
const phaseAfterRevival = engine.resolveCardTurn(waitingRevived, supportParty, enemyPhaseCard.id, supportEnemy.id, 20);
assert.equal(phaseAfterRevival.completedPhases, waitingRevivalGame.completedPhases + 1, "the phase completes without duplicate turns after Immediate Resurrection");
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
assert.equal(purgeCard.target, "enemy", "Mirefield Seizure only exposes living enemies as targets");
assert.equal(purgeCard.pityCost, 7, "Mirefield Seizure uses the balanced special-card control tier");
assert.equal(purgeCard.failureEffect, "enemy-shield", "Mirefield Seizure failure protects every enemy");
assert.equal(purgeCard.failureValue, 3, "Mirefield Seizure's more reliable selection carries a stronger failure penalty");
assert.match(purgeCard.description, /random card.*hand.*graveyard.*2 phases.*preferring special cards.*draw pile/i, "Mirefield Seizure's description explains its preference and complete temporary effect");
assert.doesNotMatch(purgeCard.description, /third use|Ione's graveyard/i, "Mirefield Seizure no longer describes a use limit");
assert.deepEqual(
  Object.fromEntries(Object.keys(mirefieldRules.MIREFIELD_SEIZURE_CARD).map((key) => [key, purgeCard[key]])),
  mirefieldRules.MIREFIELD_SEIZURE_CARD,
  "the catalog and realtime migration share one exact Mirefield Seizure contract"
);
const legacyMirefieldPlayers = structuredClone([commander]);
const legacyMirefield = legacyMirefieldPlayers[0].skillDeck.find((card) => card.id === "im-purge");
Object.assign(legacyMirefield, { description: "Temporarily purge a random card.", failureValue: 2, pityCost: 8 });
assert.equal(mirefieldRules.normalizeMirefieldSeizureCards(legacyMirefieldPlayers), true, "persisted rooms detect the legacy Mirefield Seizure snapshot");
assert.deepEqual(legacyMirefieldPlayers[0].skillDeck.find((card) => card.id === "im-purge"), { ...mirefieldRules.MIREFIELD_SEIZURE_CARD, unique: true }, "persisted rooms migrate Mirefield Seizure to its new balance and text");
assert.equal(mirefieldRules.normalizeMirefieldSeizureCards(legacyMirefieldPlayers), false, "the Mirefield Seizure persisted-room migration is idempotent");
const purgedEnemyCards = diceEnemy.skillDeck.filter((card) => card.unique);
const purgeReplacement = diceEnemy.skillDeck.find((card) => !card.unique && card.effect === "none");
const commanderBlank = commander.skillDeck.find((card) => !card.unique && card.effect === "none");
commanderPurge.playerStates[commander.id].hand = [purgeCard.id];
commanderPurge.playerStates[commander.id].drawPile = [commanderBlank.id];
commanderPurge.playerStates[commander.id].discardPile = [];
commanderPurge.playerStates[diceEnemy.id].hand = [purgedEnemyCards[0].id, purgeReplacement.id];
commanderPurge.playerStates[diceEnemy.id].drawPile = [];
commanderPurge.playerStates[diceEnemy.id].discardPile = [];
const purged = engine.resolveCardTurn(commanderPurge, [commander, diceEnemy], purgeCard.id, diceEnemy.id, 20);
assert(purged.playerStates[diceEnemy.id].graveyard.includes(purgedEnemyCards[0].id), "Mirefield Seizure moves a random enemy hand card to that enemy's graveyard");
assert(!purged.playerStates[diceEnemy.id].graveyard.includes(purgeReplacement.id), "Mirefield Seizure always prefers an available special card over a common card");
assert(purged.playerStates[diceEnemy.id].hand.includes(purgeReplacement.id), "the unselected common card remains in the enemy hand");
assert(!purged.playerStates[diceEnemy.id].hand.includes(purgedEnemyCards[0].id), "the purged card immediately leaves the enemy hand");
assert.deepEqual(purged.playerStates[diceEnemy.id].purgedCards, [{ cardId: purgedEnemyCards[0].id, returnAfterPhase: 2 }], "the purged card records a two-phase return boundary");
assert(!purged.playerStates[commander.id].graveyard.includes(purgeCard.id), "Mirefield Seizure remains reusable after its first use");

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
assert(!secondPurge.playerStates[commander.id].graveyard.includes(purgeCard.id), "Mirefield Seizure remains reusable after its second use");
secondPurge.turnOrder = [commander.id, diceEnemy.id];
secondPurge.activePlayerIndex = 0;
secondPurge.playerStates[commander.id].hand = [purgeCard.id];
secondPurge.playerStates[diceEnemy.id].hand = [purgedEnemyCards[2].id];
const thirdPurge = engine.resolveCardTurn(secondPurge, [commander, diceEnemy], purgeCard.id, diceEnemy.id, 20);
assert(!thirdPurge.playerStates[commander.id].graveyard.includes(purgeCard.id), "Mirefield Seizure remains reusable after its third use");
assert([...thirdPurge.playerStates[commander.id].hand, ...thirdPurge.playerStates[commander.id].drawPile, ...thirdPurge.playerStates[commander.id].discardPile].includes(purgeCard.id), "Mirefield Seizure stays in Ione's reusable card zones after its third use");
assert.equal(thirdPurge.playerStates[commander.id].cardUses[purgeCard.id], 3, "Mirefield Seizure still records its third use without retiring");
thirdPurge.turnOrder = [commander.id, diceEnemy.id];
thirdPurge.activePlayerIndex = 0;
thirdPurge.playerStates[commander.id].hand = [purgeCard.id];
thirdPurge.playerStates[commander.id].drawPile = thirdPurge.playerStates[commander.id].drawPile.filter((id) => id !== purgeCard.id);
thirdPurge.playerStates[commander.id].discardPile = thirdPurge.playerStates[commander.id].discardPile.filter((id) => id !== purgeCard.id);
thirdPurge.playerStates[diceEnemy.id].hand = [purgeReplacement.id];
const fourthPurge = engine.resolveCardTurn(thirdPurge, [commander, diceEnemy], purgeCard.id, diceEnemy.id, 20);
assert.equal(fourthPurge.playerStates[commander.id].cardUses[purgeCard.id], 4, "Mirefield Seizure resolves normally on its fourth use");
assert(!fourthPurge.playerStates[commander.id].graveyard.includes(purgeCard.id), "Mirefield Seizure never retires from repeated use");
assert(fourthPurge.playerStates[diceEnemy.id].graveyard.includes(purgeReplacement.id), "a fourth Mirefield Seizure still moves an enemy hand card to graveyard");
assert(fourthPurge.playerStates[diceEnemy.id].purgedCards.some((entry) => entry.cardId === purgeReplacement.id), "a fourth Mirefield Seizure still records the two-phase return timer");
assert.match(fourthPurge.outcome.detail, /preferring special cards/i, "Mirefield Seizure explains its preference even when it falls back to a common card");

const lioraOption = options.find((option) => option.hero.name === lioraRules.LIORA_VENN_NAME);
assert(lioraOption, "Liora Venn must be available in the character catalog");
assert.deepEqual(
  { role: lioraOption.hero.role, classId: lioraOption.hero.classId, hp: lioraOption.hero.hp, maxHp: lioraOption.hero.maxHp, speed: lioraOption.hero.speed },
  { role: "Healer", classId: "bloodweaver", hp: 12, maxHp: 12, speed: 3 },
  "Liora must retain her approved healer identity and base stats"
);
const lioraVerdictTemplate = lioraOption.skillDeck.find((card) => card.id === "lv-verdict");
const lioraRemedyTemplate = lioraOption.skillDeck.find((card) => card.id === "lv-remedy");
const lioraCommunionTemplate = lioraOption.skillDeck.find((card) => card.id === "lv-communion");
assert.deepEqual(
  [lioraVerdictTemplate, lioraRemedyTemplate, lioraCommunionTemplate].map((card) => ({ id: card.id, effect: card.effect, target: card.target, value: card.value, pityCost: card.pityCost })),
  [
    { id: "lv-verdict", effect: "damage", target: "enemy", value: 4, pityCost: 6 },
    { id: "lv-remedy", effect: "heal", target: "all-allies", value: 4, pityCost: 7 },
    { id: "lv-communion", effect: "aoe", target: "all-enemies", value: 3, pityCost: 7 }
  ],
  "Liora's three special cards must retain their approved targets, values, and pity costs"
);
assert.equal(lioraVerdictTemplate.description, "Requires at least 4 HP. On success, lose 3 HP, then deal 4 damage to one living enemy.");
assert.equal(lioraRemedyTemplate.description, "All living allies, including yourself, restore 4 HP (5 with Sanguine Recompense); cannot revive.");
assert.equal(lioraCommunionTemplate.description, "Requires at least 4 HP. On success, lose 3 HP, then deal 3 damage to every living enemy.");
assert.equal(lioraOption.hero.passiveText, "After Liora pays HP to attack the enemy, her next successful Heal card restores 1 additional HP to every living ally; does not stack.");

const liora = engine.createPlayerSession("Liora", 0, "Liora Venn", "liora-rules");
const lioraEnemy = engine.createPlayerSession("Liora enemy", 1, "Elara Voss", "liora-enemy");
const lioraAlly = engine.createPlayerSession("Liora ally", 2, "Brother Orren", "liora-ally");
const lioraDeadAlly = engine.createPlayerSession("Liora fallen ally", 4, "Mira Ash", "liora-dead-ally");
const lioraVerdict = liora.skillDeck.find((card) => card.id === "lv-verdict");
const lioraRemedy = liora.skillDeck.find((card) => card.id === "lv-remedy");
const lioraCommunion = liora.skillDeck.find((card) => card.id === "lv-communion");
const lioraSecondWind = liora.skillDeck.find((card) => card.id.endsWith("-common-second-wind"));
const lioraSlash = liora.skillDeck.find((card) => card.id.endsWith("-common-slash"));
const prepareLioraGame = (seed, party = [liora, lioraEnemy, lioraAlly]) => {
  const prepared = engine.createInitialGame(party, engine.createAdventure(seed), 30);
  prepared.turnOrder = party.map((player) => player.id);
  prepared.adventure.target = 8;
  return prepared;
};

const exactCostGame = prepareLioraGame("LIORA-EXACT-COST", [liora, lioraEnemy]);
Object.assign(exactCostGame.playerStates[liora.id], { hp: 4, shield: 6, attackBuff: 2, hand: [lioraVerdict.id] });
exactCostGame.playerStates[liora.id].timedEffects = [
  { kind: "shield", value: 6, expiresAfterTurn: 99 },
  { kind: "attackBuff", value: 2, expiresAfterTurn: 99 }
];
Object.assign(exactCostGame.playerStates[lioraEnemy.id], { shield: 3 });
exactCostGame.playerStates[lioraEnemy.id].timedEffects = [{ kind: "shield", value: 3, expiresAfterTurn: 99 }];
const exactCostResult = engine.resolveCardTurn(exactCostGame, [liora, lioraEnemy], lioraVerdict.id, lioraEnemy.id, 20);
assert.equal(exactCostResult.playerStates[liora.id].hp, 1, "Crimson Verdict must allow exactly 4 HP and leave Liora at 1 HP");
assert.equal(exactCostResult.playerStates[liora.id].shield, 6, "the 3 HP payment must ignore and preserve Liora's shield");
assert.equal(exactCostResult.playerStates[liora.id].attackBuff, 0, "a successful Crimson Verdict consumes the existing attack buff normally");
assert.equal(exactCostResult.playerStates[liora.id].sanguineRecompense, true, "a successful Crimson Verdict primes Sanguine Recompense");
assert.equal(exactCostResult.playerStates[lioraEnemy.id].hp, lioraEnemy.hero.maxHp - 3, "Crimson Verdict damage plus attack buff must still respect enemy shield");
assert.equal(exactCostResult.playerStates[lioraEnemy.id].shield, 0, "enemy shield must absorb Crimson Verdict before HP damage");
assert.equal(exactCostResult.outcome.amount, 3, "Crimson Verdict reports only enemy HP damage, not Liora's health payment");
assert.match(exactCostResult.outcome.detail, /paid 3 HP/, "the synchronized outcome explains Liora's health payment");

const lowHpGame = prepareLioraGame("LIORA-LOW-HP", [liora, lioraEnemy]);
Object.assign(lowHpGame.playerStates[liora.id], { hp: 3, pityPoints: lioraVerdict.pityCost, hand: [lioraVerdict.id] });
assert.equal(engine.resolveCardTurn(lowHpGame, [liora, lioraEnemy], lioraVerdict.id, lioraEnemy.id, 20), lowHpGame, "Crimson Verdict cannot roll below its 4 HP requirement");
assert.equal(engine.resolveCardTurn(lowHpGame, [liora, lioraEnemy], lioraVerdict.id, lioraEnemy.id, 0, true), lowHpGame, "Pity cannot bypass Crimson Verdict's 4 HP requirement");

const failedVerdictGame = prepareLioraGame("LIORA-FAILED-VERDICT", [liora, lioraEnemy]);
failedVerdictGame.adventure.target = 20;
Object.assign(failedVerdictGame.playerStates[liora.id], { hp: 4, shield: 5, hand: [lioraVerdict.id] });
failedVerdictGame.playerStates[liora.id].timedEffects = [{ kind: "shield", value: 5, expiresAfterTurn: 99 }];
const failedVerdict = engine.resolveCardTurn(failedVerdictGame, [liora, lioraEnemy], lioraVerdict.id, lioraEnemy.id, 1);
assert.equal(failedVerdict.playerStates[liora.id].hp, 2, "failed Crimson Verdict applies only its 2 backlash damage, not its 3 HP success cost");
assert.equal(failedVerdict.playerStates[liora.id].shield, 5, "Crimson Verdict failure backlash bypasses shield without consuming it");
assert.equal(failedVerdict.playerStates[liora.id].sanguineRecompense, false, "failed Crimson Verdict cannot prime Sanguine Recompense");
assert.equal(failedVerdict.playerStates[lioraEnemy.id].hp, lioraEnemy.hero.maxHp, "failed Crimson Verdict cannot damage its target");

const pityVerdictGame = prepareLioraGame("LIORA-PITY", [liora, lioraEnemy]);
Object.assign(pityVerdictGame.playerStates[liora.id], { hp: 4, pityPoints: lioraVerdict.pityCost, hand: [lioraVerdict.id] });
const pityVerdict = engine.resolveCardTurn(pityVerdictGame, [liora, lioraEnemy], lioraVerdict.id, lioraEnemy.id, 0, true);
assert.equal(pityVerdict.playerStates[liora.id].hp, 1, "a Pity success still pays Crimson Verdict's full 3 HP cost");
assert.equal(pityVerdict.playerStates[liora.id].pityPoints, 0, "Crimson Verdict spends its exact Pity cost");
assert.equal(pityVerdict.playerStates[liora.id].sanguineRecompense, true, "a Pity success primes Sanguine Recompense");

const communionParty = [liora, lioraEnemy, engine.createPlayerSession("Second enemy", 3, "Thorne Vale", "liora-enemy-two"), lioraAlly];
const communionGame = prepareLioraGame("LIORA-COMMUNION", communionParty);
Object.assign(communionGame.playerStates[liora.id], { hp: 4, sanguineRecompense: true, hand: [lioraCommunion.id] });
communionGame.playerStates[communionParty[1].id].shield = 1;
communionGame.playerStates[communionParty[2].id].shield = 2;
const communionResult = engine.resolveCardTurn(communionGame, communionParty, lioraCommunion.id, liora.id, 20);
assert.equal(communionResult.playerStates[liora.id].hp, 1, "Red Communion pays its 3 HP cost once regardless of enemy count");
assert.equal(communionResult.playerStates[liora.id].sanguineRecompense, true, "using a second blood attack cannot stack beyond one ready Sanguine Recompense charge");
assert.equal(communionResult.playerStates[communionParty[1].id].hp, communionParty[1].hero.maxHp - 2, "Red Communion applies its 3 damage through the first enemy's shield");
assert.equal(communionResult.playerStates[communionParty[2].id].hp, communionParty[2].hero.maxHp - 1, "Red Communion independently applies shield to every living enemy");

const failedCommunionGame = prepareLioraGame("LIORA-FAILED-COMMUNION", [liora, lioraEnemy, lioraAlly]);
failedCommunionGame.adventure.target = 20;
Object.assign(failedCommunionGame.playerStates[liora.id], { hp: 4, sanguineRecompense: true, hand: [lioraCommunion.id] });
const failedCommunion = engine.resolveCardTurn(failedCommunionGame, [liora, lioraEnemy, lioraAlly], lioraCommunion.id, liora.id, 1);
assert.equal(failedCommunion.playerStates[liora.id].hp, 3, "failed Red Communion applies only its 1 team backlash");
assert.equal(failedCommunion.playerStates[lioraAlly.id].hp, lioraAlly.hero.maxHp - 1, "failed Red Communion damages every living ally");
assert.equal(failedCommunion.playerStates[liora.id].sanguineRecompense, true, "failed Red Communion neither creates nor consumes the existing passive charge");

const remedyParty = [liora, lioraEnemy, lioraAlly, lioraDeadAlly];
const remedyGame = prepareLioraGame("LIORA-REMEDY", remedyParty);
Object.assign(remedyGame.playerStates[liora.id], { hp: 1, sanguineRecompense: true, hand: [lioraRemedy.id] });
remedyGame.playerStates[lioraAlly.id].hp = 1;
remedyGame.playerStates[lioraDeadAlly.id].hp = 0;
const remedyResult = engine.resolveCardTurn(remedyGame, remedyParty, lioraRemedy.id, liora.id, 20);
assert.equal(remedyResult.playerStates[liora.id].hp, 6, "Sanguine Recompense increases Bloodbound Remedy to 5 HP for Liora");
assert.equal(remedyResult.playerStates[lioraAlly.id].hp, 6, "Sanguine Recompense increases Bloodbound Remedy to 5 HP for every living ally");
assert.equal(remedyResult.playerStates[lioraDeadAlly.id].hp, 0, "Bloodbound Remedy cannot revive a defeated ally");
assert.deepEqual(remedyResult.outcome.targetIds.sort(), [liora.id, lioraAlly.id].sort(), "Bloodbound Remedy targets every living ally and excludes defeated allies");
assert.equal(remedyResult.outcome.amount, 10, "Bloodbound Remedy reports the total HP actually restored");
assert.equal(remedyResult.playerStates[liora.id].sanguineRecompense, false, "a successful Bloodbound Remedy consumes Sanguine Recompense once after all targets resolve");

const cappedRemedyGame = prepareLioraGame("LIORA-CAPPED-REMEDY", [liora, lioraEnemy, lioraAlly]);
Object.assign(cappedRemedyGame.playerStates[liora.id], { hp: 11, sanguineRecompense: true, hand: [lioraRemedy.id] });
cappedRemedyGame.playerStates[lioraAlly.id].hp = lioraAlly.hero.maxHp;
const cappedRemedy = engine.resolveCardTurn(cappedRemedyGame, [liora, lioraEnemy, lioraAlly], lioraRemedy.id, liora.id, 20);
assert.equal(cappedRemedy.playerStates[liora.id].hp, 12, "Bloodbound Remedy caps Liora at maximum HP");
assert.equal(cappedRemedy.playerStates[lioraAlly.id].hp, lioraAlly.hero.maxHp, "Bloodbound Remedy cannot exceed an ally's maximum HP");
assert.equal(cappedRemedy.outcome.amount, 1, "capped Bloodbound Remedy reports only HP actually restored");
assert.equal(cappedRemedy.playerStates[liora.id].sanguineRecompense, false, "a successful Heal card consumes the passive even when healing is capped");

const secondWindParty = [liora, lioraEnemy, lioraAlly, lioraDeadAlly];
const secondWindGame = prepareLioraGame("LIORA-SECOND-WIND", secondWindParty);
Object.assign(secondWindGame.playerStates[liora.id], { hp: 5, sanguineRecompense: true, hand: [lioraSecondWind.id] });
secondWindGame.playerStates[lioraAlly.id].hp = 5;
secondWindGame.playerStates[lioraDeadAlly.id].hp = 0;
const lioraSecondWindResult = engine.resolveCardTurn(secondWindGame, secondWindParty, lioraSecondWind.id, liora.id, 20);
assert.equal(lioraSecondWindResult.playerStates[liora.id].hp, 9, "Sanguine Recompense increases the common Second Wind heal from 3 to 4 HP");
assert.equal(lioraSecondWindResult.playerStates[lioraAlly.id].hp, 6, "Sanguine Recompense restores 1 HP to every other living ally when Second Wind succeeds");
assert.equal(lioraSecondWindResult.playerStates[lioraEnemy.id].hp, lioraEnemy.hero.maxHp, "Sanguine Recompense never heals enemies");
assert.equal(lioraSecondWindResult.playerStates[lioraDeadAlly.id].hp, 0, "Sanguine Recompense cannot revive a defeated ally through Second Wind");
assert.deepEqual(lioraSecondWindResult.outcome.targetIds, [liora.id], "Second Wind remains self-targeted even though Sanguine Recompense pulses across living allies");
assert.equal(lioraSecondWindResult.outcome.amount, 5, "Second Wind reports Liora's 4 restored HP plus 1 HP restored to her living ally");
assert.equal(lioraSecondWindResult.playerStates[liora.id].sanguineRecompense, false, "a successful common Heal card consumes Sanguine Recompense");

const failedRemedyGame = prepareLioraGame("LIORA-FAILED-REMEDY", [liora, lioraEnemy, lioraAlly]);
failedRemedyGame.adventure.target = 20;
Object.assign(failedRemedyGame.playerStates[liora.id], { hp: 7, sanguineRecompense: true, hand: [lioraRemedy.id] });
failedRemedyGame.playerStates[lioraAlly.id].hp = 1;
const failedRemedy = engine.resolveCardTurn(failedRemedyGame, [liora, lioraEnemy, lioraAlly], lioraRemedy.id, liora.id, 1);
assert.equal(failedRemedy.playerStates[liora.id].hp, 5, "failed Bloodbound Remedy applies its 2 self backlash");
assert.equal(failedRemedy.playerStates[lioraAlly.id].hp, 1, "failed Bloodbound Remedy never heals an ally");
assert.equal(failedRemedy.playerStates[liora.id].sanguineRecompense, true, "a failed Heal card preserves Sanguine Recompense");

const retainedChargeGame = prepareLioraGame("LIORA-RETAINED-CHARGE", [liora, lioraEnemy]);
Object.assign(retainedChargeGame.playerStates[liora.id], { sanguineRecompense: true, hand: [lioraSlash.id] });
const retainedCharge = engine.resolveCardTurn(retainedChargeGame, [liora, lioraEnemy], lioraSlash.id, lioraEnemy.id, 20);
assert.equal(retainedCharge.playerStates[liora.id].sanguineRecompense, true, "non-Heal cards do not consume Sanguine Recompense");

const borrowedLiora = engine.createPlayerSession("Borrowed Liora", 2, "Liora Venn", "borrowed-liora-owner");
const borrowedActor = engine.createPlayerSession("Borrowing Nyx", 0, "Nyx Calder", "borrowed-liora-actor");
const borrowedTarget = engine.createPlayerSession("Borrowed target", 1, "Elara Voss", "borrowed-liora-target");
const borrowedVerdict = borrowedLiora.skillDeck.find((card) => card.id === "lv-verdict");
const borrowedParty = [borrowedActor, borrowedTarget, borrowedLiora];
const borrowedGame = engine.createInitialGame(borrowedParty, engine.createAdventure("LIORA-BORROWED"), 30);
borrowedGame.turnOrder = borrowedParty.map((player) => player.id);
borrowedGame.adventure.target = 8;
Object.assign(borrowedGame.playerStates[borrowedActor.id], {
  hp: 4,
  hand: [borrowedVerdict.id],
  borrowedCards: [{ cardId: borrowedVerdict.id, ownerId: borrowedLiora.id, borrowedAtTurn: 0, expiresAfterBorrowerTurn: 2 }]
});
for (const zone of ["hand", "drawPile", "discardPile"]) borrowedGame.playerStates[borrowedLiora.id][zone] = borrowedGame.playerStates[borrowedLiora.id][zone].filter((id) => id !== borrowedVerdict.id);
borrowedGame.playerStates[borrowedTarget.id].shield = 5;
const borrowedResult = engine.resolveCardTurn(borrowedGame, borrowedParty, borrowedVerdict.id, borrowedTarget.id, 20);
assert.equal(borrowedResult.playerStates[borrowedActor.id].hp, 1, "a non-Liora user must still pay a stolen blood card's 3 HP cost");
assert.equal(borrowedResult.playerStates[borrowedActor.id].sanguineRecompense, false, "a stolen Liora attack cannot grant another character Liora's passive");
assert.equal(borrowedResult.playerStates[borrowedTarget.id].hp, borrowedTarget.hero.maxHp - 4, "Nyx's shield-piercing passive still applies to a stolen Crimson Verdict");
assert.equal(borrowedResult.playerStates[borrowedLiora.id].discardPile.includes(borrowedVerdict.id), true, "a stolen Crimson Verdict returns to its owner's discard pile after use");

const forgedLiora = structuredClone(liora);
const forgedVerdict = forgedLiora.skillDeck.find((card) => card.id === "lv-verdict");
Object.assign(forgedVerdict, { value: 99, pityCost: 0, description: "Forged" });
assert.equal(lioraRules.normalizeLioraVennCards([forgedLiora]), true, "realtime normalization repairs forged Liora card definitions");
const normalizedVerdict = forgedLiora.skillDeck.find((card) => card.id === "lv-verdict");
assert.deepEqual(
  { value: normalizedVerdict.value, pityCost: normalizedVerdict.pityCost, description: normalizedVerdict.description },
  { value: 4, pityCost: 6, description: lioraVerdict.description },
  "realtime normalization restores Crimson Verdict's authoritative contract"
);
assert.equal(lioraRules.normalizeLioraVennCards([forgedLiora]), false, "canonical Liora cards do not produce repeated normalization changes");

const reconciledCost = structuredClone(exactCostResult);
Object.assign(reconciledCost.playerStates[liora.id], { hp: 12, sanguineRecompense: false });
assert.equal(lioraRules.reconcileLioraVennImpact(exactCostGame, reconciledCost, liora, [liora, lioraEnemy]), "", "realtime reconciliation accepts a legal Crimson Verdict");
assert.equal(reconciledCost.playerStates[liora.id].hp, 1, "realtime reconciliation restores Crimson Verdict's authoritative 3 HP cost");
assert.equal(reconciledCost.playerStates[liora.id].sanguineRecompense, true, "realtime reconciliation restores the authoritative passive charge");

const forgedLowHpUpdate = structuredClone(lowHpGame);
forgedLowHpUpdate.outcome = { kind: "card", success: true, cardId: lioraVerdict.id, cardName: lioraVerdict.name, targetIds: [lioraEnemy.id] };
assert.match(lioraRules.reconcileLioraVennImpact(lowHpGame, forgedLowHpUpdate, liora, [liora, lioraEnemy]), /requires at least 4 HP/, "both realtime authorities reject forged low-HP blood-card updates");

const reconciledRemedy = structuredClone(remedyResult);
Object.assign(reconciledRemedy.playerStates[liora.id], { hp: 12, sanguineRecompense: true });
reconciledRemedy.playerStates[lioraAlly.id].hp = lioraAlly.hero.maxHp;
reconciledRemedy.outcome.amount = 999;
assert.equal(lioraRules.reconcileLioraVennImpact(remedyGame, reconciledRemedy, liora, remedyParty), "", "realtime reconciliation accepts legal Sanguine Recompense healing");
assert.equal(reconciledRemedy.playerStates[liora.id].hp, 6, "realtime reconciliation restores Liora's exact enhanced healing");
assert.equal(reconciledRemedy.playerStates[lioraAlly.id].hp, 6, "realtime reconciliation restores every living ally's exact enhanced healing");
assert.equal(reconciledRemedy.playerStates[liora.id].sanguineRecompense, false, "realtime reconciliation consumes the passive exactly once");
assert.equal(reconciledRemedy.outcome.amount, 10, "realtime reconciliation repairs the reported healing total");

const reconciledSecondWind = structuredClone(lioraSecondWindResult);
reconciledSecondWind.playerStates[liora.id].hp = 12;
reconciledSecondWind.playerStates[lioraAlly.id].hp = lioraAlly.hero.maxHp;
reconciledSecondWind.outcome.amount = 999;
assert.equal(lioraRules.reconcileLioraVennImpact(secondWindGame, reconciledSecondWind, liora, secondWindParty), "", "realtime reconciliation accepts a legal team-wide Second Wind pulse");
assert.equal(reconciledSecondWind.playerStates[liora.id].hp, 9, "realtime reconciliation restores Second Wind's 3 plus 1 healing on Liora");
assert.equal(reconciledSecondWind.playerStates[lioraAlly.id].hp, 6, "realtime reconciliation restores Second Wind's 1 HP pulse on every other living ally");
assert.equal(reconciledSecondWind.playerStates[lioraDeadAlly.id].hp, 0, "realtime reconciliation leaves defeated allies defeated");
assert.equal(reconciledSecondWind.playerStates[liora.id].sanguineRecompense, false, "realtime reconciliation consumes the team-wide healing charge once");
assert.equal(reconciledSecondWind.outcome.amount, 5, "realtime reconciliation repairs Second Wind's combined healing total");

const addExternalPassiveTestCard = (player, slug, abilities) => {
  const card = {
    id: `${player.id}::passive-test::${slug}`,
    name: `External passive test ${slug}`,
    description: "External passive gameplay test.",
    bonus: 0,
    value: 1,
    unique: true,
    external: true,
    pityCost: 2,
    failureEffect: "self-damage",
    failureValue: 1,
    ...abilities
  };
  player.skillDeck.push(card);
  return card;
};
const prepareExternalPassiveGame = (seed, party, actor, card) => {
  const game = engine.createInitialGame(party, engine.createAdventure(seed), 30);
  game.turnOrder = [actor.id, ...party.filter((player) => player.id !== actor.id).map((player) => player.id)];
  game.adventure.target = 8;
  game.playerStates[actor.id].hand = [card.id];
  game.playerStates[actor.id].drawPile = game.playerStates[actor.id].drawPile.filter((id) => id !== card.id);
  return game;
};

const elaraExternalGuard = addExternalPassiveTestCard(elara, "elara-guard", { effect: "guard", target: "self", value: 2 });
const elaraExternalGame = prepareExternalPassiveGame("EXTERNAL-ELARA", [elara, elaraEnemy], elara, elaraExternalGuard);
const elaraExternalResult = engine.resolveCardTurn(elaraExternalGame, [elara, elaraEnemy], elaraExternalGuard.id, elara.id, 20);
assert.equal(elaraExternalResult.outcome.amount, 3, "Lantern-Forged Guard grants +1 shield to Elara's External Guard cards");

const thorneExternalAttack = addExternalPassiveTestCard(thorne, "thorne-attack", { effect: "damage", target: "enemy", value: 2 });
const thorneExternalGame = prepareExternalPassiveGame("EXTERNAL-THORNE", thorneParty, thorne, thorneExternalAttack);
thorneExternalGame.playerStates[thorne.id].thorneDeadeyeCharge = true;
const thorneExternalResult = engine.resolveCardTurn(thorneExternalGame, thorneParty, thorneExternalAttack.id, thorneTarget.id, 20);
assert.equal(thorneExternalResult.outcome.amount, 3, "Second-Beat Deadeye grants +1 damage to Thorne's External single-target Attack cards on its active turn");
assert.equal(thorneExternalResult.playerStates[thorne.id].thorneDeadeyeCharge, false, "an External Attack consumes Thorne's passive charge");
const thorneCommonAttack = thorne.skillDeck.find((card) => !card.unique && card.effect === "damage");
const thorneCommonGame = engine.createInitialGame(thorneParty, engine.createAdventure("COMMON-THORNE"), 30);
thorneCommonGame.turnOrder = [thorne.id, thorneTarget.id];
thorneCommonGame.adventure.target = 8;
thorneCommonGame.playerStates[thorne.id].thorneDeadeyeCharge = true;
thorneCommonGame.playerStates[thorne.id].hand = [thorneCommonAttack.id];
const thorneCommonResult = engine.resolveCardTurn(thorneCommonGame, thorneParty, thorneCommonAttack.id, thorneTarget.id, 20);
assert.equal(thorneCommonResult.outcome.amount, thorneCommonAttack.value + 1, "Second-Beat Deadeye also grants +1 damage to Thorne's common single-target Attack cards");
assert.equal(thorneCommonResult.playerStates[thorne.id].thorneDeadeyeCharge, false, "a common Attack consumes Thorne's passive charge");

const miraExternalAoe = addExternalPassiveTestCard(mira, "mira-aoe", { effect: "aoe", target: "all-enemies", value: 1 });
const miraExternalParty = [mira, infernoTargetOne, infernoTargetTwo];
const miraExternalGame = prepareExternalPassiveGame("EXTERNAL-MIRA", miraExternalParty, mira, miraExternalAoe);
const miraExternalResult = engine.resolveCardTurn(miraExternalGame, miraExternalParty, miraExternalAoe.id, infernoTargetOne.id, 20);
assert.equal(miraExternalResult.outcome.amount, 4, "Wildfire Reach grants +1 damage per enemy to Mira's External AOE Attack cards");

const orrenExternalHeal = addExternalPassiveTestCard(healer, "orren-heal", { effect: "heal", target: "self", value: 2 });
const orrenExternalParty = [healer, supportEnemy];
const orrenExternalGame = prepareExternalPassiveGame("EXTERNAL-ORREN", orrenExternalParty, healer, orrenExternalHeal);
orrenExternalGame.playerStates[healer.id].hp = 1;
const orrenExternalResult = engine.resolveCardTurn(orrenExternalGame, orrenExternalParty, orrenExternalHeal.id, healer.id, 20);
assert.equal(orrenExternalResult.outcome.amount, 3, "Graceful Restoration grants +1 HP to Orren's External Heal cards");

const lioraExternalHeal = addExternalPassiveTestCard(liora, "liora-heal", { effect: "heal", target: "self", value: 2 });
const lioraExternalParty = [liora, lioraEnemy, lioraAlly];
const lioraExternalGame = prepareExternalPassiveGame("EXTERNAL-LIORA", lioraExternalParty, liora, lioraExternalHeal);
Object.assign(lioraExternalGame.playerStates[liora.id], { hp: 5, sanguineRecompense: true });
lioraExternalGame.playerStates[lioraAlly.id].hp = 5;
const lioraExternalResult = engine.resolveCardTurn(lioraExternalGame, lioraExternalParty, lioraExternalHeal.id, liora.id, 20);
assert.equal(lioraExternalResult.playerStates[liora.id].hp, 8, "Sanguine Recompense grants +1 HP to Liora's External Heal card");
assert.equal(lioraExternalResult.playerStates[lioraAlly.id].hp, 6, "Sanguine Recompense pulses 1 HP to each other living ally from an External Heal card");
assert.equal(lioraExternalResult.playerStates[liora.id].sanguineRecompense, false, "an External Heal card consumes Sanguine Recompense once");
const reconciledLioraExternal = structuredClone(lioraExternalResult);
reconciledLioraExternal.playerStates[liora.id].hp = liora.hero.maxHp;
reconciledLioraExternal.playerStates[lioraAlly.id].hp = lioraAlly.hero.maxHp;
reconciledLioraExternal.outcome.amount = 999;
assert.equal(lioraRules.reconcileLioraVennImpact(lioraExternalGame, reconciledLioraExternal, liora, lioraExternalParty), "", "the realtime authority accepts Sanguine Recompense from an External Heal card");
assert.equal(reconciledLioraExternal.playerStates[liora.id].hp, 8, "the realtime authority restores Liora's passive-enhanced External healing");
assert.equal(reconciledLioraExternal.playerStates[lioraAlly.id].hp, 6, "the realtime authority restores the External Heal card's passive ally pulse");

const nyxExternalAttack = addExternalPassiveTestCard(nyx, "nyx-attack", { effect: "damage", target: "enemy", value: 2 });
const nyxExternalGame = prepareExternalPassiveGame("EXTERNAL-NYX", nyxParty, nyx, nyxExternalAttack);
nyxExternalGame.playerStates[nyxTarget.id].shield = 3;
const nyxExternalResult = engine.resolveCardTurn(nyxExternalGame, nyxParty, nyxExternalAttack.id, nyxTarget.id, 20);
assert.equal(nyxExternalResult.outcome.amount, 2, "Veilpiercer lets Nyx's External Attack cards deal full damage through shield");
assert.equal(nyxExternalResult.playerStates[nyxTarget.id].shield, 3, "Nyx's External Attack card ignores rather than consumes shield");
const nyxCommonAttack = nyx.skillDeck.find((card) => !card.unique && card.effect === "damage");
const nyxCommonGame = engine.createInitialGame(nyxParty, engine.createAdventure("COMMON-NYX"), 30);
nyxCommonGame.turnOrder = [nyx.id, nyxTarget.id];
nyxCommonGame.adventure.target = 8;
nyxCommonGame.playerStates[nyx.id].hand = [nyxCommonAttack.id];
nyxCommonGame.playerStates[nyxTarget.id].shield = 3;
const nyxCommonResult = engine.resolveCardTurn(nyxCommonGame, nyxParty, nyxCommonAttack.id, nyxTarget.id, 20);
assert.equal(nyxCommonResult.outcome.amount, nyxCommonAttack.value, "Veilpiercer also lets Nyx's common Attack cards deal full damage through shield");

const bramExternalGuard = addExternalPassiveTestCard(tank, "bram-guard", { effect: "guard", target: "self", value: 2 });
const bramExternalGame = prepareExternalPassiveGame("EXTERNAL-BRAM", [tank, tankEnemy], tank, bramExternalGuard);
const bramExternalResult = engine.resolveCardTurn(bramExternalGame, [tank, tankEnemy], bramExternalGuard.id, tank.id, 20);
engine.expireTimedEffectsAtTurnEnd(bramExternalResult.playerStates[tank.id]);
assert.equal(bramExternalResult.playerStates[tank.id].shield, 2, "Two-Turn Temper keeps shield from Bram's External Guard card through his next turn");
engine.expireTimedEffectsAtTurnEnd(bramExternalResult.playerStates[tank.id]);
assert.equal(bramExternalResult.playerStates[tank.id].shield, 0, "shield from Bram's External Guard card expires after his second turn");

const sableExternalThreat = addExternalPassiveTestCard(cursedEnemy, "sable-threat", { effect: "damage", target: "enemy", value: 1 });
const sableExternalParty = [oracle, cursedEnemy];
const sableExternalGame = prepareExternalPassiveGame("EXTERNAL-SABLE", sableExternalParty, cursedEnemy, sableExternalThreat);
sableExternalGame.playerStates[oracle.id].hp = 1;
const sableExternalResult = engine.resolveCardTurn(sableExternalGame, sableExternalParty, sableExternalThreat.id, oracle.id, 20);
assert.equal(sableExternalResult.playerStates[oracle.id].hp, Math.ceil(oracle.hero.maxHp / 2), "Foreseen Return revives Sable when an External card defeats her");
assert.equal(sableExternalResult.playerStates[oracle.id].passiveReviveUsed, true, "an External card defeat consumes Sable's one passive revival");

const kaelExternalAttack = addExternalPassiveTestCard(kael, "kael-attack", { effect: "damage", target: "enemy", value: 2 });
const kaelExternalGame = prepareExternalPassiveGame("EXTERNAL-KAEL", kaelParty, kael, kaelExternalAttack);
const kaelExternalResult = engine.resolveCardTurn(kaelExternalGame, kaelParty, kaelExternalAttack.id, kaelTarget.id, 20);
assert.equal(kaelExternalResult.outcome.amount, 3, "Unshielded Edge grants +1 damage to Kael's External Attack cards while he has no shield");

const ioneExternalSupport = addExternalPassiveTestCard(commander, "ione-support", { effect: "support", supportType: "shield", target: "self", value: 1 });
const ioneExternalParty = [commander, diceEnemy];
const ioneExternalGame = prepareExternalPassiveGame("EXTERNAL-IONE", ioneExternalParty, commander, ioneExternalSupport);
ioneExternalGame.adventure.target = 8;
const ioneExternalResult = engine.resolveCardTurn(ioneExternalGame, ioneExternalParty, ioneExternalSupport.id, commander.id, 7);
assert.equal(ioneExternalResult.outcome.success, true, "Marshal's Fortune lets Ione's External card meet its d20 target");
assert.equal(ioneExternalResult.outcome.bonus, 1, "Marshal's Fortune grants +1 on Ione's External card roll");

const daganExternalAttack = addExternalPassiveTestCard(dagan, "dagan-attack", { effect: "damage", target: "enemy", value: 2 });
const daganExternalGame = prepareExternalPassiveGame("EXTERNAL-DAGAN", daganParty, dagan, daganExternalAttack);
daganExternalGame.playerStates[dagan.id].hp = dagan.hero.maxHp / 2;
const daganExternalResult = engine.resolveCardTurn(daganExternalGame, daganParty, daganExternalAttack.id, daganTarget.id, 20);
assert.equal(daganExternalResult.outcome.amount, 4, "Bloodied Power grants +2 damage to Dagan's External Attack cards at half HP");

let resolvedSuccessCardCopies = 0;
for (const option of options) {
  for (const templateCard of option.skillDeck) {
    const otherHeroNames = options.map((candidate) => candidate.hero.name).filter((name) => name !== option.hero.name);
    const matrixActor = engine.createPlayerSession(`Success ${templateCard.id}`, 0, option.hero.name, `success-${templateCard.id}-actor`);
    const matrixEnemyOne = engine.createPlayerSession(`Enemy one ${templateCard.id}`, 1, otherHeroNames[0], `success-${templateCard.id}-enemy-one`);
    const matrixAlly = engine.createPlayerSession(`Ally ${templateCard.id}`, 2, otherHeroNames[1], `success-${templateCard.id}-ally`);
    const matrixEnemyTwo = engine.createPlayerSession(`Enemy two ${templateCard.id}`, 3, otherHeroNames[2], `success-${templateCard.id}-enemy-two`);
    const matrixParty = [matrixActor, matrixEnemyOne, matrixAlly, matrixEnemyTwo];
    const matrixCard = matrixActor.skillDeck.find((card) => card.id === templateCard.id);
    const matrixGame = engine.createInitialGame(matrixParty, engine.createAdventure(`SUCCESS-MATRIX-${templateCard.id}`), 30);
    matrixGame.turnOrder = matrixParty.map((player) => player.id);
    matrixGame.adventure.target = 8;
    const actorState = matrixGame.playerStates[matrixActor.id];
    const allyState = matrixGame.playerStates[matrixAlly.id];
    const enemyOneState = matrixGame.playerStates[matrixEnemyOne.id];
    const actorReplacements = matrixActor.skillDeck.filter((card) => card.id !== matrixCard.id).slice(0, 4);
    const enemyCandidate = matrixEnemyOne.skillDeck.find((card) => card.unique);
    const enemyReplacement = matrixEnemyOne.skillDeck.find((card) => card.id !== enemyCandidate.id);
    actorState.hand = [matrixCard.id];
    actorState.drawPile = actorReplacements.map((card) => card.id);
    actorState.discardPile = [];
    actorState.graveyard = [];
    if (matrixCard.effect === "heal") {
      actorState.hp = 1;
      allyState.hp = 1;
    }
    if (matrixCard.target === "defeated-ally") allyState.hp = 0;
    if (["purge-card", "steal-card"].includes(matrixCard.supportType)) {
      enemyOneState.hand = [enemyCandidate.id];
      enemyOneState.drawPile = [enemyReplacement.id];
      enemyOneState.discardPile = [];
      enemyOneState.graveyard = [];
    }
    if (matrixCard.supportType === "dispel-enemy") {
      Object.assign(enemyOneState, { shield: 5, attackBuff: 2, diceBuff: 2 });
      enemyOneState.timedEffects = [
        { kind: "shield", value: 5, expiresAfterTurn: 1 },
        { kind: "attackBuff", value: 2, expiresAfterTurn: 1 },
        { kind: "diceBuff", value: 2, expiresAfterTurn: 1 }
      ];
    }
    const expectedTargetIds = matrixCard.target === "all-enemies" ? [matrixEnemyOne.id, matrixEnemyTwo.id]
      : matrixCard.target === "all-allies" ? [matrixActor.id, matrixAlly.id]
        : matrixCard.target === "self" ? [matrixActor.id]
          : matrixCard.target === "ally" || matrixCard.target === "defeated-ally" ? [matrixAlly.id]
            : [matrixEnemyOne.id];
    const targetId = matrixCard.target === "ally" || matrixCard.target === "defeated-ally" ? matrixAlly.id
      : matrixCard.target === "enemy" || matrixCard.target === "player" ? matrixEnemyOne.id
        : matrixActor.id;
    const beforeSuccess = structuredClone(matrixGame);
    const matrixSuccess = engine.resolveCardTurn(matrixGame, matrixParty, matrixCard.id, targetId, 20);
    assert.equal(matrixSuccess.outcome.success, true, `${matrixCard.name} must resolve successfully above the d20 target`);
    assert.equal(matrixSuccess.outcome.cardId, matrixCard.id, `${matrixCard.name} must preserve its card identity in the synchronized outcome`);
    assert.equal(matrixSuccess.outcome.effect, matrixCard.effect, `${matrixCard.name} must publish its catalog effect type`);
    assert.deepEqual([...matrixSuccess.outcome.targetIds].sort(), [...expectedTargetIds].sort(), `${matrixCard.name} must affect exactly its legal targets`);
    for (const breakdown of matrixSuccess.outcome.effectBreakdowns) assert.equal(breakdown.parts.reduce((sum, part) => sum + part.value, 0), breakdown.value, `${matrixCard.name} effect breakdown ${breakdown.id} must add up to its displayed value`);
    assert.equal(matrixSuccess.outcome.failureDetail, "", `${matrixCard.name} success must not publish or apply a failure impact`);
    assert.equal(matrixSuccess.playerStates[matrixActor.id].cardUses[matrixCard.id], 1, `${matrixCard.name} must record its successful use`);
    if (matrixCard.id === "bo-return") assert(matrixSuccess.playerStates[matrixActor.id].graveyard.includes(matrixCard.id), "Immediate Resurrection enters the graveyard after successful use");
    else assert(matrixSuccess.playerStates[matrixActor.id].discardPile.includes(matrixCard.id), `${matrixCard.name} cycles to discard after successful use`);

    if (matrixCard.effect === "damage" || matrixCard.effect === "aoe") {
      const expectedDamage = expectedTargetIds.map((id) => {
        const targetState = beforeSuccess.playerStates[id];
        return matrixCard.value
          + engine.getThorneValePassiveDamageBonus(matrixActor, matrixCard, beforeSuccess.playerStates[matrixActor.id])
          + (matrixActor.hero.classId === "mage" && matrixCard.effect === "aoe" ? 1 : 0)
          + daganRules.getDaganFlintPassiveDamageBonus(matrixActor, matrixCard, beforeSuccess.playerStates[matrixActor.id])
          + engine.getKaelRookPassiveDamageBonus(matrixActor, matrixCard, beforeSuccess.playerStates[matrixActor.id], targetState);
      });
      assert.equal(matrixSuccess.outcome.amount, expectedDamage.reduce((sum, value) => sum + value, 0), `${matrixCard.name} must apply its exact total attack damage`);
      expectedTargetIds.forEach((id, index) => assert.equal(matrixSuccess.playerStates[id].hp, beforeSuccess.playerStates[id].hp - expectedDamage[index], `${matrixCard.name} must update each target's authoritative HP`));
      if (lioraRules.isLioraVennHealthExchangeCard(matrixCard)) {
        assert.equal(matrixSuccess.playerStates[matrixActor.id].hp, beforeSuccess.playerStates[matrixActor.id].hp - lioraRules.LIORA_VENN_HEALTH_COST, `${matrixCard.name} must charge its exact HP cost once`);
        assert.equal(matrixSuccess.playerStates[matrixActor.id].sanguineRecompense, true, `${matrixCard.name} must prime Liora's non-stacking heal bonus`);
      }
    } else if (matrixCard.effect === "heal") {
      const healPower = matrixCard.value + (matrixActor.hero.name === "Brother Orren" ? 1 : 0);
      const expectedHealing = expectedTargetIds.map((id) => Math.min(healPower, beforeSuccess.playerStates[id].maxHp - beforeSuccess.playerStates[id].hp));
      assert.equal(matrixSuccess.outcome.amount, expectedHealing.reduce((sum, value) => sum + value, 0), `${matrixCard.name} must report its exact restored HP`);
      expectedTargetIds.forEach((id, index) => assert.equal(matrixSuccess.playerStates[id].hp, beforeSuccess.playerStates[id].hp + expectedHealing[index], `${matrixCard.name} must update each target's authoritative HP`));
    } else if (matrixCard.effect === "guard") {
      const guardPower = matrixCard.value + (matrixActor.hero.name === "Elara Voss" ? 1 : 0);
      assert.equal(matrixSuccess.outcome.amount, guardPower, `${matrixCard.name} must report its exact shield amount per target`);
      expectedTargetIds.forEach((id) => assert.equal(matrixSuccess.playerStates[id].shield, beforeSuccess.playerStates[id].shield + guardPower, `${matrixCard.name} must update each target's authoritative shield`));
    } else if (matrixCard.effect === "support") {
      if (matrixCard.supportType === "attack") expectedTargetIds.forEach((id) => assert.equal(matrixSuccess.playerStates[id].attackBuff, matrixCard.value, `${matrixCard.name} must grant its exact attack buff`));
      else if (matrixCard.supportType === "dice") expectedTargetIds.forEach((id) => assert.equal(matrixSuccess.playerStates[id].diceBuff, matrixCard.value, `${matrixCard.name} must grant its exact d20 buff`));
      else if (matrixCard.supportType === "enemy-dice") assert.equal(matrixSuccess.playerStates[matrixEnemyOne.id].dicePenalty, matrixCard.value, `${matrixCard.name} must apply its exact d20 penalty`);
      else if (matrixCard.supportType === "advance-ally") assert.equal(matrixSuccess.turnOrder[0], matrixAlly.id, `${matrixCard.name} must move the chosen ally directly behind the acting player`);
      else if (matrixCard.supportType === "revive") assert.equal(matrixSuccess.playerStates[matrixAlly.id].hp, Math.ceil(matrixAlly.hero.maxHp / 3), `${matrixCard.name} must immediately revive its target with one-third HP`);
      else if (matrixCard.supportType === "skip-enemy") assert.equal(matrixSuccess.playerStates[matrixEnemyOne.id].skipTurns, 1, `${matrixCard.name} must cancel exactly one enemy turn`);
      else if (matrixCard.supportType === "zero-pity") assert.equal(matrixSuccess.playerStates[matrixAlly.id].zeroPityUntilTurn, 1, `${matrixCard.name} must grant zero pity through the ally's next turn`);
      else if (matrixCard.supportType === "purge-card") {
        assert(matrixSuccess.playerStates[matrixEnemyOne.id].graveyard.includes(enemyCandidate.id), `${matrixCard.name} must move the selected random hand card to graveyard`);
        assert.deepEqual(matrixSuccess.playerStates[matrixEnemyOne.id].purgedCards, [{ cardId: enemyCandidate.id, returnAfterPhase: 2 }], `${matrixCard.name} must record the two-phase return boundary`);
      } else if (matrixCard.supportType === "steal-card") {
        assert(matrixSuccess.playerStates[matrixActor.id].hand.includes(enemyCandidate.id), `${matrixCard.name} must move the selected random enemy card into the actor's hand`);
        assert.equal(matrixSuccess.playerStates[matrixActor.id].borrowedCards[0].ownerId, matrixEnemyOne.id, `${matrixCard.name} must retain authoritative ownership metadata`);
      } else if (matrixCard.supportType === "dispel-enemy") {
        assert.equal(matrixSuccess.playerStates[matrixEnemyOne.id].shield, 2, `${matrixCard.name} must destroy up to its exact shield value`);
        assert.equal(matrixSuccess.playerStates[matrixEnemyOne.id].attackBuff, 0, `${matrixCard.name} must remove attack buffs`);
        assert.equal(matrixSuccess.playerStates[matrixEnemyOne.id].diceBuff, 0, `${matrixCard.name} must remove d20 buffs`);
      } else assert.fail(`${matrixCard.name} uses an untested support effect`);
    } else {
      assert.equal(matrixSuccess.outcome.amount, 0, `${matrixCard.name} must resolve with no gameplay effect`);
      assert.equal(matrixSuccess.playerStates[matrixEnemyOne.id].hp, beforeSuccess.playerStates[matrixEnemyOne.id].hp, `${matrixCard.name} must not alter enemy HP`);
      assert.equal(matrixSuccess.playerStates[matrixActor.id].shield, beforeSuccess.playerStates[matrixActor.id].shield, `${matrixCard.name} must not alter actor shield`);
    }
    resolvedSuccessCardCopies += 1;
  }
}
assert.equal(resolvedSuccessCardCopies, 110, "the success matrix must execute every card in all eleven character decks");

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
    for (const breakdown of matrixFailure.outcome.effectBreakdowns) assert.equal(breakdown.parts.reduce((sum, part) => sum + part.value, 0), breakdown.value, `${matrixCard.name} failure breakdown ${breakdown.id} must add up to its displayed value`);
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
const failedHealCard = failureHealer.skillDeck.find((card) => card.name === "Graceful Renewal");
const failedHealGame = engine.createInitialGame([failureHealer, failureHealEnemy, failureHealAlly], engine.createAdventure("FAILURE-HEAL"), 30);
failedHealGame.turnOrder = [failureHealer.id, failureHealEnemy.id, failureHealAlly.id];
failedHealGame.adventure.target = 20;
failedHealGame.playerStates[failureHealer.id].hp = 5;
failedHealGame.playerStates[failureHealAlly.id].hp = 2;
failedHealGame.playerStates[failureHealer.id].hand = [failedHealCard.id];
const failedHeal = engine.resolveCardTurn(failedHealGame, [failureHealer, failureHealEnemy, failureHealAlly], failedHealCard.id, failureHealAlly.id, 1);
assert.equal(failedHeal.outcome.success, false, "a low Graceful Renewal roll fails");
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
emptyGame.playerStates[first.id].drawPile = first.skillDeck.filter((card) => card.id !== emptyCard.id).slice(0, 4).map((card) => card.id);
const emptyResult = engine.resolveCardTurn(emptyGame, [first, second], emptyCard.id, first.id, 20);
assert.equal(emptyResult.playerStates[first.id].hp, emptyGame.playerStates[first.id].hp);
assert.equal(emptyResult.playerStates[second.id].hp, emptyGame.playerStates[second.id].hp);
assert.equal(emptyResult.playerStates[first.id].shield, emptyGame.playerStates[first.id].shield);
assert(emptyResult.playerStates[first.id].discardPile.includes(emptyCard.id), "played no-effect card still cycles normally");
assert.equal(emptyResult.playerStates[first.id].hand.length, 4, "a one-card hand draws enough available cards to end the turn at 4");
assert.match(emptyResult.history.at(-1).message, /had no effect/);

const cycleGame = engine.createInitialGame([first, second], engine.createAdventure("CYCLE"), 30);
cycleGame.turnOrder = [first.id, second.id];
const guard = first.skillDeck.find((card) => card.effect === "guard");
const heal = first.skillDeck.find((card) => card.effect === "heal");
cycleGame.playerStates[first.id].hand = [guard.id, heal.id, attack.id];
const cycleDraws = first.skillDeck.filter((card) => ![guard.id, heal.id, attack.id].includes(card.id)).slice(0, 2).map((card) => card.id);
cycleGame.playerStates[first.id].drawPile = cycleDraws;
cycleGame.playerStates[first.id].discardPile = [];
const cycled = engine.resolveCardTurn(cycleGame, [first, second], attack.id, second.id, 20);
assert(cycled.playerStates[first.id].hand.includes(guard.id) && cycled.playerStates[first.id].hand.includes(heal.id), "unplayed hand cards stay in hand");
assert(cycleDraws.every((cardId) => cycled.playerStates[first.id].hand.includes(cardId)), "a two-card hand draws exactly two cards to reach 4");
assert.equal(cycled.playerStates[first.id].hand.length, 4, "the end-of-turn refill stops at 4 cards");
assert.deepEqual(cycled.playerStates[first.id].discardPile, [attack.id], "only the played card enters discard");

cycled.playerStates[first.id].hand = [guard.id, heal.id];
cycled.playerStates[first.id].drawPile = [];
const recycledSources = first.skillDeck.filter((card) => ![guard.id, heal.id].includes(card.id)).slice(0, 4).map((card) => card.id);
cycled.playerStates[first.id].discardPile = recycledSources;
cycled.activePlayerIndex = 0;
cycled.turnOrder = [first.id, second.id];
const reshuffled = engine.resolveCardTurn(cycled, [first, second], guard.id, first.id, 20);
assert.equal(reshuffled.playerStates[first.id].hand.length, 4, "an empty draw pile recycles discard and continues drawing until the hand reaches 4");
assert(reshuffled.playerStates[first.id].hand.includes(heal.id), "unplayed cards remain in hand when discard refills an empty draw pile");
assert.equal(reshuffled.playerStates[first.id].drawPile.length, 2, "recycled cards not needed for the four-card hand remain in draw");
assert.equal(reshuffled.playerStates[first.id].discardPile.length, 0, "all discarded cards move to draw as soon as an empty draw pile needs a replacement");
assert.deepEqual(new Set([...reshuffled.playerStates[first.id].hand, ...reshuffled.playerStates[first.id].drawPile]), new Set([...recycledSources, guard.id, heal.id]), "the refill recycle preserves every reusable card across hand and draw");

const fiveCardCycle = engine.createInitialGame([first, second], engine.createAdventure("FIVE-CARD-CYCLE"), 30);
fiveCardCycle.turnOrder = [first.id, second.id];
const fiveReusableCards = first.skillDeck.slice(0, 5).map((card) => card.id);
fiveCardCycle.playerStates[first.id].hand = [fiveReusableCards[4]];
fiveCardCycle.playerStates[first.id].drawPile = [];
fiveCardCycle.playerStates[first.id].discardPile = fiveReusableCards.slice(0, 4);
const fiveCardRefill = engine.resolveCardTurn(fiveCardCycle, [first, second], fiveReusableCards[4], first.id, 20);
assert.equal(fiveCardRefill.playerStates[first.id].hand.length, 4, "a depleted one-card hand refills to 4 from recycled discard");
assert.equal(fiveCardRefill.playerStates[first.id].drawPile.length, 1, "recycling stops drawing as soon as the hand reaches 4");
assert.equal(fiveCardRefill.playerStates[first.id].discardPile.length, 0, "all discarded cards move out of discard when draw is refilled");
assert.deepEqual(new Set([...fiveCardRefill.playerStates[first.id].hand, ...fiveCardRefill.playerStates[first.id].drawPile]), new Set(fiveReusableCards), "the four-card refill preserves every reusable card across hand and draw");

const noDrawGame = engine.createInitialGame([first, second], engine.createAdventure("NO-DRAW-AT-FOUR"), 30);
noDrawGame.turnOrder = [first.id, second.id];
const noDrawCards = first.skillDeck.slice(0, 7).map((card) => card.id);
noDrawGame.playerStates[first.id].hand = noDrawCards.slice(0, 6);
noDrawGame.playerStates[first.id].drawPile = [noDrawCards[6]];
noDrawGame.playerStates[first.id].discardPile = [];
const noDrawResult = engine.resolveCardTurn(noDrawGame, [first, second], noDrawCards[0], second.id, 20);
assert.equal(noDrawResult.playerStates[first.id].hand.length, 5, "a hand that remains above 4 after playing a card draws nothing");
assert.deepEqual(noDrawResult.playerStates[first.id].drawPile, [noDrawCards[6]], "the draw pile is untouched when the ending hand already has at least 4 cards");

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
finalGame.playerStates[first.id].drawPile = [emptyCard.id];
const secondPhaseCard = second.skillDeck.find((card) => card.effect === "none");
finalGame.playerStates[second.id].hand = [secondPhaseCard.id];
const finalTurn = engine.resolveCardTurn(finalGame, [first, second], attack.id, second.id, 20);
assert.equal(finalTurn.ended, false, "finishing phase 30 does not end a battle while both teams still live");
assert.equal(finalTurn.winnerTeam, null);
assert.equal(finalTurn.completedPhases, 30);
assert.equal(finalTurn.history.at(-1).phase, 30, "the final action in phase 30 keeps its actual phase number");
assert.equal(finalTurn.adventure.chapter, 30, "the legacy 30-cell adventure visualization stays frozen after phase 30");
assert(finalTurn.playerStates[second.id].hp > 0, "a living opposing team keeps the battle active after phase 30");
const phaseThirtyOneFirstTurn = engine.resolveCardTurn(finalTurn, [first, second], secondPhaseCard.id, second.id, 20);
assert.equal(phaseThirtyOneFirstTurn.history.at(-1).phase, 31, "phase-31 actions use the uncapped phase number");
const phaseThirtyOneComplete = engine.resolveCardTurn(phaseThirtyOneFirstTurn, [first, second], emptyCard.id, first.id, 20);
assert.equal(phaseThirtyOneComplete.completedPhases, 31, "the shared turn resolver continues into phase 32");
assert.equal(phaseThirtyOneComplete.ended, false, "later phases do not trigger a total-HP ending");
assert.equal(phaseThirtyOneComplete.winnerTeam, null);

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

const shopFirst = structuredClone(first);
const shopSecond = structuredClone(second);
const shopGame = engine.createInitialGame([shopFirst, shopSecond], engine.createAdventure("SHOP"), 30);
shopGame.turnOrder = [shopFirst.id, shopSecond.id];
const shopState = shopGame.playerStates[shopFirst.id];
shopState.goldUnits = shopRules.MAX_GOLD_UNITS;
const shieldPotion = shopRules.purchaseShopOffer(shopGame, [shopFirst, shopSecond], shopFirst.id, "shield-potion", 1000);
assert.equal(shieldPotion.ok, true, "a living player can buy a potion at any time");
assert.equal(shopState.shield, 3, "Aegis Tonic applies immediately");
assert.equal(shopState.goldUnits, shopRules.MAX_GOLD_UNITS - 4, "the authoritative Shop deducts half-unit Gold prices");
assert.deepEqual(
  { kind: shopGame.outcome.notices.at(-1).kind, actorId: shopGame.outcome.notices.at(-1).actorId, shopOfferId: shopGame.outcome.notices.at(-1).shopOfferId, title: shopGame.outcome.notices.at(-1).title },
  { kind: "shop-use", actorId: shopFirst.id, shopOfferId: "shield-potion", title: `${shopFirst.displayName} used Aegis Tonic` },
  "an immediately activated Potion emits an authoritative use toast with actor and offer identity"
);
assert.equal(shopRules.purchaseShopOffer(shopGame, [shopFirst, shopSecond], shopFirst.id, "shield-potion", 1001).ok, false, "identical active potion effects cannot stack");
assert.equal(shopState.goldUnits, shopRules.MAX_GOLD_UNITS - 4, "a rejected purchase spends no Gold");

const potionNoticeCount = shopGame.outcome.notices.length;
assert.equal(shopRules.purchaseShopOffer(shopGame, [shopFirst, shopSecond], shopFirst.id, "additional-die", 1002).ok, true);
assert.equal(shopRules.purchaseShopOffer(shopGame, [shopFirst, shopSecond], shopFirst.id, "lucky-die", 1003).ok, true);
assert.equal(shopGame.outcome.notices.length, potionNoticeCount, "buying an inventory Item does not claim that it was used");
assert.equal(shopRules.useShopItem(shopGame, [shopFirst, shopSecond], shopFirst.id, "additional-die", 1004).ok, true);
assert.equal(shopState.additionalDieActive, true);
assert.deepEqual(
  { kind: shopGame.outcome.notices.at(-1).kind, actorId: shopGame.outcome.notices.at(-1).actorId, shopOfferId: shopGame.outcome.notices.at(-1).shopOfferId, title: shopGame.outcome.notices.at(-1).title },
  { kind: "shop-use", actorId: shopFirst.id, shopOfferId: "additional-die", title: `${shopFirst.displayName} used Twin-Fate Die` },
  "activating an inventory Item emits the shared authoritative use toast"
);
assert.equal(shopRules.useShopItem(shopGame, [shopFirst, shopSecond], shopFirst.id, "lucky-die", 1005).ok, false, "Twin-Fate Die and Lucky Die cannot be active together");

shopState.goldUnits = shopRules.MAX_GOLD_UNITS;
for (const offerId of ["shield-break", "marked-target", "steal-gold"]) {
  assert.equal(shopRules.purchaseShopOffer(shopGame, [shopFirst, shopSecond], shopFirst.id, offerId, 1100 + shopState.externalCardsPurchased).ok, true);
}
assert.equal(shopState.externalCardsPurchased, shopRules.MAX_EXTERNAL_CARDS);
assert.equal(shopFirst.skillDeck.filter((card) => card.external).length, 3, "purchased External Cards receive runtime deck definitions");
assert.equal(new Set(shopFirst.skillDeck.filter((card) => card.external).map((card) => card.id)).size, 3, "External Card runtime IDs are unique");
assert.equal(shopRules.purchaseShopOffer(shopGame, [shopFirst, shopSecond], shopFirst.id, "bad-luck", 1200).ok, false, "a player cannot acquire more than three External Cards");

const exchangeGame = engine.createInitialGame([structuredClone(first), structuredClone(second)], engine.createAdventure("SHOP-EXCHANGE"), 30);
const exchangePlayer = structuredClone(first);
const exchangeOther = structuredClone(second);
const exchangeState = exchangeGame.playerStates[first.id];
exchangeState.pityPoints = 2;
exchangeState.goldUnits = 0;
assert.equal(shopRules.exchangePityForGold(exchangeGame, [exchangePlayer, exchangeOther], first.id, 1300).ok, true);
assert.equal(exchangeState.pityPoints, 1);
assert.equal(exchangeState.goldUnits, 4, "one pity point exchanges for exactly two Gold");

const goldGame = engine.createInitialGame([structuredClone(first), structuredClone(second)], engine.createAdventure("SHOP-GOLD"), 30);
goldGame.turnOrder = [first.id, second.id];
goldGame.adventure.target = 10;
goldGame.playerStates[first.id].hand = [attack.id];
goldGame.playerStates[second.id].hp = 50;
goldGame.playerStates[second.id].maxHp = 50;
const goldSuccess = engine.resolveCardTurn(goldGame, [first, second], attack.id, second.id, 20);
assert.equal(goldSuccess.playerStates[first.id].goldUnits, 2, "a successful rolled card earns one Gold");
assert.equal(goldSuccess.outcome.goldChange, 1);

const failedGoldGame = engine.createInitialGame([structuredClone(first), structuredClone(second)], engine.createAdventure("SHOP-GOLD-FAIL"), 30);
failedGoldGame.turnOrder = [first.id, second.id];
failedGoldGame.adventure.target = 16;
failedGoldGame.playerStates[first.id].hand = [attack.id];
failedGoldGame.playerStates[second.id].hp = 50;
const goldFailure = engine.resolveCardTurn(failedGoldGame, [first, second], attack.id, second.id, 1);
assert.equal(goldFailure.playerStates[first.id].goldUnits, 1, "a failed rolled card earns half a Gold");
assert.equal(goldFailure.outcome.goldChange, 0.5);
assert.equal(shopRules.goldRewardUnitsForOutcome({ kind: "timeout" }), 1, "an automatic timeout skip earns half a Gold");
assert.equal(shopRules.goldRewardUnitsForOutcome({ kind: "forced-skip" }), 1, "an effect-forced skip earns half a Gold");

const twinDieGame = engine.createInitialGame([structuredClone(first), structuredClone(second)], engine.createAdventure("SHOP-TWIN-DIE"), 30);
twinDieGame.turnOrder = [first.id, second.id];
twinDieGame.adventure.target = 15;
twinDieGame.playerStates[first.id].hand = [attack.id];
twinDieGame.playerStates[first.id].additionalDieActive = true;
twinDieGame.playerStates[second.id].hp = 50;
const twinDieResult = engine.resolveCardTurn(twinDieGame, [first, second], attack.id, second.id, 2, false, 18);
assert.equal(twinDieResult.outcome.success, true);
assert.equal(twinDieResult.outcome.rollMode, "additional-die");
assert.equal(twinDieResult.outcome.roll, 18, "Twin-Fate Die uses the higher d20 result");
assert.equal(twinDieResult.playerStates[first.id].additionalDieActive, false, "the additional die is consumed by the next rolled card");

const goldenGame = engine.createInitialGame([structuredClone(first), structuredClone(second)], engine.createAdventure("SHOP-GOLDEN"), 30);
goldenGame.turnOrder = [first.id, second.id];
goldenGame.playerStates[first.id].hand = [attack.id];
goldenGame.playerStates[second.id].hp = 50;
goldenGame.playerStates[second.id].shield = 1;
goldenGame.playerStates[second.id].goldenShield = 3;
const goldenResult = engine.resolveCardTurn(goldenGame, [first, second], attack.id, second.id, 20);
assert.equal(goldenResult.playerStates[second.id].shield, 0, "enemy attacks consume normal Shield first");
assert(goldenResult.playerStates[second.id].goldenShield < 3, "Golden Shield absorbs only the damage remaining after normal Shield");

function freshShopEffectGame(seed) {
  const actor = structuredClone(first);
  const target = structuredClone(second);
  const game = engine.createInitialGame([actor, target], engine.createAdventure(seed), 30);
  game.turnOrder = [actor.id, target.id];
  game.playerStates[actor.id].goldUnits = shopRules.MAX_GOLD_UNITS;
  game.playerStates[target.id].hp = 50;
  game.playerStates[target.id].maxHp = 50;
  return { actor, target, game, actorState: game.playerStates[actor.id], targetState: game.playerStates[target.id] };
}

const attackPotionBattle = freshShopEffectGame("SHOP-ATTACK-POTION");
assert.equal(shopRules.purchaseShopOffer(attackPotionBattle.game, [attackPotionBattle.actor, attackPotionBattle.target], first.id, "attack-potion").ok, true);
attackPotionBattle.actorState.hand = [attack.id];
const attackPotionResult = engine.resolveCardTurn(attackPotionBattle.game, [attackPotionBattle.actor, attackPotionBattle.target], attack.id, second.id, 20);
assert.equal(attackPotionResult.outcome.amount, attack.value + 2, "Warflame Tonic adds two damage to the next successful attack");
assert.equal(attackPotionResult.playerStates[first.id].shopAttackBonus, 0, "Warflame Tonic is consumed only by a successful attack");

const dicePotionBattle = freshShopEffectGame("SHOP-DICE-POTION");
assert.equal(shopRules.purchaseShopOffer(dicePotionBattle.game, [dicePotionBattle.actor, dicePotionBattle.target], first.id, "dice-potion").ok, true);
dicePotionBattle.game.adventure.target = 10;
dicePotionBattle.actorState.hand = [attack.id];
const dicePotionResult = engine.resolveCardTurn(dicePotionBattle.game, [dicePotionBattle.actor, dicePotionBattle.target], attack.id, second.id, 8);
assert.equal(dicePotionResult.outcome.success, true, "Truecast Tonic can turn a short roll into success");
assert.equal(dicePotionResult.outcome.bonus, 2);
assert.equal(dicePotionResult.outcome.shopDiceBonus, 2, "the consumed Truecast Tonic remains available to the result breakdown");
assert.equal(dicePotionResult.playerStates[first.id].shopDiceBonus, 0);

const pityPotionBattle = freshShopEffectGame("SHOP-PITY-POTION");
assert.equal(shopRules.purchaseShopOffer(pityPotionBattle.game, [pityPotionBattle.actor, pityPotionBattle.target], first.id, "pity-potion").ok, true);
pityPotionBattle.game.adventure.target = 16;
pityPotionBattle.actorState.hand = [attack.id];
const pityPotionResult = engine.resolveCardTurn(pityPotionBattle.game, [pityPotionBattle.actor, pityPotionBattle.target], attack.id, second.id, 1);
assert.equal(pityPotionResult.outcome.success, true, "Mercy Tonic makes the next played card an automatic success");
assert.equal(pityPotionResult.outcome.pityCost, 0);
assert.equal(pityPotionResult.playerStates[first.id].shopFreePity, false);

const reviveItemBattle = freshShopEffectGame("SHOP-REVIVE");
assert.equal(shopRules.purchaseShopOffer(reviveItemBattle.game, [reviveItemBattle.actor, reviveItemBattle.target], first.id, "revive-item").ok, true);
reviveItemBattle.actorState.hp = 0;
assert.equal(shopRules.useShopItem(reviveItemBattle.game, [reviveItemBattle.actor, reviveItemBattle.target], first.id, "revive-item").ok, true);
assert.equal(reviveItemBattle.actorState.hp, Math.ceil(reviveItemBattle.actorState.maxHp / 3), "Phoenix Sigil revives its defeated owner with one-third HP");
assert.equal(shopRules.getInventoryQuantity(reviveItemBattle.actorState, "revive-item"), 0, "Phoenix Sigil is single-use and only one can be bought");

const piercingItemBattle = freshShopEffectGame("SHOP-PIERCING-ITEM");
assert.equal(shopRules.purchaseShopOffer(piercingItemBattle.game, [piercingItemBattle.actor, piercingItemBattle.target], first.id, "piercing-blade").ok, true);
assert.equal(shopRules.useShopItem(piercingItemBattle.game, [piercingItemBattle.actor, piercingItemBattle.target], first.id, "piercing-blade").ok, true);
piercingItemBattle.actorState.hand = [attack.id];
piercingItemBattle.targetState.shield = 10;
piercingItemBattle.targetState.goldenShield = 2;
const piercingItemResult = engine.resolveCardTurn(piercingItemBattle.game, [piercingItemBattle.actor, piercingItemBattle.target], attack.id, second.id, 20);
assert.equal(piercingItemResult.playerStates[second.id].shield, 10, "Piercing Blade ignores normal Shield");
assert.equal(piercingItemResult.playerStates[second.id].goldenShield, 2, "Piercing Blade also ignores Golden Shield");
assert(piercingItemResult.outcome.amount > 0);

const luckyItemBattle = freshShopEffectGame("SHOP-LUCKY-ITEM");
assert.equal(shopRules.purchaseShopOffer(luckyItemBattle.game, [luckyItemBattle.actor, luckyItemBattle.target], first.id, "lucky-die").ok, true);
assert.equal(shopRules.useShopItem(luckyItemBattle.game, [luckyItemBattle.actor, luckyItemBattle.target], first.id, "lucky-die").ok, true);
luckyItemBattle.game.adventure.target = 15;
luckyItemBattle.actorState.hand = [attack.id];
const luckyItemResult = engine.resolveCardTurn(luckyItemBattle.game, [luckyItemBattle.actor, luckyItemBattle.target], attack.id, second.id, 2, false, 18);
assert.equal(luckyItemResult.outcome.rollMode, "lucky-die");
assert.equal(luckyItemResult.outcome.roll, 18, "Lucky Die rerolls only after the first result would fail");
assert.equal(luckyItemResult.outcome.success, true);

const shieldBreakBattle = freshShopEffectGame("SHOP-SHIELD-BREAK");
assert.equal(shopRules.purchaseShopOffer(shieldBreakBattle.game, [shieldBreakBattle.actor, shieldBreakBattle.target], first.id, "shield-break").ok, true);
const shieldBreakCard = shieldBreakBattle.actor.skillDeck.find((card) => card.shopOfferId === "shield-break");
shieldBreakBattle.actorState.hand = [shieldBreakCard.id];
shieldBreakBattle.targetState.shield = 1;
shieldBreakBattle.targetState.goldenShield = 3;
const shieldBreakResult = engine.resolveCardTurn(shieldBreakBattle.game, [shieldBreakBattle.actor, shieldBreakBattle.target], shieldBreakCard.id, second.id, 20);
assert.equal(shieldBreakResult.playerStates[second.id].shield, 0);
assert.equal(shieldBreakResult.playerStates[second.id].goldenShield, 2, "Shield Break destroys normal Shield before Golden Shield");

const markedBattle = freshShopEffectGame("SHOP-MARKED");
assert.equal(shopRules.purchaseShopOffer(markedBattle.game, [markedBattle.actor, markedBattle.target], first.id, "marked-target").ok, true);
const markedCard = markedBattle.actor.skillDeck.find((card) => card.shopOfferId === "marked-target");
markedBattle.actorState.hand = [markedCard.id];
const markedApplied = engine.resolveCardTurn(markedBattle.game, [markedBattle.actor, markedBattle.target], markedCard.id, second.id, 20);
markedApplied.turnOrder = [first.id, second.id];
markedApplied.adventure.target = 10;
markedApplied.playerStates[first.id].hand = [attack.id];
const markedAttack = engine.resolveCardTurn(markedApplied, [markedBattle.actor, markedBattle.target], attack.id, second.id, 9);
assert.equal(markedAttack.outcome.success, true);
assert.equal(markedAttack.outcome.bonus, 1, "Marked Target adds one to the next attack roll against that player");
assert.equal(markedAttack.outcome.markedTargetBonus, 1, "the consumed Marked Target remains available to the result breakdown");
assert.equal(markedAttack.playerStates[first.id].markedTargetId, "", "the mark is consumed by the matching attack roll");

const badLuckBattle = freshShopEffectGame("SHOP-BAD-LUCK");
assert.equal(shopRules.purchaseShopOffer(badLuckBattle.game, [badLuckBattle.actor, badLuckBattle.target], first.id, "bad-luck").ok, true);
const badLuckCard = badLuckBattle.actor.skillDeck.find((card) => card.shopOfferId === "bad-luck");
badLuckBattle.actorState.hand = [badLuckCard.id];
const badLuckResult = engine.resolveCardTurn(badLuckBattle.game, [badLuckBattle.actor, badLuckBattle.target], badLuckCard.id, second.id, 20);
assert.equal(badLuckResult.playerStates[second.id].dicePenalty, 1, "Bad Luck applies minus one to the target's next d20 roll");

const piercingCardBattle = freshShopEffectGame("SHOP-PIERCING-CARD");
assert.equal(shopRules.purchaseShopOffer(piercingCardBattle.game, [piercingCardBattle.actor, piercingCardBattle.target], first.id, "piercing-attack").ok, true);
const piercingCard = piercingCardBattle.actor.skillDeck.find((card) => card.shopOfferId === "piercing-attack");
piercingCardBattle.actorState.hand = [piercingCard.id];
const piercingPrepared = engine.resolveCardTurn(piercingCardBattle.game, [piercingCardBattle.actor, piercingCardBattle.target], piercingCard.id, first.id, 20);
assert.equal(piercingPrepared.playerStates[first.id].piercingAttackActive, true, "Piercing Attack prepares the next attack");

const stealGoldBattle = freshShopEffectGame("SHOP-STEAL-GOLD");
assert.equal(shopRules.purchaseShopOffer(stealGoldBattle.game, [stealGoldBattle.actor, stealGoldBattle.target], first.id, "steal-gold").ok, true);
const stealGoldCard = stealGoldBattle.actor.skillDeck.find((card) => card.shopOfferId === "steal-gold");
stealGoldBattle.actorState.hand = [stealGoldCard.id];
stealGoldBattle.targetState.goldUnits = 10;
const actorGoldBeforeSteal = stealGoldBattle.actorState.goldUnits;
const stealGoldResult = engine.resolveCardTurn(stealGoldBattle.game, [stealGoldBattle.actor, stealGoldBattle.target], stealGoldCard.id, second.id, 20);
assert.equal(stealGoldResult.playerStates[second.id].goldUnits, 6, "Steal Gold removes exactly two Gold when available");
assert.equal(stealGoldResult.playerStates[first.id].goldUnits, actorGoldBeforeSteal + 6, "Steal Gold transfers two Gold and the successful roll earns one more");

const serverAuthoritySource = await readFile(new URL("../backend/server.mjs", import.meta.url), "utf8");
const workerAuthoritySource = await readFile(new URL("../backend/realtime-worker.js", import.meta.url), "utf8");
for (const [label, source] of [["Node", serverAuthoritySource], ["Worker", workerAuthoritySource]]) {
  assert.match(source, /card\.supportType === 'discard-random-card'[\s\S]*refillHandToMinimum\(targetState, handIndex\)/, `${label} authority resolves Control Cards with the shared four-card minimum against the target's private hand`);
  assert.match(source, /card\.supportType === 'purge-card'[\s\S]*const specialCandidates = candidates\.filter[\s\S]*const preferredCandidates = specialCandidates\.length \? specialCandidates : candidates[\s\S]*const removedId = preferredCandidates/, `${label} authority makes Mirefield Seizure prefer special cards with common-card fallback`);
  assert.match(source, /returnBorrowedCards\(game, passingPlayer\.id\);[\s\S]*refillHandToMinimum\(game\.playerStates\[passingPlayer\.id\]\)/, `${label} authority refills only after borrowed cards return at turn end`);
  assert.match(source, /purchaseShopOffer[\s\S]*exchangePityForGold[\s\S]*useShopItem/, `${label} authority exposes all three Shop command families`);
  assert.equal(source.match(/normalizeDaganFlintCards\(room\.players\)/g)?.length, 2, `${label} authority migrates Dagan's special cards before publishing state and accepting turns`);
}

if (originalTestMode === undefined) delete process.env.TEST_MODE;
else process.env.TEST_MODE = originalTestMode;

console.log("Game-rule test passed: character cards, passives, pity, Shop Gold, purchases, inventory, External Cards, dice items, Golden Shield, support effects, turn order, history, victory, and defeated-player lockout.");
