import { ACTION_CARDS, CHARACTER_SKILL_CARDS, EVENTS, HERO_TEMPLATES, REALMS, STORY_BEATS } from "./catalog";
import type { ActionCard, Adventure, CharacterOption, GameHistoryEntry, Hero, PlayerRunState, PlayerSession, SyncedGameState, TeamId, WorldEventOutcome } from "@/shared/types";

const pick = <T,>(items: T[], index = Math.floor(Math.random() * items.length)) => items[Math.abs(index) % items.length];
const teamName = (team: TeamId) => team === "veil" ? "Veilbound" : "Embercourt";

export function randomDiceTarget() {
  return 8 + Math.floor(Math.random() * 9);
}

export function createSeed() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function createAdventure(seed = createSeed()): Adventure {
  return { seed, realm: REALMS[0], chapter: 1, maxChapters: 30, story: STORY_BEATS[0], event: EVENTS[0], target: randomDiceTarget(), worldDoom: 0, veilInfluence: 0, emberInfluence: 0 };
}

export function createParty(size = 6): Hero[] {
  return HERO_TEMPLATES.slice(0, Math.min(10, Math.max(2, size))).map((hero, index) => ({ ...hero, id: `hero-${index + 1}`, team: (index % 2 === 0 ? "veil" : "ember") as TeamId, isYou: index === 0 }));
}

const shuffle = <T,>(items: T[]) => {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
};

export function createSkillDeck(hero: Omit<Hero, "id" | "team" | "isYou">): ActionCard[] {
  const uniqueCards = CHARACTER_SKILL_CARDS[hero.name];
  if (!uniqueCards || uniqueCards.length !== 3) throw new Error(`${hero.name} must have exactly 3 special cards.`);
  const prefix = hero.initials.toLowerCase();
  const commonCards = ACTION_CARDS.map(({ failureEffect: _failureEffect, failureValue: _failureValue, ...card }) => ({ ...card, bonus: 0, id: `${prefix}-common-${card.id}` }));
  const specialCards = uniqueCards.map((card) => {
    const failureEffect = card.failureEffect ?? (card.target === "all-allies" || card.target === "all-enemies" ? "team-damage" : "self-damage");
    const failureValue = card.failureValue ?? (card.value >= 5 ? 2 : 1);
    return { ...card, bonus: 0, failureEffect, failureValue, unique: true } as ActionCard;
  });
  const deck = [...specialCards, ...commonCards];
  if (deck.length !== 13) throw new Error(`${hero.name} must have a 13-card deck.`);
  return deck;
}

export function getCharacterOptions(): CharacterOption[] {
  return HERO_TEMPLATES.map((template, index) => ({ hero: { ...template, id: `preview-${index}`, team: "veil" }, skillDeck: createSkillDeck(template) }));
}

export function createPlayerSession(displayName: string, seatIndex: number, heroName: string, sessionId?: string): PlayerSession {
  const heroIndex = Math.max(0, HERO_TEMPLATES.findIndex((hero) => hero.name === heroName));
  const template = HERO_TEMPLATES[heroIndex];
  const id = sessionId ?? `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return { id, displayName, ready: false, joinedAt: Date.now(), hero: { ...template, id: `hero-${id}`, team: (seatIndex % 2 === 0 ? "veil" : "ember") as TeamId }, skillDeck: createSkillDeck(template) };
}

function createRunState(player: PlayerSession): PlayerRunState {
  const drawPile = shuffle(player.skillDeck.map((card) => card.id));
  return { sessionId: player.id, hp: player.hero.maxHp, maxHp: player.hero.maxHp, shield: 0, attackBuff: 0, diceBuff: 0, dicePenalty: 0, hand: drawPile.splice(0, 4), drawPile, discardPile: [] };
}

export function createInitialGame(players: PlayerSession[], adventure = createAdventure(), turnSeconds = 30): SyncedGameState {
  const now = Date.now();
  return { adventure: { ...adventure, maxChapters: 30, target: randomDiceTarget() }, activePlayerIndex: 0, completedTurns: 0, roll: null, outcome: null, playerStates: Object.fromEntries(players.map((player) => [player.id, createRunState(player)])), turnStartedAt: now, turnDeadline: now + turnSeconds * 1000, turnSeconds, maxTurns: 30, ended: false, endReason: null, winnerTeam: null, history: [], worldEvent: null, turnOrder: players.map((player) => player.id) };
}

export function nextStory(adventure: Adventure): Adventure {
  const key = Math.floor(Math.random() * STORY_BEATS.length);
  return { ...adventure, story: STORY_BEATS[key], event: EVENTS[key % EVENTS.length] };
}

export function getPassiveDiceBonus(player: PlayerSession, card: ActionCard, state: PlayerRunState) {
  const classId = player.hero.classId;
  if (classId === "warden" && card.effect === "support") return 1;
  if (classId === "ranger" && card.effect === "damage") return 1;
  if (classId === "mage" && card.effect === "aoe") return 1;
  if (classId === "healer" && card.effect === "heal") return 1;
  if (classId === "assassin" && card.effect === "damage") return 1;
  if (classId === "tank" && card.effect === "guard") return 1;
  if (classId === "oracle" && card.effect === "support") return 1;
  if (classId === "duelist" && card.effect === "damage" && state.shield === 0) return 1;
  if (classId === "support" && card.effect === "support") return 1;
  if (classId === "berserker" && (card.effect === "damage" || card.effect === "aoe") && state.hp <= state.maxHp / 2) return 1;
  return 0;
}

function drawReplacement(state: PlayerRunState, playedCardId: string): PlayerRunState {
  let drawPile = [...state.drawPile];
  let discardPile = [...state.discardPile, playedCardId];
  const hand = state.hand.filter((cardId) => cardId !== playedCardId);
  if (!drawPile.length) { drawPile = shuffle(discardPile); discardPile = []; }
  const replacement = drawPile.shift();
  return { ...state, drawPile, discardPile, hand: replacement ? [...hand, replacement] : hand };
}

export function findNextLivingPlayerIndex(players: PlayerSession[], states: Record<string, PlayerRunState>, currentIndex: number) {
  for (let offset = 1; offset <= players.length; offset += 1) {
    const candidate = (currentIndex + offset) % players.length;
    if ((states[players[candidate]?.id]?.hp ?? 0) > 0) return candidate;
  }
  return currentIndex;
}

export function normalizeTurnOrder(game: SyncedGameState, players: PlayerSession[], states = game.playerStates) {
  const currentId = players[game.activePlayerIndex]?.id;
  const fallback = currentId ? [...players.slice(game.activePlayerIndex), ...players.slice(0, game.activePlayerIndex)].map((player) => player.id) : players.map((player) => player.id);
  const source = game.turnOrder?.length ? game.turnOrder : fallback;
  const validIds = new Set(players.map((player) => player.id));
  const order = source.filter((id, index) => validIds.has(id) && source.indexOf(id) === index);
  for (const player of players) if (!order.includes(player.id)) order.push(player.id);
  return order.filter((id) => (states[id]?.hp ?? 0) > 0);
}

function moveTurnTarget(order: string[], targetId: string, mode: "advance" | "delay") {
  const index = order.indexOf(targetId);
  if (index < 0 || (mode === "advance" && index === 0)) return order;
  const next = order.filter((id) => id !== targetId);
  if (mode === "advance") next.splice(1, 0, targetId);
  else next.push(targetId);
  return next;
}

function rotateTurnOrder(order: string[], actorId: string, states: Record<string, PlayerRunState>) {
  const livingOrder = order.filter((id) => (states[id]?.hp ?? 0) > 0 && id !== actorId);
  if ((states[actorId]?.hp ?? 0) > 0) livingOrder.push(actorId);
  return livingOrder;
}

function living(players: PlayerSession[], states: Record<string, PlayerRunState>, team?: TeamId) {
  return players.filter((player) => (!team || player.hero.team === team) && (states[player.id]?.hp ?? 0) > 0);
}

function totals(players: PlayerSession[], states: Record<string, PlayerRunState>, team: TeamId) {
  const members = players.filter((player) => player.hero.team === team);
  return { hp: members.reduce((sum, player) => sum + (states[player.id]?.hp ?? 0), 0), alive: members.filter((player) => (states[player.id]?.hp ?? 0) > 0).length, shield: members.reduce((sum, player) => sum + (states[player.id]?.shield ?? 0), 0) };
}

function decideWinner(players: PlayerSession[], states: Record<string, PlayerRunState>, adventure: Adventure, lastTeam: TeamId, finalTurn: boolean): TeamId | null {
  const veil = totals(players, states, "veil");
  const ember = totals(players, states, "ember");
  if (veil.alive === 0 && ember.alive > 0) return "ember";
  if (ember.alive === 0 && veil.alive > 0) return "veil";
  if (veil.alive === 0 && ember.alive === 0) {
    if (adventure.veilInfluence !== adventure.emberInfluence) return adventure.veilInfluence > adventure.emberInfluence ? "veil" : "ember";
    return lastTeam;
  }
  if (!finalTurn) return null;
  if (veil.hp !== ember.hp) return veil.hp > ember.hp ? "veil" : "ember";
  if (veil.alive !== ember.alive) return veil.alive > ember.alive ? "veil" : "ember";
  if (veil.shield !== ember.shield) return veil.shield > ember.shield ? "veil" : "ember";
  if (adventure.veilInfluence !== adventure.emberInfluence) return adventure.veilInfluence > adventure.emberInfluence ? "veil" : "ember";
  return lastTeam;
}

function applyWorldEvent(turn: number, players: PlayerSession[], states: Record<string, PlayerRunState>): { event: WorldEventOutcome; history: GameHistoryEntry } {
  const level = Math.ceil(turn / 5);
  const team = (Math.random() < 0.5 ? "veil" : "ember") as TeamId;
  const kind = Math.floor(Math.random() * 5);
  let title = "Battlefield Quake";
  let description = "";
  if (kind === 0) {
    for (const player of living(players, states)) {
      const reduction = player.hero.classId === "oracle" || living(players, states, player.hero.team).some((ally) => ally.hero.classId === "oracle") ? 1 : 0;
      states[player.id].hp = Math.max(0, states[player.id].hp - Math.max(0, level - reduction));
    }
    description = `Every living player takes ${level} damage; a team with an Oracle reduces this by 1.`;
  } else if (kind === 1) {
    title = "Emergency Supplies";
    for (const player of living(players, states, team)) states[player.id].hp = Math.min(states[player.id].maxHp, states[player.id].hp + level);
    description = `${teamName(team)} restores ${level} HP to every living member.`;
  } else if (kind === 2) {
    title = "Armor-Shattering Wave";
    for (const state of Object.values(states)) state.shield = Math.max(0, state.shield - level * 2);
    description = `Every player loses up to ${level * 2} shield.`;
  } else if (kind === 3) {
    title = "Furious Momentum";
    for (const player of living(players, states, team)) states[player.id].attackBuff += level;
    description = `${teamName(team)} gains +${level} damage on each member's next attack.`;
  } else {
    title = "Unclaimed Arrow Storm";
    for (const player of living(players, states, team)) {
      const reduction = living(players, states, team).some((ally) => ally.hero.classId === "oracle") ? 1 : 0;
      states[player.id].hp = Math.max(0, states[player.id].hp - Math.max(0, level + 1 - reduction));
    }
    description = `${teamName(team)} takes ${level + 1} surprise damage; an Oracle reduces this by 1.`;
  }
  const event = { id: `world-${turn}-${Date.now()}`, turn, level, title, description, affectedTeam: kind === 0 || kind === 2 ? undefined : team };
  return { event, history: { id: `${event.id}-history`, turn, kind: "world", actorName: "World Event", message: `World Event · Level ${level} — ${title}: ${description}`, success: true, createdAt: Date.now() } };
}

export function resolveCardTurn(game: SyncedGameState, players: PlayerSession[], cardId: string, targetId: string | undefined, roll: number): SyncedGameState {
  let turnOrder = normalizeTurnOrder(game, players);
  const actor = players.find((player) => player.id === turnOrder[0]) ?? players[game.activePlayerIndex];
  const actorIndex = players.findIndex((player) => player.id === actor?.id);
  const actorState = actor && game.playerStates[actor.id];
  const card = actor?.skillDeck.find((item) => item.id === cardId);
  if (!actor || !actorState || actorState.hp <= 0 || !card || !actorState.hand.includes(card.id) || game.ended) return game;

  const states = Object.fromEntries(Object.entries(game.playerStates).map(([id, state]) => [id, { ...state, hand: [...state.hand], drawPile: [...state.drawPile], discardPile: [...state.discardPile] }]));
  const diceBuff = actorState.diceBuff ?? 0;
  const dicePenalty = actorState.dicePenalty ?? 0;
  const passiveDiceBonus = getPassiveDiceBonus(actor, card, actorState);
  const totalBonus = diceBuff + passiveDiceBonus;
  const total = roll + totalBonus - dicePenalty;
  const success = total >= game.adventure.target;
  const enemies = living(players, states).filter((player) => player.hero.team !== actor.hero.team);
  const allies = living(players, states, actor.hero.team);
  const selectedEnemy = enemies.find((player) => player.id === targetId) ?? enemies[0];
  const selectableAllies = card.supportType === "advance-ally" ? allies.filter((player) => player.id !== actor.id) : allies;
  const selectedAlly = selectableAllies.find((player) => player.id === targetId) ?? selectableAllies[0] ?? actor;
  const targets = card.target === "all-enemies" ? enemies : card.target === "all-allies" ? allies : card.target === "self" ? [actor] : card.target === "ally" ? [selectedAlly] : selectedEnemy ? [selectedEnemy] : [];
  states[actor.id].diceBuff = 0;
  states[actor.id].dicePenalty = 0;
  let amount = 0;
  let defeated = false;
  let detail = `${actor.displayName} used ${card.name} but did not meet target ${game.adventure.target}.`;

  if (success) {
    if (card.effect === "damage" || card.effect === "aoe") {
      let passive = 0;
      if (actor.hero.classId === "ranger" && card.effect === "damage") passive += 1;
      if (actor.hero.classId === "mage" && card.effect === "aoe") passive += 1;
      if (actor.hero.classId === "duelist" && actorState.shield === 0) passive += 1;
      if (actor.hero.classId === "berserker" && actorState.hp <= actorState.maxHp / 2) passive += 1;
      const power = card.value + actorState.attackBuff + passive;
      const ignoresShield = Boolean(card.ignoresShield || actor.hero.classId === "assassin");
      const reports: string[] = [];
      for (const target of targets) {
        const state = states[target.id];
        const blocked = ignoresShield ? 0 : Math.min(state.shield, power);
        state.shield -= blocked;
        const damage = power - blocked;
        state.hp = Math.max(0, state.hp - damage);
        amount += damage;
        if (state.hp === 0) defeated = true;
        reports.push(`${target.displayName} lost ${damage} HP${blocked ? ` (${blocked} blocked by shield)` : ""}${state.hp === 0 ? " and was defeated" : ""}`);
      }
      states[actor.id].attackBuff = 0;
      detail = reports.join("; ") + ".";
    } else if (card.effect === "heal") {
      const target = targets[0] ?? actor;
      const power = card.value + (actor.hero.classId === "healer" ? 2 : 0);
      const before = states[target.id].hp;
      states[target.id].hp = Math.min(states[target.id].maxHp, states[target.id].hp + power);
      amount = states[target.id].hp - before;
      detail = `${actor.displayName} restored ${amount} HP to ${target.displayName}.`;
    } else if (card.effect === "guard") {
      const target = targets[0] ?? actor;
      amount = card.value + (actor.hero.classId === "tank" ? 2 : 0);
      states[target.id].shield += amount;
      detail = `${actor.displayName} granted ${amount} shield to ${target.displayName}.`;
    } else if (card.effect === "support") {
      amount = card.value + (["support", "warden"].includes(actor.hero.classId) ? 1 : 0);
      const reports: string[] = [];
      const supportTargets = card.target === "all-allies" ? allies : targets;
      for (const target of supportTargets) {
        if (card.supportType === "attack") states[target.id].attackBuff += amount;
        if (card.supportType === "shield") states[target.id].shield += amount;
        if (card.supportType === "healing") {
          const before = states[target.id].hp;
          states[target.id].hp = Math.min(states[target.id].maxHp, states[target.id].hp + amount);
          reports.push(`${target.displayName} +${states[target.id].hp - before} HP`);
        }
        if (card.supportType === "dice") states[target.id].diceBuff = (states[target.id].diceBuff ?? 0) + amount;
        if (card.supportType === "enemy-dice") states[target.id].dicePenalty = (states[target.id].dicePenalty ?? 0) + amount;
        if (card.supportType === "dispel-enemy") {
          const removedShield = Math.min(states[target.id].shield, amount);
          states[target.id].shield -= removedShield;
          states[target.id].attackBuff = 0;
          states[target.id].diceBuff = 0;
          reports.push(`${target.displayName} lost ${removedShield} shield and all attack and d20 buffs`);
        }
      }
      if (card.supportType === "advance-ally") turnOrder = moveTurnTarget(turnOrder, selectedAlly.id, "advance");
      if (card.supportType === "healing") detail = `${actor.displayName} healed the team: ${reports.join(", ")}.`;
      else if (card.supportType === "enemy-dice") detail = `${actor.displayName} gave ${selectedEnemy?.displayName} -${amount} to their next d20 result.`;
      else if (card.supportType === "delay-enemy") detail = `${actor.displayName} moved ${selectedEnemy?.displayName}'s turn to the end of the queue.`;
      else if (card.supportType === "advance-ally") detail = `${actor.displayName} moved ${selectedAlly.displayName} to the next position in the turn queue.`;
      else if (card.supportType === "dispel-enemy") detail = `${actor.displayName} dispelled ${selectedEnemy?.displayName}: ${reports.join(", ")}.`;
      else detail = `${actor.displayName} granted +${amount} ${card.supportType === "attack" ? "next-attack damage" : card.supportType === "shield" ? "shield" : "to the next d20 result"} to every living ally.`;
    } else if (card.effect === "none") {
      detail = `${actor.displayName} played ${card.name}. The card had no effect.`;
    }
  }

  let failureDetail = "";
  if (!success && card.failureEffect && (card.failureValue ?? 0) > 0) {
    const penalty = card.failureValue ?? 0;
    if (card.failureEffect === "self-damage") {
      states[actor.id].hp = Math.max(0, states[actor.id].hp - penalty);
      failureDetail = `${actor.displayName} took ${penalty} backlash damage.`;
    } else if (card.failureEffect === "team-damage") {
      for (const ally of allies) states[ally.id].hp = Math.max(0, states[ally.id].hp - penalty);
      failureDetail = `The entire ${teamName(actor.hero.team)} team took ${penalty} backlash damage.`;
    } else if (card.failureEffect === "lose-shield") {
      const lost = Math.min(states[actor.id].shield, penalty);
      states[actor.id].shield -= lost;
      failureDetail = `${actor.displayName} lost ${lost} shield when their guard broke.`;
    } else if (card.failureEffect === "enemy-shield") {
      for (const enemy of enemies) states[enemy.id].shield += penalty;
      failureDetail = `Every enemy gained ${penalty} shield because the action failed.`;
    }
    detail = `${detail} ${failureDetail}`;
  }

  states[actor.id] = drawReplacement(states[actor.id], card.id);
  const turn = game.completedTurns + 1;
  let adventure = { ...game.adventure, chapter: Math.min(30, turn + 1), target: randomDiceTarget() };
  if (success && (card.effect === "damage" || card.effect === "aoe")) adventure = { ...adventure, veilInfluence: adventure.veilInfluence + (actor.hero.team === "veil" ? amount : 0), emberInfluence: adventure.emberInfluence + (actor.hero.team === "ember" ? amount : 0) };
  const rollSummary = `d20 ${roll} + bonus ${totalBonus}${dicePenalty ? ` - penalty ${dicePenalty}` : ""} = ${total}; target ${game.adventure.target}`;
  const actionHistory: GameHistoryEntry = { id: `turn-${turn}-${Date.now()}`, turn, kind: card.effect, actorName: actor.displayName, actorTeam: actor.hero.team, targetName: targets.map((target) => target.displayName).join(", "), cardName: card.name, message: `${actor.displayName} used ${card.name} (${rollSummary}) — ${detail}`, success, amount, diceRoll: roll, diceTarget: game.adventure.target, diceBonus: totalBonus, dicePenalty, diceTotal: total, createdAt: Date.now() };
  let history = [...(game.history ?? []), actionHistory];
  let worldEvent: WorldEventOutcome | null = null;
  if (turn % 5 === 0) { const result = applyWorldEvent(turn, players, states); worldEvent = result.event; history.push(result.history); }
  history = history.slice(-80);

  const finalTurn = turn >= 30;
  const winnerTeam = decideWinner(players, states, adventure, actor.hero.team, finalTurn);
  const ended = winnerTeam !== null;
  let nextTurnOrder = rotateTurnOrder(turnOrder, actor.id, states);
  if (success && card.supportType === "delay-enemy" && selectedEnemy) nextTurnOrder = moveTurnTarget(nextTurnOrder, selectedEnemy.id, "delay");
  const queuedNextIndex = players.findIndex((player) => player.id === nextTurnOrder[0]);
  const nextIndex = ended ? actorIndex : queuedNextIndex >= 0 ? queuedNextIndex : findNextLivingPlayerIndex(players, states, actorIndex);
  const now = Date.now();
  const veilTotal = totals(players, states, "veil").hp;
  const emberTotal = totals(players, states, "ember").hp;
  return { ...game, adventure, activePlayerIndex: nextIndex, completedTurns: turn, roll, outcome: { kind: "card", success, total, target: game.adventure.target, label: `${actor.displayName} used ${card.name}`, detail, actorName: actor.displayName, cardName: card.name, cardType: card.type, effect: card.effect, targetName: targets.map((target) => target.displayName).join(", "), roll, bonus: totalBonus, diceBuff, dicePenalty, amount, defeated, nextTarget: adventure.target, failureDetail }, playerStates: states, history, worldEvent, turnStartedAt: now, turnDeadline: ended ? 0 : now + game.turnSeconds * 1000, ended, winnerTeam, endReason: winnerTeam ? `${teamName(winnerTeam)} wins. Total HP: Veilbound ${veilTotal} — Embercourt ${emberTotal}.` : null, turnOrder: nextTurnOrder };
}

export function resolveAction(adventure: Adventure, cardId: string, roll: number, _advanceChapter = true, availableCards: ActionCard[] = ACTION_CARDS) {
  const card = availableCards.find((item) => item.id === cardId) ?? availableCards[0];
  const total = roll;
  return { success: total >= adventure.target, total, card, adventure: { ...adventure, target: randomDiceTarget() } };
}
