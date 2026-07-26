import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const compile = (source, fileName) => ts.transpileModule(source, {
  fileName,
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;

const catalogSource = await readFile(new URL("../backend/game/catalog.ts", import.meta.url), "utf8");
const catalogUrl = `data:text/javascript;base64,${Buffer.from(compile(catalogSource, "catalog.ts")).toString("base64")}`;
const engineSource = await readFile(new URL("../backend/game/engine.ts", import.meta.url), "utf8");
const compiledEngine = compile(engineSource, "engine.ts").replace('from "./catalog"', `from "${catalogUrl}"`);
const engine = await import(`data:text/javascript;base64,${Buffer.from(compiledEngine).toString("base64")}`);

const sampledTargets = Array.from({ length: 256 }, () => engine.randomDiceTarget());
const sampledRolls = Array.from({ length: 256 }, () => engine.randomD20Roll());
assert(sampledTargets.every((value) => Number.isInteger(value) && value >= 8 && value <= 16), "every target must be an independent integer from 8 through 16");
assert(sampledRolls.every((value) => Number.isInteger(value) && value >= 1 && value <= 20), "every d20 result must be an independent integer from 1 through 20");
assert(new Set(sampledTargets).size > 1, "target sampling must not return a fixed value");
assert(new Set(sampledRolls).size > 1, "d20 sampling must not return a fixed value");

const options = engine.getCharacterOptions();
assert.equal(options.length, 10);
for (const option of options) {
  assert.equal(option.skillDeck.length, 10, `${option.hero.name} must have 10 cards`);
  assert.equal(option.skillDeck.filter((card) => card.unique).length, 3);
  assert.equal(option.skillDeck.filter((card) => !card.unique).length, 7);
  assert(option.skillDeck.every((card) => card.bonus === 0), "cards cannot carry a built-in d20 bonus");
  assert(option.skillDeck.every((card) => !("risk" in card) && card.effect !== "check"));
  assert(option.skillDeck.filter((card) => card.unique).every((card) => ["self-damage", "team-damage", "lose-shield"].includes(card.failureEffect) && card.failureValue > 0), "every special card needs a balanced owner/team failure penalty");
  const common = option.skillDeck.filter((card) => !card.unique);
  assert(common.every((card) => !card.failureEffect && !card.failureValue), "common cards cannot have failure penalties");
  assert.equal(common.filter((card) => card.effect === "damage").length, 2, "common deck needs two attacks");
  assert.equal(common.filter((card) => card.effect === "guard" && card.target === "self").length, 1, "common deck needs one self guard");
  assert.equal(common.filter((card) => card.effect === "heal" && card.target === "self").length, 1, "common deck needs one self heal");
  assert.equal(common.filter((card) => card.effect === "none" && card.value === 0).length, 3, "common deck needs three no-effect cards");
  assert(option.skillDeck.filter((card) => card.target === "all-allies").every((card) => /including yourself/i.test(card.description)), "all-allies descriptions must explicitly include the acting player");
  assert(option.skillDeck.filter((card) => card.target === "ally" && card.supportType !== "advance-ally").every((card) => /including yourself/i.test(card.description)), "one-ally descriptions must explicitly include the acting player");
}
const supportTypes = new Set(options.flatMap((option) => option.skillDeck.filter((card) => card.effect === "support").map((card) => card.supportType)));
assert.deepEqual([...supportTypes].sort(), ["advance-ally", "attack", "dice", "dispel-enemy", "enemy-dice", "healing", "purge-card", "revive", "shield", "skip-enemy", "steal-card"]);
for (const classId of ["warden", "healer", "tank", "oracle", "support"]) {
  const option = options.find((candidate) => candidate.hero.classId === classId);
  assert.equal(option.skillDeck.filter((card) => card.unique && ["damage", "aoe"].includes(card.effect)).length, 0, `${classId} must focus on its non-damage team role`);
}
for (const classId of ["ranger", "mage", "assassin", "duelist", "berserker"]) {
  const option = options.find((candidate) => candidate.hero.classId === classId);
  assert.equal(option.skillDeck.filter((card) => card.unique && ["damage", "aoe"].includes(card.effect)).length, 2, `${classId} must have exactly two damage specials and one role utility special`);
}
assert.equal(options.find((option) => option.hero.classId === "tank").hero.maxHp, 14);
assert.equal(options.find((option) => option.hero.classId === "mage").hero.maxHp, 7);
assert.deepEqual([...options].sort((a, b) => b.hero.speed - a.hero.speed).map((option) => option.hero.name), ["Nyx Calder", "Thorne Vale", "Kael Rook", "Sable Fen", "Ione Mire", "Mira Ash", "Brother Orren", "Elara Voss", "Dagan Flint", "Bram Coalhand"]);

const first = engine.createPlayerSession("An", 0, options[0].hero.name, "first");
const second = engine.createPlayerSession("Binh", 1, options[1].hero.name, "second");
const elaraSupport = first.skillDeck.find((card) => card.effect === "support");
const elaraGame = engine.createInitialGame([first, second], engine.createAdventure("ELARA-DICE"), 30);
assert.equal(engine.getPassiveDiceBonus(first, elaraSupport, elaraGame.playerStates[first.id]), 0, "Elara's passive cannot modify d20 results");
const game = engine.createInitialGame([first, second], engine.createAdventure("RULES"), 30);
assert.equal(game.turnOrder[0], second.id, "the faster character acts first");
game.turnOrder = [first.id, second.id];
assert.equal(game.maxTurns, 30);
assert.equal(game.maxPhases, 30);
assert.equal(game.completedPhases, 0);
assert.equal(game.playerStates[first.id].hand.length + game.playerStates[first.id].drawPile.length + game.playerStates[first.id].discardPile.length + game.playerStates[first.id].graveyard.length, 10, "all cards begin in reusable zones with an empty graveyard");
assert.equal(engine.createInitialGame([first, second], engine.createAdventure("TIMER"), 5).turnSeconds, 60, "battle turns always last exactly 60 seconds");
assert(game.adventure.target >= 8 && game.adventure.target <= 16, "the initial target is randomly selected from the balanced target range");

const attack = first.skillDeck.find((card) => card.effect === "damage");
game.playerStates[first.id].hand = [attack.id];
const firstTarget = game.adventure.target;
const attacked = engine.resolveCardTurn(game, [first, second], attack.id, second.id, 20);
assert(attacked.adventure.target >= 8 && attacked.adventure.target <= 16, "each next target is generated independently of the raw d20");
assert.equal(attacked.history.length, 1);
assert.equal(attacked.history[0].diceRoll, 20);
assert.equal(attacked.history[0].diceTarget, firstTarget);
assert.equal(attacked.history[0].diceTotal, 20 + engine.getPassiveDiceBonus(first, attack, game.playerStates[first.id]));
assert.match(attacked.history[0].message, /An.*Binh|Binh.*HP/);

const exactTargetGame = engine.createInitialGame([first, second], engine.createAdventure("EXACT-TARGET"), 30);
exactTargetGame.turnOrder = [first.id, second.id];
exactTargetGame.adventure.target = 12;
exactTargetGame.playerStates[first.id].hand = [attack.id];
const exactTargetResult = engine.resolveCardTurn(exactTargetGame, [first, second], attack.id, second.id, 12);
assert.equal(exactTargetResult.outcome.success, true, "a d20 total exactly equal to the target must succeed");
assert.equal(exactTargetResult.outcome.total, exactTargetResult.outcome.target);

const healer = engine.createPlayerSession("Orren", 0, "Brother Orren", "healer");
const supportAlly = engine.createPlayerSession("Support ally", 2, "Elara Voss", "support-ally");
const supportEnemy = engine.createPlayerSession("Support enemy", 1, "Thorne Vale", "support-enemy");
const supportParty = [healer, supportEnemy, supportAlly];
const healGame = engine.createInitialGame(supportParty, engine.createAdventure("HEAL"), 30);
healGame.turnOrder = [healer.id, supportEnemy.id, supportAlly.id];
const healCard = healer.skillDeck.find((card) => card.effect === "heal");
healGame.playerStates[healer.id].hand = [healCard.id];
healGame.playerStates[supportAlly.id].hp = 1;
const allyHealed = engine.resolveCardTurn(healGame, supportParty, healCard.id, supportAlly.id, 20);
assert.equal(allyHealed.playerStates[supportAlly.id].hp, 7, "healer restores the chosen ally with its passive bonus up to max HP");
assert.equal(allyHealed.playerStates[healer.id].hp, healer.hero.maxHp, "ally heal does not redirect to the caster");

const tank = engine.createPlayerSession("Bram", 0, "Bram Coalhand", "tank");
const tankAlly = engine.createPlayerSession("Tank ally", 2, "Mira Ash", "tank-ally");
const tankEnemy = engine.createPlayerSession("Tank enemy", 1, "Nyx Calder", "tank-enemy");
const tankParty = [tank, tankEnemy, tankAlly];
const guardGame = engine.createInitialGame(tankParty, engine.createAdventure("GUARD"), 30);
guardGame.turnOrder = [tank.id, tankEnemy.id, tankAlly.id];
const guardCard = tank.skillDeck.find((card) => card.effect === "guard");
guardGame.playerStates[tank.id].hand = [guardCard.id];
const allyGuarded = engine.resolveCardTurn(guardGame, tankParty, guardCard.id, tankAlly.id, 20);
assert.equal(allyGuarded.playerStates[tankAlly.id].shield, 7, "tank passive strengthens shield placed on an ally");

const teamHealGame = engine.createInitialGame(supportParty, engine.createAdventure("TEAM-HEAL"), 30);
teamHealGame.turnOrder = [healer.id, supportEnemy.id, supportAlly.id];
const teamHealCard = healer.skillDeck.find((card) => card.supportType === "healing");
teamHealGame.playerStates[healer.id].hand = [teamHealCard.id];
teamHealGame.playerStates[healer.id].hp = 5;
teamHealGame.playerStates[supportAlly.id].hp = 2;
const teamHealed = engine.resolveCardTurn(teamHealGame, supportParty, teamHealCard.id, healer.id, 20);
assert.equal(teamHealed.playerStates[healer.id].hp, 7);
assert.equal(teamHealed.playerStates[supportAlly.id].hp, 4);
assert.equal(teamHealed.playerStates[supportEnemy.id].hp, supportEnemy.hero.maxHp);

const teamShieldGame = engine.createInitialGame(tankParty, engine.createAdventure("TEAM-SHIELD"), 30);
teamShieldGame.turnOrder = [tank.id, tankEnemy.id, tankAlly.id];
const teamShieldCard = tank.skillDeck.find((card) => card.supportType === "shield");
teamShieldGame.playerStates[tank.id].hand = [teamShieldCard.id];
const teamShielded = engine.resolveCardTurn(teamShieldGame, tankParty, teamShieldCard.id, tank.id, 20);
assert.equal(teamShielded.playerStates[tank.id].shield, 2);
assert.equal(teamShielded.playerStates[tankAlly.id].shield, 2);
assert.equal(teamShielded.playerStates[tankEnemy.id].shield, 0);

const commander = engine.createPlayerSession("Ione", 0, "Ione Mire", "commander");
const diceAlly = engine.createPlayerSession("Dice ally", 2, "Dagan Flint", "dice-ally");
const diceEnemy = engine.createPlayerSession("Dice enemy", 1, "Kael Rook", "dice-enemy");
const diceParty = [commander, diceEnemy, diceAlly];
const diceGame = engine.createInitialGame(diceParty, engine.createAdventure("DICE"), 30);
diceGame.turnOrder = [commander.id, diceEnemy.id, diceAlly.id];
const diceCard = commander.skillDeck.find((card) => card.supportType === "dice");
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
assert.equal(boostedRoll.playerStates[diceAlly.id].diceBuff, 0, "next-turn d20 bonus is consumed after one roll");
assert.equal(engine.getPassiveDiceBonus(commander, commander.skillDeck.find((card) => card.effect === "none"), diceBuffed.playerStates[commander.id]), 1, "Ione adds +1 to every d20 result");

const oracle = engine.createPlayerSession("Sable", 0, "Sable Fen", "oracle");
const cursedEnemy = engine.createPlayerSession("Cursed enemy", 1, "Thorne Vale", "cursed-enemy");
const oracleAlly = engine.createPlayerSession("Oracle ally", 2, "Dagan Flint", "oracle-ally");
const curseParty = [oracle, cursedEnemy, oracleAlly];
const curseGame = engine.createInitialGame(curseParty, engine.createAdventure("CURSE"), 30);
curseGame.turnOrder = [oracle.id, cursedEnemy.id, oracleAlly.id];
const curseCard = oracle.skillDeck.find((card) => card.supportType === "enemy-dice");
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
const stolenCommon = delayedEnemy.skillDeck.find((card) => !card.unique);
delayGame.playerStates[trickster.id].hand = [stealCard.id];
delayGame.playerStates[delayedEnemy.id].hand = [stolenCommon.id];
const stolen = engine.resolveCardTurn(delayGame, delayParty, stealCard.id, delayedEnemy.id, 20);
assert(stolen.playerStates[trickster.id].hand.includes(stolenCommon.id), "assassin temporarily receives one enemy common card");
assert(!stolen.playerStates[delayedEnemy.id].hand.includes(stolenCommon.id), "the stolen card leaves the enemy hand");
assert.equal(stolen.playerStates[trickster.id].borrowedCards[0].ownerId, delayedEnemy.id);
stolen.turnOrder = [trickster.id, delayedEnemy.id, tricksterAlly.id];
stolen.activePlayerIndex = 0;
const ownedAfterSteal = trickster.skillDeck.find((card) => stolen.playerStates[trickster.id].hand.includes(card.id));
const returned = engine.resolveCardTurn(stolen, delayParty, ownedAfterSteal.id, delayedEnemy.id, 20);
assert(!returned.playerStates[trickster.id].hand.includes(stolenCommon.id), "an unplayed stolen card returns after the borrower's next turn");
assert(returned.playerStates[delayedEnemy.id].discardPile.includes(stolenCommon.id), "returned stolen cards enter their owner's discard pile");

const revivalGame = engine.createInitialGame(supportParty, engine.createAdventure("REVIVE"), 30);
revivalGame.turnOrder = [healer.id, supportEnemy.id, supportAlly.id];
const reviveCard = healer.skillDeck.find((card) => card.supportType === "revive");
revivalGame.playerStates[supportAlly.id].hp = 0;
revivalGame.playerStates[healer.id].hand = [reviveCard.id];
const revivalPrepared = engine.resolveCardTurn(revivalGame, supportParty, reviveCard.id, supportAlly.id, 20);
assert.equal(revivalPrepared.playerStates[supportAlly.id].reviveIn, 2, "revival begins with a two-turn countdown");
assert(revivalPrepared.playerStates[healer.id].graveyard.includes(reviveCard.id), "Returning Light enters the graveyard after its first use");
assert(![...revivalPrepared.playerStates[healer.id].hand, ...revivalPrepared.playerStates[healer.id].drawPile, ...revivalPrepared.playerStates[healer.id].discardPile].includes(reviveCard.id), "graveyard cards cannot return to a reusable card zone");
const enemyAction = supportEnemy.skillDeck.find((card) => card.effect === "damage");
revivalPrepared.turnOrder = [supportEnemy.id, healer.id];
revivalPrepared.activePlayerIndex = 1;
revivalPrepared.playerStates[supportEnemy.id].hand = [enemyAction.id];
const revivalTicked = engine.resolveCardTurn(revivalPrepared, supportParty, enemyAction.id, healer.id, 20);
assert.equal(revivalTicked.playerStates[supportAlly.id].reviveIn, 1);
const healerCommon = healer.skillDeck.find((card) => !card.unique && card.effect === "none");
revivalTicked.turnOrder = [healer.id, supportEnemy.id];
revivalTicked.activePlayerIndex = 0;
revivalTicked.playerStates[healer.id].hand = [healerCommon.id];
const revived = engine.resolveCardTurn(revivalTicked, supportParty, healerCommon.id, healer.id, 20);
assert.equal(revived.playerStates[supportAlly.id].reviveIn, 0);
assert.equal(revived.playerStates[supportAlly.id].hp, Math.ceil(supportAlly.hero.maxHp / 3), "revived allies return with one-third max HP");

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
assert.equal(purgeCard.target, "ally", "Tactical Purge only exposes living allies as targets");
const removableBlank = commander.skillDeck.find((card) => !card.unique && card.effect === "none");
commanderPurge.playerStates[commander.id].hand = [purgeCard.id];
commanderPurge.playerStates[commander.id].drawPile = [removableBlank.id];
const purged = engine.resolveCardTurn(commanderPurge, [commander, diceEnemy], purgeCard.id, commander.id, 20);
assert(![...purged.playerStates[commander.id].hand, ...purged.playerStates[commander.id].drawPile, ...purged.playerStates[commander.id].discardPile].includes(removableBlank.id), "commander can permanently remove one no-effect common from an ally");
assert(purged.playerStates[commander.id].graveyard.includes(removableBlank.id), "removed cards move to their owner's graveyard");
assert(!purged.playerStates[commander.id].graveyard.includes(purgeCard.id), "Tactical Purge remains reusable after its first use");
purged.turnOrder = [commander.id, diceEnemy.id];
purged.activePlayerIndex = 0;
const secondPurge = engine.resolveCardTurn(purged, [commander, diceEnemy], purgeCard.id, commander.id, 20);
assert(!secondPurge.playerStates[commander.id].graveyard.includes(purgeCard.id), "Tactical Purge remains reusable after its second use");
secondPurge.turnOrder = [commander.id, diceEnemy.id];
secondPurge.activePlayerIndex = 0;
const thirdPurge = engine.resolveCardTurn(secondPurge, [commander, diceEnemy], purgeCard.id, commander.id, 20);
assert(thirdPurge.playerStates[commander.id].graveyard.includes(purgeCard.id), "Tactical Purge enters Ione's graveyard after its third use");
assert(![...thirdPurge.playerStates[commander.id].hand, ...thirdPurge.playerStates[commander.id].drawPile, ...thirdPurge.playerStates[commander.id].discardPile].includes(purgeCard.id), "Tactical Purge cannot be drawn after entering the graveyard");

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
assert.deepEqual(reshuffled.playerStates[first.id].hand, [heal.id], "the hand shrinks when draw is empty but an unplayed card remains");
assert.equal(reshuffled.playerStates[first.id].drawPile.length, 0, "discard does not refill draw before every reusable card is discarded");
assert.deepEqual(new Set(reshuffled.playerStates[first.id].discardPile), new Set([attack.id, emptyCard.id, guard.id]), "played cards wait together in discard until the hand is empty");
reshuffled.activePlayerIndex = 0;
reshuffled.turnOrder = [first.id, second.id];
const newCycle = engine.resolveCardTurn(reshuffled, [first, second], heal.id, first.id, 20);
assert.equal(newCycle.playerStates[first.id].hand.length, 4, "an empty hand and draw pile starts a new cycle with four random cards");
assert.deepEqual(new Set(newCycle.playerStates[first.id].hand), new Set([attack.id, emptyCard.id, guard.id, heal.id]), "the new hand is dealt only from the completed discard pile");
assert.equal(newCycle.playerStates[first.id].drawPile.length, 0, "all four available reusable cards were dealt");
assert.equal(newCycle.playerStates[first.id].discardPile.length, 0, "discard clears only at the full-cycle boundary");

const eventGame = engine.createInitialGame([first, second], engine.createAdventure("EVENT"), 30);
eventGame.turnOrder = [first.id, second.id];
eventGame.completedTurns = 8;
eventGame.completedPhases = 4;
eventGame.roundNumber = 5;
eventGame.actedThisRound = [second.id];
eventGame.playerStates[first.id].hand = [attack.id];
const eventTurn = engine.resolveCardTurn(eventGame, [first, second], attack.id, second.id, 20);
assert.equal(eventTurn.worldEvent?.turn, 5);
assert.equal(eventTurn.completedPhases, 5);
assert(eventTurn.history.some((entry) => entry.kind === "world"));
assert.match(eventTurn.history.find((entry) => entry.kind === "world").message, /World Event · Level 1/);
assert.match(eventTurn.worldEvent.description, /Both teams are affected/);
assert.match(eventTurn.worldEvent.description, /An/);
assert.match(eventTurn.worldEvent.description, /Binh/);

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

console.log("Game-rule test passed: random targets, penalty-free common cards, special-card penalties, support effects, turn order, event history, victory, and defeated-player lockout.");
