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

const options = engine.getCharacterOptions();
assert.equal(options.length, 10);
for (const option of options) {
  assert.equal(option.skillDeck.length, 8, `${option.hero.name} must have 8 cards`);
  assert.equal(option.skillDeck.filter((card) => card.unique).length, 3);
  assert.equal(option.skillDeck.filter((card) => !card.unique).length, 5);
  assert(option.skillDeck.every((card) => !("risk" in card) && card.effect !== "check"));
  const common = option.skillDeck.filter((card) => !card.unique);
  assert.equal(common.filter((card) => card.effect === "damage").length, 2, "common deck needs two attacks");
  assert.equal(common.filter((card) => card.effect === "guard" && card.target === "self").length, 2, "common deck needs two self guards");
  assert.equal(common.filter((card) => card.effect === "heal" && card.target === "self").length, 1, "common deck needs one self heal");
}
const supportTypes = new Set(options.flatMap((option) => option.skillDeck.filter((card) => card.effect === "support").map((card) => card.supportType)));
assert.deepEqual([...supportTypes].sort(), ["advance-ally", "attack", "delay-enemy", "dice", "dispel-enemy", "enemy-dice", "healing", "shield"]);

const first = engine.createPlayerSession("An", 0, options[0].hero.name, "first");
const second = engine.createPlayerSession("Binh", 1, options[1].hero.name, "second");
const game = engine.createInitialGame([first, second], engine.createAdventure("RULES"), 30);
assert.equal(game.maxTurns, 30);

const attack = first.skillDeck.find((card) => card.effect === "damage");
game.playerStates[first.id].hand = [attack.id];
const attacked = engine.resolveCardTurn(game, [first, second], attack.id, second.id, 20);
assert.equal(attacked.adventure.target, 20, "raw d20 becomes the next target");
assert.equal(attacked.history.length, 1);
assert.equal(attacked.history[0].diceRoll, 20);
assert.equal(attacked.history[0].diceTarget, 12);
assert.equal(attacked.history[0].diceTotal, 20 + attack.bonus);
assert.match(attacked.history[0].message, /An.*Binh|Binh.*HP/);

const healer = engine.createPlayerSession("Orren", 0, "Brother Orren", "healer");
const supportAlly = engine.createPlayerSession("Support ally", 2, "Elara Voss", "support-ally");
const supportEnemy = engine.createPlayerSession("Support enemy", 1, "Thorne Vale", "support-enemy");
const supportParty = [healer, supportEnemy, supportAlly];
const healGame = engine.createInitialGame(supportParty, engine.createAdventure("HEAL"), 30);
const healCard = healer.skillDeck.find((card) => card.effect === "heal");
healGame.playerStates[healer.id].hand = [healCard.id];
healGame.playerStates[supportAlly.id].hp = 1;
const allyHealed = engine.resolveCardTurn(healGame, supportParty, healCard.id, supportAlly.id, 20);
assert.equal(allyHealed.playerStates[supportAlly.id].hp, 8, "healer restores the chosen ally with its passive bonus");
assert.equal(allyHealed.playerStates[healer.id].hp, healer.hero.maxHp, "ally heal does not redirect to the caster");

const tank = engine.createPlayerSession("Bram", 0, "Bram Coalhand", "tank");
const tankAlly = engine.createPlayerSession("Tank ally", 2, "Mira Ash", "tank-ally");
const tankEnemy = engine.createPlayerSession("Tank enemy", 1, "Nyx Calder", "tank-enemy");
const tankParty = [tank, tankEnemy, tankAlly];
const guardGame = engine.createInitialGame(tankParty, engine.createAdventure("GUARD"), 30);
const guardCard = tank.skillDeck.find((card) => card.effect === "guard");
guardGame.playerStates[tank.id].hand = [guardCard.id];
const allyGuarded = engine.resolveCardTurn(guardGame, tankParty, guardCard.id, tankAlly.id, 20);
assert.equal(allyGuarded.playerStates[tankAlly.id].shield, 7, "tank passive strengthens shield placed on an ally");

const teamHealGame = engine.createInitialGame(supportParty, engine.createAdventure("TEAM-HEAL"), 30);
const teamHealCard = healer.skillDeck.find((card) => card.supportType === "healing");
teamHealGame.playerStates[healer.id].hand = [teamHealCard.id];
teamHealGame.playerStates[healer.id].hp = 5;
teamHealGame.playerStates[supportAlly.id].hp = 2;
const teamHealed = engine.resolveCardTurn(teamHealGame, supportParty, teamHealCard.id, healer.id, 20);
assert.equal(teamHealed.playerStates[healer.id].hp, 7);
assert.equal(teamHealed.playerStates[supportAlly.id].hp, 4);
assert.equal(teamHealed.playerStates[supportEnemy.id].hp, supportEnemy.hero.maxHp);

const teamShieldGame = engine.createInitialGame(tankParty, engine.createAdventure("TEAM-SHIELD"), 30);
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
const diceCard = commander.skillDeck.find((card) => card.supportType === "dice");
diceGame.playerStates[commander.id].hand = [diceCard.id];
const diceBuffed = engine.resolveCardTurn(diceGame, diceParty, diceCard.id, commander.id, 20);
assert.equal(diceBuffed.playerStates[commander.id].diceBuff, 3);
assert.equal(diceBuffed.playerStates[diceAlly.id].diceBuff, 3);
assert.equal(diceBuffed.playerStates[diceEnemy.id].diceBuff, 0);
const allyAttack = diceAlly.skillDeck.find((card) => card.effect === "damage");
diceBuffed.activePlayerIndex = 2;
diceBuffed.turnOrder = [diceAlly.id, commander.id, diceEnemy.id];
diceBuffed.adventure.target = 12;
diceBuffed.playerStates[diceAlly.id].hand = [allyAttack.id];
const boostedRoll = engine.resolveCardTurn(diceBuffed, diceParty, allyAttack.id, diceEnemy.id, 10);
assert.equal(boostedRoll.outcome.total, 10 + allyAttack.bonus + 3);
assert.equal(boostedRoll.playerStates[diceAlly.id].diceBuff, 0, "next-turn d20 bonus is consumed after one roll");

const oracle = engine.createPlayerSession("Sable", 0, "Sable Fen", "oracle");
const cursedEnemy = engine.createPlayerSession("Cursed enemy", 1, "Thorne Vale", "cursed-enemy");
const oracleAlly = engine.createPlayerSession("Oracle ally", 2, "Dagan Flint", "oracle-ally");
const curseParty = [oracle, cursedEnemy, oracleAlly];
const curseGame = engine.createInitialGame(curseParty, engine.createAdventure("CURSE"), 30);
const curseCard = oracle.skillDeck.find((card) => card.supportType === "enemy-dice");
curseGame.playerStates[oracle.id].hand = [curseCard.id];
const cursed = engine.resolveCardTurn(curseGame, curseParty, curseCard.id, cursedEnemy.id, 20);
assert.equal(cursed.playerStates[cursedEnemy.id].dicePenalty, 3);
const cursedAttack = cursedEnemy.skillDeck.find((card) => card.effect === "damage");
cursed.adventure.target = 10;
cursed.playerStates[cursedEnemy.id].hand = [cursedAttack.id];
const penalizedRoll = engine.resolveCardTurn(cursed, curseParty, cursedAttack.id, oracle.id, 10);
assert.equal(penalizedRoll.outcome.total, 10 + cursedAttack.bonus - 3);
assert.equal(penalizedRoll.history.at(-1).dicePenalty, 3);
assert.equal(penalizedRoll.playerStates[cursedEnemy.id].dicePenalty, 0, "enemy d20 penalty is consumed after one turn");

const commanderGame = engine.createInitialGame([first, second, supportAlly], engine.createAdventure("ADVANCE"), 30);
const advanceCard = first.skillDeck.find((card) => card.supportType === "advance-ally");
commanderGame.playerStates[first.id].hand = [advanceCard.id];
const advanced = engine.resolveCardTurn(commanderGame, [first, second, supportAlly], advanceCard.id, supportAlly.id, 20);
assert.equal(advanced.turnOrder[0], supportAlly.id, "chosen ally moves to the next turn");

const trickster = engine.createPlayerSession("Nyx", 0, "Nyx Calder", "trickster");
const delayedEnemy = engine.createPlayerSession("Delayed enemy", 1, "Thorne Vale", "delayed-enemy");
const tricksterAlly = engine.createPlayerSession("Nyx ally", 2, "Mira Ash", "trickster-ally");
const delayParty = [trickster, delayedEnemy, tricksterAlly];
const delayGame = engine.createInitialGame(delayParty, engine.createAdventure("DELAY"), 30);
const delayCard = trickster.skillDeck.find((card) => card.supportType === "delay-enemy");
delayGame.playerStates[trickster.id].hand = [delayCard.id];
const delayed = engine.resolveCardTurn(delayGame, delayParty, delayCard.id, delayedEnemy.id, 20);
assert.equal(delayed.turnOrder.at(-1), delayedEnemy.id, "chosen enemy moves to the end of the future queue");

const duelist = engine.createPlayerSession("Kael", 0, "Kael Rook", "duelist");
const failureEnemy = engine.createPlayerSession("Failure target", 1, "Thorne Vale", "failure-enemy");
const failureGame = engine.createInitialGame([duelist, failureEnemy], engine.createAdventure("FAILURE"), 30);
const riskyCard = duelist.skillDeck.find((card) => card.failureEffect === "self-damage" && card.failureValue >= 2);
failureGame.adventure.target = 20;
failureGame.playerStates[duelist.id].hand = [riskyCard.id];
const failedStrongCard = engine.resolveCardTurn(failureGame, [duelist, failureEnemy], riskyCard.id, failureEnemy.id, 1);
assert.equal(failedStrongCard.playerStates[duelist.id].hp, duelist.hero.maxHp - riskyCard.failureValue);
assert(failedStrongCard.outcome.failureDetail, "strong failed card explains its negative effect");

const eventGame = engine.createInitialGame([first, second], engine.createAdventure("EVENT"), 30);
eventGame.completedTurns = 4;
eventGame.playerStates[first.id].hand = [attack.id];
const eventTurn = engine.resolveCardTurn(eventGame, [first, second], attack.id, second.id, 20);
assert.equal(eventTurn.worldEvent?.turn, 5);
assert(eventTurn.history.some((entry) => entry.kind === "world"));

const finalGame = engine.createInitialGame([first, second], engine.createAdventure("FINAL"), 30);
finalGame.completedTurns = 29;
finalGame.playerStates[first.id].hp = 20;
finalGame.playerStates[first.id].maxHp = 20;
finalGame.playerStates[second.id].hp = 15;
finalGame.playerStates[second.id].maxHp = 30;
finalGame.playerStates[first.id].hand = [attack.id];
const finalTurn = engine.resolveCardTurn(finalGame, [first, second], attack.id, second.id, 20);
assert.equal(finalTurn.ended, true);
assert.equal(finalTurn.winnerTeam, "veil");
assert(finalTurn.playerStates[second.id].hp > 0, "turn-30 winner is decided by team HP while both teams still live");

const deadGame = engine.createInitialGame([first, second], engine.createAdventure("DEAD"), 30);
deadGame.playerStates[first.id].hp = 0;
deadGame.playerStates[first.id].hand = [attack.id];
assert.equal(engine.resolveCardTurn(deadGame, [first, second], attack.id, second.id, 20), deadGame, "defeated players cannot act");

console.log("Game-rule test passed: exact common decks, eight support effects, turn-order control, dice history, penalties, risky-card failures, events, victory, and defeated-player lockout.");
