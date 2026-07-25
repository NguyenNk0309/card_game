import { ACTION_CARDS, CHARACTER_SKILL_CARDS, EVENTS, HERO_TEMPLATES, REALMS, STORY_BEATS } from "./catalog";
import type { ActionCard, Adventure, CharacterOption, GameHistoryEntry, Hero, PlayerRunState, PlayerSession, SyncedGameState, TeamId, WorldEventOutcome } from "@/shared/types";

const pick = <T,>(items: T[], index = Math.floor(Math.random() * items.length)) => items[Math.abs(index) % items.length];
const teamName = (team: TeamId) => team === "veil" ? "Veilbound" : "Embercourt";
export const BATTLE_TURN_SECONDS = 30;

export function randomDiceTarget() {
  return 8 + Math.floor(Math.random() * 9);
}

const randomAmount = (minimum: number, maximum: number) => minimum + Math.floor(Math.random() * (maximum - minimum + 1));

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
  if (deck.length !== 10) throw new Error(`${hero.name} must have a 10-card deck.`);
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
  return { sessionId: player.id, hp: player.hero.maxHp, maxHp: player.hero.maxHp, shield: 0, attackBuff: 0, diceBuff: 0, dicePenalty: 0, reviveIn: 0, passiveReviveUsed: false, skipTurns: 0, borrowedCards: [], hand: drawPile.splice(0, 4), drawPile, discardPile: [] };
}

function speedOrder(players: PlayerSession[], states?: Record<string, PlayerRunState>) {
  return [...players]
    .filter((player) => !states || (states[player.id]?.hp ?? 0) > 0)
    .sort((left, right) => right.hero.speed - left.hero.speed || left.joinedAt - right.joinedAt)
    .map((player) => player.id);
}

export function createInitialGame(players: PlayerSession[], adventure = createAdventure(), _turnSeconds = BATTLE_TURN_SECONDS): SyncedGameState {
  const now = Date.now();
  const playerStates = Object.fromEntries(players.map((player) => [player.id, createRunState(player)]));
  const turnOrder = speedOrder(players, playerStates);
  return { adventure: { ...adventure, maxChapters: 30, target: randomDiceTarget() }, activePlayerIndex: Math.max(0, players.findIndex((player) => player.id === turnOrder[0])), completedTurns: 0, roll: null, outcome: null, playerStates, turnStartedAt: now, turnDeadline: now + BATTLE_TURN_SECONDS * 1000, turnSeconds: BATTLE_TURN_SECONDS, maxTurns: 30, ended: false, endReason: null, winnerTeam: null, history: [], worldEvent: null, turnOrder, roundNumber: 1, roundOrder: turnOrder, actedThisRound: [] };
}

export function nextStory(adventure: Adventure): Adventure {
  const key = Math.floor(Math.random() * STORY_BEATS.length);
  return { ...adventure, story: STORY_BEATS[key], event: EVENTS[key % EVENTS.length] };
}

export function getPassiveDiceBonus(player: PlayerSession, card: ActionCard, state: PlayerRunState) {
  const classId = player.hero.classId;
  if (classId === "ranger" && card.effect === "damage") return 1;
  if (classId === "mage" && card.effect === "aoe") return 1;
  if (classId === "healer" && card.effect === "heal") return 1;
  if (classId === "assassin" && card.effect === "damage") return 1;
  if (classId === "tank" && card.effect === "guard") return 1;
  if (classId === "support") return 1;
  if (classId === "duelist" && card.effect === "damage" && state.shield === 0) return 1;
  if (classId === "berserker" && (card.effect === "damage" || card.effect === "aoe") && state.hp <= state.maxHp / 2) return 1;
  return 0;
}

function drawReplacement(state: PlayerRunState, playedCardId: string): PlayerRunState {
  let drawPile = [...state.drawPile];
  let discardPile = [...state.discardPile, playedCardId];
  const playedIndex = state.hand.indexOf(playedCardId);
  const hand = state.hand.filter((cardId) => cardId !== playedCardId);
  if (!drawPile.length) { drawPile = shuffle(discardPile); discardPile = []; }
  const replacementIndex = drawPile.length ? Math.floor(Math.random() * drawPile.length) : -1;
  const replacement = replacementIndex >= 0 ? drawPile.splice(replacementIndex, 1)[0] : undefined;
  if (replacement) hand.splice(playedIndex >= 0 ? Math.min(playedIndex, hand.length) : hand.length, 0, replacement);
  return { ...state, drawPile, discardPile, hand };
}

function removeCardFromZones(state: PlayerRunState, cardId: string) {
  state.hand = state.hand.filter((id) => id !== cardId);
  state.drawPile = state.drawPile.filter((id) => id !== cardId);
  state.discardPile = state.discardPile.filter((id) => id !== cardId);
}

function drawWithoutDiscard(state: PlayerRunState, handIndex = state.hand.length) {
  let drawPile = [...state.drawPile];
  let discardPile = [...state.discardPile];
  if (!drawPile.length && discardPile.length) {
    drawPile = shuffle(discardPile);
    discardPile = [];
  }
  const replacementIndex = drawPile.length ? Math.floor(Math.random() * drawPile.length) : -1;
  const replacement = replacementIndex >= 0 ? drawPile.splice(replacementIndex, 1)[0] : undefined;
  const hand = [...state.hand];
  if (replacement) hand.splice(Math.min(Math.max(0, handIndex), hand.length), 0, replacement);
  return { ...state, drawPile, discardPile, hand };
}

function finishPlayedCard(states: Record<string, PlayerRunState>, actorId: string, cardId: string) {
  const actorState = states[actorId];
  const borrowed = (actorState.borrowedCards ?? []).find((entry) => entry.cardId === cardId);
  if (!borrowed) {
    states[actorId] = drawReplacement(actorState, cardId);
    return;
  }
  const playedIndex = actorState.hand.indexOf(cardId);
  removeCardFromZones(actorState, cardId);
  actorState.borrowedCards = actorState.borrowedCards.filter((entry) => entry.cardId !== cardId);
  const owner = states[borrowed.ownerId];
  if (owner && !owner.discardPile.includes(cardId)) owner.discardPile.push(cardId);
  states[actorId] = drawWithoutDiscard(actorState, playedIndex);
}

function returnExpiredBorrowedCards(states: Record<string, PlayerRunState>, actorId: string, completedTurn: number) {
  const actorState = states[actorId];
  const returning = (actorState.borrowedCards ?? []).filter((entry) => entry.borrowedAtTurn < completedTurn);
  for (const entry of returning) {
    removeCardFromZones(actorState, entry.cardId);
    const owner = states[entry.ownerId];
    if (owner && !owner.discardPile.includes(entry.cardId)) owner.discardPile.push(entry.cardId);
  }
  actorState.borrowedCards = (actorState.borrowedCards ?? []).filter((entry) => entry.borrowedAtTurn >= completedTurn);
}

function tickRevival(states: Record<string, PlayerRunState>, waitingAtTurnStart: string[]) {
  const reports: string[] = [];
  for (const id of waitingAtTurnStart) {
    const state = states[id];
    if (!state || state.hp > 0 || state.reviveIn <= 0) continue;
    state.reviveIn -= 1;
    if (state.reviveIn === 0) {
      state.hp = Math.max(1, Math.ceil(state.maxHp / 3));
      reports.push(id);
    }
  }
  return reports;
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

function triggerSableRevives(players: PlayerSession[], states: Record<string, PlayerRunState>) {
  return players.filter((player) => {
    const state = states[player.id];
    if (player.hero.name !== "Sable Fen" || !state || state.hp > 0 || state.passiveReviveUsed) return false;
    state.hp = Math.max(1, Math.ceil(state.maxHp / 2));
    state.passiveReviveUsed = true;
    state.reviveIn = 0;
    return true;
  });
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
  const title = pick(["Chaos Convergence", "Fractured Fate", "Crimson World Pulse", "Unstable Arena Surge"]);
  const reports: string[] = [];
  for (const player of living(players, states)) {
    const kind = Math.floor(Math.random() * 5);
    if (kind === 0) {
      const damage = randomAmount(1, level + 1);
      states[player.id].hp = Math.max(0, states[player.id].hp - damage);
      reports.push(`${player.displayName} -${damage} HP`);
    } else if (kind === 1) {
      const healing = randomAmount(1, level + 1);
      const before = states[player.id].hp;
      states[player.id].hp = Math.min(states[player.id].maxHp, states[player.id].hp + healing);
      reports.push(`${player.displayName} +${states[player.id].hp - before} HP`);
    } else if (kind === 2) {
      const lost = Math.min(states[player.id].shield, randomAmount(1, level * 2));
      states[player.id].shield -= lost;
      reports.push(`${player.displayName} -${lost} shield`);
    } else if (kind === 3) {
      const bonus = randomAmount(1, level);
      states[player.id].attackBuff += bonus;
      reports.push(`${player.displayName} +${bonus} next-attack damage`);
    } else {
      const amount = randomAmount(1, level + 1);
      if (Math.random() < 0.5) {
        const damage = amount;
        states[player.id].hp = Math.max(0, states[player.id].hp - damage);
        reports.push(`${player.displayName} -${damage} HP`);
      } else {
        const before = states[player.id].hp;
        states[player.id].hp = Math.min(states[player.id].maxHp, states[player.id].hp + amount);
        reports.push(`${player.displayName} +${states[player.id].hp - before} HP`);
      }
    }
  }
  const description = `Both teams are affected with a separate random result for every living player: ${reports.join("; ")}.`;
  const event = { id: `world-${turn}-${Date.now()}`, turn, level, title, description };
  return { event, history: { id: `${event.id}-history`, turn, kind: "world", actorName: "World Event", message: `World Event · Level ${level} — ${title}: ${description}`, success: true, createdAt: Date.now() } };
}

export function resolveCardTurn(game: SyncedGameState, players: PlayerSession[], cardId: string, targetId: string | undefined, roll: number): SyncedGameState {
  let turnOrder = normalizeTurnOrder(game, players);
  const actor = players.find((player) => player.id === turnOrder[0]) ?? players[game.activePlayerIndex];
  const actorIndex = players.findIndex((player) => player.id === actor?.id);
  const actorState = actor && game.playerStates[actor.id];
  const card = players.flatMap((player) => player.skillDeck).find((item) => item.id === cardId);
  if (!actor || !actorState || actorState.hp <= 0 || !card || !actorState.hand.includes(card.id) || game.ended) return game;

  const states = Object.fromEntries(Object.entries(game.playerStates).map(([id, state]) => [id, {
    ...state,
    reviveIn: state.reviveIn ?? 0,
    passiveReviveUsed: state.passiveReviveUsed ?? false,
    skipTurns: state.skipTurns ?? 0,
    borrowedCards: [...(state.borrowedCards ?? [])],
    hand: [...state.hand],
    drawPile: [...state.drawPile],
    discardPile: [...state.discardPile]
  }]));
  const turn = game.completedTurns + 1;
  const revivingAtTurnStart = Object.keys(states).filter((id) => states[id].hp <= 0 && states[id].reviveIn > 0);
  const diceBuff = actorState.diceBuff ?? 0;
  const dicePenalty = actorState.dicePenalty ?? 0;
  const passiveDiceBonus = getPassiveDiceBonus(actor, card, actorState);
  const totalBonus = diceBuff + passiveDiceBonus;
  const total = roll + totalBonus - dicePenalty;
  const success = total >= game.adventure.target;
  const enemies = living(players, states).filter((player) => player.hero.team !== actor.hero.team);
  const allies = living(players, states, actor.hero.team);
  const defeatedAllies = players.filter((player) => player.hero.team === actor.hero.team && (states[player.id]?.hp ?? 0) <= 0);
  const selectedEnemy = enemies.find((player) => player.id === targetId);
  const selectableAllies = card.supportType === "advance-ally" ? allies.filter((player) => player.id !== actor.id) : allies;
  const selectedAlly = selectableAllies.find((player) => player.id === targetId);
  const selectedDefeatedAlly = defeatedAllies.find((player) => player.id === targetId);
  const selectedPlayer = players.find((player) => player.id === targetId);
  const targets = card.target === "all-enemies" ? enemies
    : card.target === "all-allies" ? allies
      : card.target === "self" ? [actor]
        : card.target === "ally" ? (selectedAlly ? [selectedAlly] : [])
          : card.target === "defeated-ally" ? (selectedDefeatedAlly ? [selectedDefeatedAlly] : [])
            : card.target === "player" ? (selectedPlayer ? [selectedPlayer] : [])
              : selectedEnemy ? [selectedEnemy] : [];
  const needsTarget = ["ally", "defeated-ally", "enemy", "player"].includes(card.target);
  states[actor.id].diceBuff = 0;
  states[actor.id].dicePenalty = 0;
  let amount = 0;
  let defeated = false;
  let detail = `${actor.displayName} used ${card.name} but did not meet target ${game.adventure.target}.`;

  if (success) {
    if (needsTarget && !targets.length) {
      detail = `${actor.displayName} succeeded with ${card.name}, but no valid target was available. The card had no effect.`;
    } else if (card.effect === "damage" || card.effect === "aoe") {
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
      if (targets.length) states[actor.id].attackBuff = 0;
      detail = reports.length ? `${reports.join("; ")}.` : `${actor.displayName}'s attack had no valid target and no effect.`;
    } else if (card.effect === "heal") {
      const target = targets[0];
      if (target) {
        const power = card.value + (actor.hero.classId === "healer" ? 2 : 0);
        const before = states[target.id].hp;
        states[target.id].hp = Math.min(states[target.id].maxHp, states[target.id].hp + power);
        amount = states[target.id].hp - before;
        detail = `${actor.displayName} restored ${amount} HP to ${target.displayName}.`;
      }
    } else if (card.effect === "guard") {
      const target = targets[0];
      if (target) {
        amount = card.value + (actor.hero.classId === "tank" ? 2 : 0);
        states[target.id].shield += amount;
        detail = `${actor.displayName} granted ${amount} shield to ${target.displayName}.`;
      }
    } else if (card.effect === "support") {
      const scalable = ["attack", "shield", "healing", "dice", "enemy-dice"].includes(card.supportType ?? "");
      amount = card.value + (scalable && actor.hero.classId === "warden" ? 1 : 0);
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
      if (card.supportType === "advance-ally" && selectedAlly) turnOrder = moveTurnTarget(turnOrder, selectedAlly.id, "advance");
      if (card.supportType === "revive" && selectedDefeatedAlly) {
        states[selectedDefeatedAlly.id].reviveIn = Math.max(1, card.value);
        reports.push(`${selectedDefeatedAlly.displayName} will revive in ${card.value} completed turns`);
      }
      if (card.supportType === "skip-enemy" && selectedEnemy) {
        states[selectedEnemy.id].skipTurns = (states[selectedEnemy.id].skipTurns ?? 0) + 1;
        reports.push(`${selectedEnemy.displayName}'s next turn will be skipped`);
      }
      if (card.supportType === "purge-card" && selectedPlayer) {
        const selectedState = states[selectedPlayer.id];
        const zoneIds = [...selectedState.hand, ...selectedState.drawPile, ...selectedState.discardPile];
        const removingBeneficially = selectedPlayer.hero.team === actor.hero.team;
        const candidates = zoneIds.filter((id) => {
          const candidate = selectedPlayer.skillDeck.find((item) => item.id === id);
          return Boolean(candidate && !candidate.unique && (removingBeneficially ? candidate.effect === "none" : candidate.effect !== "none"));
        });
        const removedId = candidates.length ? pick(candidates) : "";
        if (removedId) {
          removeCardFromZones(selectedState, removedId);
          const removedCard = selectedPlayer.skillDeck.find((item) => item.id === removedId);
          reports.push(`${removedCard?.name ?? "one common card"} was removed from ${selectedPlayer.displayName}'s deck for this battle`);
        }
      }
      if (card.supportType === "steal-card" && selectedEnemy) {
        const enemyState = states[selectedEnemy.id];
        const candidates = enemyState.hand.filter((id) => {
          const candidate = selectedEnemy.skillDeck.find((item) => item.id === id);
          return Boolean(candidate && !candidate.unique);
        });
        const stolenId = candidates.length ? pick(candidates) : "";
        if (stolenId) {
          enemyState.hand = enemyState.hand.filter((id) => id !== stolenId);
          states[actor.id].hand.push(stolenId);
          states[actor.id].borrowedCards.push({ cardId: stolenId, ownerId: selectedEnemy.id, borrowedAtTurn: turn });
          reports.push(`${actor.displayName} borrowed one hidden common card from ${selectedEnemy.displayName}`);
        }
      }
      if (card.supportType === "healing") detail = `${actor.displayName} healed the team: ${reports.join(", ")}.`;
      else if (card.supportType === "enemy-dice") detail = `${actor.displayName} gave ${selectedEnemy?.displayName} -${amount} to their next d20 result.`;
      else if (card.supportType === "delay-enemy") detail = `${actor.displayName} moved ${selectedEnemy?.displayName}'s turn to the end of the queue.`;
      else if (card.supportType === "advance-ally") detail = `${actor.displayName} moved ${selectedAlly?.displayName} to the next position in the turn queue.`;
      else if (card.supportType === "dispel-enemy") detail = `${actor.displayName} dispelled ${selectedEnemy?.displayName}: ${reports.join(", ")}.`;
      else if (["revive", "skip-enemy", "purge-card", "steal-card"].includes(card.supportType ?? "")) detail = reports.length ? `${actor.displayName} used ${card.name}: ${reports.join(", ")}.` : `${actor.displayName} succeeded with ${card.name}, but no eligible card or character was available. The card had no effect.`;
      else if (card.target === "all-allies") detail = `${actor.displayName} granted +${amount} ${card.supportType === "attack" ? "next-attack damage" : card.supportType === "shield" ? "shield" : "to the next d20 result"} to every living ally.`;
      else detail = `${actor.displayName} granted ${targets[0]?.displayName ?? "the target"} +${amount} ${card.supportType === "attack" ? "next-attack damage" : card.supportType === "shield" ? "shield" : "to the next d20 result"}.`;
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

  finishPlayedCard(states, actor.id, card.id);
  returnExpiredBorrowedCards(states, actor.id, turn);
  const revivedIds = tickRevival(states, revivingAtTurnStart);
  if (revivedIds.length) {
    const revivedNames = revivedIds.map((id) => players.find((player) => player.id === id)?.displayName ?? "An ally");
    detail = `${detail} ${revivedNames.join(", ")} revived with one-third HP.`;
  }
  let adventure = { ...game.adventure, chapter: Math.min(30, turn + 1), target: randomDiceTarget() };
  if (success && (card.effect === "damage" || card.effect === "aoe")) adventure = { ...adventure, veilInfluence: adventure.veilInfluence + (actor.hero.team === "veil" ? amount : 0), emberInfluence: adventure.emberInfluence + (actor.hero.team === "ember" ? amount : 0) };
  const rollSummary = `d20 ${roll} + bonus ${totalBonus}${dicePenalty ? ` - penalty ${dicePenalty}` : ""} = ${total}; target ${game.adventure.target}`;
  const actionHistory: GameHistoryEntry = { id: `turn-${turn}-${Date.now()}`, turn, kind: card.effect, actorName: actor.displayName, actorTeam: actor.hero.team, targetName: targets.map((target) => target.displayName).join(", "), cardName: card.name, message: `${actor.displayName} used ${card.name} (${rollSummary}) — ${detail}`, success, amount, diceRoll: roll, diceTarget: game.adventure.target, diceBonus: totalBonus, dicePenalty, diceTotal: total, createdAt: Date.now() };
  let history = [...(game.history ?? []), actionHistory];
  let worldEvent: WorldEventOutcome | null = null;
  if (turn % 5 === 0) { const result = applyWorldEvent(turn, players, states); worldEvent = result.event; history.push(result.history); }
  const passiveRevives = triggerSableRevives(players, states);
  if (passiveRevives.length) {
    const names = passiveRevives.map((player) => player.displayName);
    const reviveMessage = `${names.join(", ")} invoked Second Sight and revived with half HP.`;
    detail = `${detail} ${reviveMessage}`;
    actionHistory.message = `${actor.displayName} used ${card.name} (${rollSummary}) — ${detail}`;
    history.push({ id: `sable-revive-${turn}-${Date.now()}`, turn, kind: "system", actorName: "Second Sight", message: reviveMessage, success: true, createdAt: Date.now() });
  }
  history = history.slice(-80);

  const finalTurn = turn >= 30;
  const winnerTeam = decideWinner(players, states, adventure, actor.hero.team, finalTurn);
  const ended = winnerTeam !== null;
  let nextTurnOrder = rotateTurnOrder(turnOrder, actor.id, states);
  if (success && card.supportType === "delay-enemy" && selectedEnemy) nextTurnOrder = moveTurnTarget(nextTurnOrder, selectedEnemy.id, "delay");
  let actedThisRound = [...new Set([...(game.actedThisRound ?? []), actor.id])].filter((id) => (states[id]?.hp ?? 0) > 0);
  let roundNumber = game.roundNumber ?? 1;
  let roundOrder = (game.roundOrder?.length ? game.roundOrder : speedOrder(players, states)).filter((id) => (states[id]?.hp ?? 0) > 0);
  const livingIds = speedOrder(players, states);
  if (livingIds.length && livingIds.every((id) => actedThisRound.includes(id))) {
    roundNumber += 1;
    actedThisRound = [];
    roundOrder = livingIds;
    nextTurnOrder = livingIds;
  }
  const queuedNextIndex = players.findIndex((player) => player.id === nextTurnOrder[0]);
  const nextIndex = ended ? actorIndex : queuedNextIndex >= 0 ? queuedNextIndex : findNextLivingPlayerIndex(players, states, actorIndex);
  const now = Date.now();
  const veilTotal = totals(players, states, "veil").hp;
  const emberTotal = totals(players, states, "ember").hp;
  return { ...game, adventure, activePlayerIndex: nextIndex, completedTurns: turn, roll, outcome: { kind: "card", success, total, target: game.adventure.target, label: `${actor.displayName} used ${card.name}`, detail, actorName: actor.displayName, cardName: card.name, cardType: card.type, effect: card.effect, supportType: card.supportType, targetIds: targets.map((target) => target.id), targetName: targets.map((target) => target.displayName).join(", "), roll, bonus: totalBonus, diceBuff, dicePenalty, amount, defeated, nextTarget: adventure.target, failureDetail }, playerStates: states, history, worldEvent, turnStartedAt: now, turnDeadline: ended ? 0 : now + BATTLE_TURN_SECONDS * 1000, turnSeconds: BATTLE_TURN_SECONDS, ended, winnerTeam, endReason: winnerTeam ? `${teamName(winnerTeam)} wins. Total HP: Veilbound ${veilTotal} — Embercourt ${emberTotal}.` : null, turnOrder: nextTurnOrder, roundNumber, roundOrder, actedThisRound };
}

export function resolveAction(adventure: Adventure, cardId: string, roll: number, _advanceChapter = true, availableCards: ActionCard[] = ACTION_CARDS) {
  const card = availableCards.find((item) => item.id === cardId) ?? availableCards[0];
  const total = roll;
  return { success: total >= adventure.target, total, card, adventure: { ...adventure, target: randomDiceTarget() } };
}
