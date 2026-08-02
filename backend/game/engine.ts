import { ACTION_CARDS, calculatePityCost, CHARACTER_SKILL_CARDS, EVENTS, HERO_TEMPLATES, REALMS, STORY_BEATS } from "./catalog";
import { calculateRuntimePityCost, isTestModeEnabled } from "@/shared/pityCost.mjs";
import { canPayLioraVennHealthCost, isLioraVennHealthExchangeCard, LIORA_VENN_HEALTH_COST, LIORA_VENN_NAME } from "@/shared/lioraVenn.mjs";
import type { ActionCard, Adventure, CharacterOption, GameHistoryEntry, Hero, PlayerLifeEvent, PlayerRunState, PlayerSession, SyncedGameState, TeamId, TimedEffectKind } from "@/shared/types";

export function randomIntInclusive(minimum: number, maximum: number) {
  const lower = Math.ceil(minimum);
  const upper = Math.floor(maximum);
  const span = upper - lower + 1;
  if (span <= 0 || span > 0x100000000) throw new RangeError("Invalid random integer range.");
  const randomValues = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / span) * span;
  do globalThis.crypto.getRandomValues(randomValues); while (randomValues[0] >= limit);
  return lower + (randomValues[0] % span);
}

const pick = <T,>(items: T[], index = randomIntInclusive(0, items.length - 1)) => items[Math.abs(index) % items.length];
const teamName = (team: TeamId) => team === "veil" ? "Veilbound" : "Embercourt";
const BULWARK_TO_BLADE_CARD_ID = "bc-march";
export const BATTLE_TURN_SECONDS = 60;

export function randomDiceTarget() {
  return randomIntInclusive(8, 16);
}

export function randomD20Roll() {
  return randomIntInclusive(1, 20);
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
  const commonCards = ACTION_CARDS.map(({ failureEffect: _failureEffect, failureValue: _failureValue, ...card }) => {
    const description = hero.classId === "assassin" && (card.effect === "damage" || card.effect === "aoe")
      ? `${card.description.replace(/\.$/, "")}, ignoring shield.`
      : hero.name === "Bram Coalhand" && card.effect === "guard"
        ? card.description.replace("your next turn", "your second turn")
        : card.description;
    return { ...card, description, bonus: 0, id: `${prefix}-common-${card.id}` };
  });
  const specialCards = uniqueCards.map((card) => {
    const failureEffect = card.failureEffect ?? (card.target === "all-allies" || card.target === "all-enemies" ? "team-damage" : "self-damage");
    const failureValue = card.failureValue ?? (card.value >= 5 ? 2 : 1);
    const completeCard = { ...card, bonus: 0, failureEffect, failureValue, unique: true };
    return { ...completeCard, pityCost: calculatePityCost(completeCard) } as ActionCard;
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
  return { sessionId: player.id, hp: player.hero.maxHp, maxHp: player.hero.maxHp, shield: 0, attackBuff: 0, diceBuff: 0, dicePenalty: 0, pityPoints: 0, reviveIn: 0, passiveReviveUsed: false, sanguineRecompense: false, skipTurns: 0, completedPlayerTurns: 0, zeroPityUntilTurn: 0, timedEffects: [], borrowedCards: [], purgedCards: [], cardUses: {}, hand: drawPile.splice(0, 4), drawPile, discardPile: [], graveyard: [] };
}

const timedField = (kind: TimedEffectKind) => kind;
const timedEffectKinds: TimedEffectKind[] = ["shield", "attackBuff", "diceBuff", "dicePenalty"];
const hasFavorableOmen = (state?: PlayerRunState) => Boolean(state && (state.zeroPityUntilTurn ?? 0) > (state.completedPlayerTurns ?? 0));

function normalizeTimedEffects(state: PlayerRunState) {
  const effects = [...(state.timedEffects ?? [])];
  for (const kind of timedEffectKinds) {
    const tracked = effects.filter((effect) => effect.kind === kind).reduce((sum, effect) => sum + effect.value, 0);
    const untracked = Math.max(0, (state[kind] ?? 0) - tracked);
    if (untracked > 0) effects.push({ kind, value: untracked, expiresAfterTurn: (state.completedPlayerTurns ?? 0) + 1 });
  }
  return effects;
}

function addTimedEffect(state: PlayerRunState, kind: TimedEffectKind, value: number, appliedDuringOwnTurn: boolean, durationTurns = 1) {
  if (value <= 0) return;
  const completedPlayerTurns = state.completedPlayerTurns ?? 0;
  state[kind] = (state[kind] ?? 0) + value;
  state.timedEffects = [...(state.timedEffects ?? []), {
    kind,
    value,
    expiresAfterTurn: completedPlayerTurns + Math.max(1, durationTurns) + (appliedDuringOwnTurn ? 1 : 0)
  }];
}

function clearTimedEffect(state: PlayerRunState, kind: TimedEffectKind) {
  state[kind] = 0;
  state.timedEffects = (state.timedEffects ?? []).filter((effect) => effect.kind !== kind);
}

function removeTimedEffectAmount(state: PlayerRunState, kind: TimedEffectKind, amount: number) {
  let remaining = Math.max(0, amount);
  state[kind] = Math.max(0, (state[kind] ?? 0) - remaining);
  state.timedEffects = (state.timedEffects ?? []).map((effect) => {
    if (effect.kind !== kind || remaining <= 0) return effect;
    const removed = Math.min(effect.value, remaining);
    remaining -= removed;
    return { ...effect, value: effect.value - removed };
  }).filter((effect) => effect.value > 0);
}

export function expireTimedEffectsAtTurnEnd(state: PlayerRunState) {
  const completedPlayerTurns = (state.completedPlayerTurns ?? 0) + 1;
  const keeping = [];
  for (const effect of normalizeTimedEffects(state)) {
    if (effect.expiresAfterTurn <= completedPlayerTurns) {
      const field = timedField(effect.kind);
      state[field] = Math.max(0, (state[field] ?? 0) - effect.value);
    } else keeping.push(effect);
  }
  state.completedPlayerTurns = completedPlayerTurns;
  if ((state.zeroPityUntilTurn ?? 0) <= completedPlayerTurns) state.zeroPityUntilTurn = 0;
  state.timedEffects = keeping;
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
  return { adventure: { ...adventure, maxChapters: 30, target: randomDiceTarget() }, activePlayerIndex: Math.max(0, players.findIndex((player) => player.id === turnOrder[0])), completedTurns: 0, completedPhases: 0, roll: null, outcome: null, playerStates, turnStartedAt: now, turnDeadline: now + BATTLE_TURN_SECONDS * 1000, turnSeconds: BATTLE_TURN_SECONDS, maxTurns: 30, maxPhases: 30, ended: false, endReason: null, winnerTeam: null, history: [], worldEvent: null, worldEventHistory: [], pendingWorldEvent: null, turnOrder, roundNumber: 1, roundOrder: turnOrder, actedThisRound: [] };
}

export function nextStory(adventure: Adventure): Adventure {
  const key = Math.floor(Math.random() * STORY_BEATS.length);
  return { ...adventure, story: STORY_BEATS[key], event: EVENTS[key % EVENTS.length] };
}

export function getPassiveDiceBonus(player: PlayerSession, card: ActionCard, state: PlayerRunState) {
  void card;
  void state;
  return player.hero.classId === "support" ? 1 : 0;
}

export function getThorneValePassiveDamageBonus(player: PlayerSession, card: ActionCard, state: PlayerRunState) {
  if (player.hero.name !== "Thorne Vale" || card.effect !== "damage") return 0;
  const currentPlayerTurn = (state.completedPlayerTurns ?? 0) + 1;
  return currentPlayerTurn % 2 === 0 ? 1 : 0;
}

export function getKaelRookPassiveDamageBonus(player: PlayerSession, card: ActionCard, state: PlayerRunState, targetState: PlayerRunState) {
  if (player.hero.name !== "Kael Rook" || !["damage", "aoe"].includes(card.effect) || state.shield > 0) return 0;
  return card.id === "kr-duel" && targetState.shield === 0 ? 2 : 1;
}

function drawOneOrRecycleDiscard(state: PlayerRunState, handIndex = state.hand.length): PlayerRunState {
  let drawPile = [...state.drawPile];
  let discardPile = [...state.discardPile];
  const hand = [...state.hand];
  if (drawPile.length === 0 && discardPile.length > 0) {
    drawPile = shuffle(discardPile);
    discardPile = [];
  }
  if (drawPile.length) {
    const replacementIndex = Math.floor(Math.random() * drawPile.length);
    const replacement = drawPile.splice(replacementIndex, 1)[0];
    hand.splice(Math.min(Math.max(0, handIndex), hand.length), 0, replacement);
  }
  return { ...state, drawPile, discardPile, hand };
}

function drawReplacement(state: PlayerRunState, playedCardId: string): PlayerRunState {
  const playedIndex = state.hand.indexOf(playedCardId);
  return drawOneOrRecycleDiscard({
    ...state,
    hand: state.hand.filter((cardId) => cardId !== playedCardId),
    discardPile: [...state.discardPile, playedCardId]
  }, playedIndex >= 0 ? playedIndex : state.hand.length);
}

function removeCardFromZones(state: PlayerRunState, cardId: string) {
  state.hand = state.hand.filter((id) => id !== cardId);
  state.drawPile = state.drawPile.filter((id) => id !== cardId);
  state.discardPile = state.discardPile.filter((id) => id !== cardId);
}

function moveCardToGraveyard(state: PlayerRunState, cardId: string) {
  const handIndex = state.hand.indexOf(cardId);
  removeCardFromZones(state, cardId);
  if (!state.graveyard.includes(cardId)) state.graveyard.push(cardId);
  if (handIndex >= 0) {
    const cycled = drawOneOrRecycleDiscard(state, handIndex);
    state.hand = cycled.hand;
    state.drawPile = cycled.drawPile;
    state.discardPile = cycled.discardPile;
  }
}

function temporarilyPurgeHandCard(state: PlayerRunState, cardId: string, returnAfterPhase: number) {
  if (!state.hand.includes(cardId)) return false;
  moveCardToGraveyard(state, cardId);
  state.purgedCards = [...(state.purgedCards ?? []).filter((entry) => entry.cardId !== cardId), { cardId, returnAfterPhase }];
  return true;
}

function drawWithoutDiscard(state: PlayerRunState, handIndex = state.hand.length) {
  return drawOneOrRecycleDiscard(state, handIndex);
}

function finishPlayedCard(states: Record<string, PlayerRunState>, actorId: string, cardId: string) {
  const actorState = states[actorId];
  const borrowed = (actorState.borrowedCards ?? []).find((entry) => entry.cardId === cardId);
  if (!borrowed) {
    const useCount = (actorState.cardUses[cardId] ?? 0) + 1;
    actorState.cardUses[cardId] = useCount;
    if (cardId === "bo-return" && useCount >= 1) {
      moveCardToGraveyard(actorState, cardId);
      states[actorId] = actorState;
      return;
    }
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

function returnExpiredBorrowedCards(states: Record<string, PlayerRunState>, completedBorrowerId: string) {
  const borrower = states[completedBorrowerId];
  if (!borrower) return;
  const returning = (borrower.borrowedCards ?? []).filter((entry) =>
    (entry.expiresAfterBorrowerTurn ?? borrower.completedPlayerTurns + 1) <= borrower.completedPlayerTurns
  );
  let removedFromHand = false;
  for (const entry of returning) {
    if (borrower.hand.includes(entry.cardId)) removedFromHand = true;
    removeCardFromZones(borrower, entry.cardId);
    const owner = states[entry.ownerId];
    if (owner && !owner.discardPile.includes(entry.cardId)) owner.discardPile.push(entry.cardId);
  }
  borrower.borrowedCards = (borrower.borrowedCards ?? []).filter((entry) => !returning.includes(entry));
  if (removedFromHand) states[completedBorrowerId] = drawWithoutDiscard(borrower);
}

function returnExpiredPurgedCards(states: Record<string, PlayerRunState>, completedPhases: number) {
  for (const state of Object.values(states)) {
    const returning = (state.purgedCards ?? []).filter((entry) => entry.returnAfterPhase <= completedPhases);
    for (const entry of returning) {
      removeCardFromZones(state, entry.cardId);
      state.graveyard = state.graveyard.filter((id) => id !== entry.cardId);
      if (!state.drawPile.includes(entry.cardId)) state.drawPile.push(entry.cardId);
    }
    state.purgedCards = (state.purgedCards ?? []).filter((entry) => !returning.includes(entry));
  }
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

export function resolveCardTurn(game: SyncedGameState, players: PlayerSession[], cardId: string, targetId: string | undefined, roll: number, usePity = false): SyncedGameState {
  let turnOrder = normalizeTurnOrder(game, players);
  const actor = players.find((player) => player.id === turnOrder[0]) ?? players[game.activePlayerIndex];
  const actorIndex = players.findIndex((player) => player.id === actor?.id);
  const actorState = actor && game.playerStates[actor.id];
  const card = players.flatMap((player) => player.skillDeck).find((item) => item.id === cardId);
  const pityCost = card ? calculateRuntimePityCost(card, hasFavorableOmen(actorState) || isTestModeEnabled(process.env.TEST_MODE)) : 0;
  const pityBefore = actorState?.pityPoints ?? 0;
  if (!actor || !actorState || actorState.hp <= 0 || !card || !actorState.hand.includes(card.id) || game.ended || game.pendingWorldEvent || (usePity && pityBefore < pityCost) || !canPayLioraVennHealthCost(card, actorState.hp)) return game;

  const states = Object.fromEntries(Object.entries(game.playerStates).map(([id, state]) => [id, {
    ...state,
    pityPoints: state.pityPoints ?? 0,
    reviveIn: state.reviveIn ?? 0,
    passiveReviveUsed: state.passiveReviveUsed ?? false,
    sanguineRecompense: state.sanguineRecompense ?? false,
    skipTurns: state.skipTurns ?? 0,
    completedPlayerTurns: state.completedPlayerTurns ?? 0,
    zeroPityUntilTurn: state.zeroPityUntilTurn ?? 0,
    timedEffects: normalizeTimedEffects(state),
    borrowedCards: (state.borrowedCards ?? []).map((entry) => Number.isFinite(entry.expiresAfterBorrowerTurn)
      ? { ...entry }
      : { ...entry, expiresAfterBorrowerTurn: (state.completedPlayerTurns ?? 0) + 1 }),
    purgedCards: [...(state.purgedCards ?? [])],
    cardUses: { ...(state.cardUses ?? {}) },
    hand: [...state.hand],
    drawPile: [...state.drawPile],
    discardPile: [...state.discardPile],
    graveyard: [...(state.graveyard ?? [])]
  }]));
  const turn = game.completedTurns + 1;
  const lifeEventStamp = Date.now();
  const hpBeforeAction = Object.fromEntries(players.map((player) => [player.id, states[player.id]?.hp ?? 0]));
  const lifeEvents: PlayerLifeEvent[] = [];
  const actionPhase = Math.min(30, (game.completedPhases ?? Math.max(0, (game.roundNumber ?? 1) - 1)) + 1);
  const revivingAtTurnStart = Object.keys(states).filter((id) => states[id].hp <= 0 && states[id].reviveIn > 0);
  const diceBuff = actorState.diceBuff ?? 0;
  const dicePenalty = actorState.dicePenalty ?? 0;
  const passiveDiceBonus = getPassiveDiceBonus(actor, card, actorState);
  const totalBonus = diceBuff + passiveDiceBonus;
  const total = roll + totalBonus - dicePenalty;
  const automaticSuccess = !usePity && pityCost === 0;
  const success = usePity || automaticSuccess || total >= game.adventure.target;
  const enemies = living(players, states).filter((player) => player.hero.team !== actor.hero.team);
  const allies = living(players, states, actor.hero.team);
  const defeatedAllies = players.filter((player) => player.hero.team === actor.hero.team && (states[player.id]?.hp ?? 0) <= 0);
  const selectedEnemy = enemies.find((player) => player.id === targetId);
  const selectableAllies = card.supportType === "advance-ally" ? allies.filter((player) => player.id !== actor.id) : allies;
  const selectedAlly = selectableAllies.find((player) => player.id === targetId);
  const selectedDefeatedAlly = defeatedAllies.find((player) => player.id === targetId);
  const selectedPlayer = living(players, states).find((player) => player.id === targetId);
  const targets = card.target === "all-enemies" ? enemies
    : card.target === "all-allies" ? allies
      : card.target === "self" ? [actor]
        : card.target === "ally" ? (selectedAlly ? [selectedAlly] : [])
          : card.target === "defeated-ally" ? (selectedDefeatedAlly ? [selectedDefeatedAlly] : [])
            : card.target === "player" ? (selectedPlayer ? [selectedPlayer] : [])
              : selectedEnemy ? [selectedEnemy] : [];
  const needsTarget = ["ally", "defeated-ally", "enemy", "player"].includes(card.target);
  if (!usePity) {
    clearTimedEffect(states[actor.id], "diceBuff");
    clearTimedEffect(states[actor.id], "dicePenalty");
  }
  states[actor.id].pityPoints = usePity ? pityBefore - pityCost : pityBefore + (success ? 0 : 1);
  let amount = 0;
  let defeated = false;
  let detail = `${actor.displayName} used ${card.name} but did not meet target ${game.adventure.target}.`;
  let revivedTargetId = "";

  if (success) {
    if (needsTarget && !targets.length) {
      detail = `${actor.displayName} succeeded with ${card.name}, but no valid target was available. The card had no effect.`;
    } else if (card.effect === "damage" || card.effect === "aoe") {
      const sacrificedShield = card.id === BULWARK_TO_BLADE_CARD_ID ? Math.max(0, states[actor.id].shield) : 0;
      if (card.id === BULWARK_TO_BLADE_CARD_ID) removeTimedEffectAmount(states[actor.id], "shield", sacrificedShield);
      const paidHealth = isLioraVennHealthExchangeCard(card) && targets.length ? LIORA_VENN_HEALTH_COST : 0;
      if (paidHealth) {
        states[actor.id].hp = Math.max(1, states[actor.id].hp - paidHealth);
        if (actor.hero.name === LIORA_VENN_NAME) states[actor.id].sanguineRecompense = true;
      }
      const resolvingActorState = states[actor.id];
      let passive = getThorneValePassiveDamageBonus(actor, card, resolvingActorState);
      if (actor.hero.classId === "mage" && card.effect === "aoe") passive += 1;
      if (actor.hero.classId === "berserker" && resolvingActorState.hp <= resolvingActorState.maxHp / 2) passive += 1;
      const ignoresShield = Boolean(card.ignoresShield || actor.hero.classId === "assassin");
      const reports: string[] = [];
      for (const target of targets) {
        const state = states[target.id];
        const kaelPassive = getKaelRookPassiveDamageBonus(actor, card, resolvingActorState, state);
        const basePower = card.id === BULWARK_TO_BLADE_CARD_ID ? sacrificedShield : card.value;
        const power = basePower + resolvingActorState.attackBuff + passive + kaelPassive;
        const blocked = ignoresShield ? 0 : Math.min(state.shield, power);
        removeTimedEffectAmount(state, "shield", blocked);
        const damage = power - blocked;
        state.hp = Math.max(0, state.hp - damage);
        amount += damage;
        if (state.hp === 0) defeated = true;
        reports.push(`${target.displayName} lost ${damage} HP${blocked ? ` (${blocked} blocked by shield)` : ""}${state.hp === 0 ? " and was defeated" : ""}`);
      }
      if (targets.length) clearTimedEffect(states[actor.id], "attackBuff");
      detail = reports.length
        ? `${paidHealth ? `${actor.displayName} paid ${paidHealth} HP. ` : ""}${card.id === BULWARK_TO_BLADE_CARD_ID ? `${actor.displayName} removed ${sacrificedShield} shield. ` : ""}${reports.join("; ")}.`
        : `${actor.displayName}'s attack had no valid target and no effect.`;
    } else if (card.effect === "heal") {
      const recompenseActive = actor.hero.name === LIORA_VENN_NAME && states[actor.id].sanguineRecompense;
      const power = card.value + (actor.hero.name === "Brother Orren" ? 1 : 0);
      const restoredByTarget = new Map<string, number>();
      for (const target of targets) {
        const before = states[target.id].hp;
        states[target.id].hp = Math.min(states[target.id].maxHp, states[target.id].hp + power);
        const restored = states[target.id].hp - before;
        amount += restored;
        restoredByTarget.set(target.id, restored);
      }
      if (targets.length && recompenseActive) {
        for (const ally of allies) {
          const before = states[ally.id].hp;
          states[ally.id].hp = Math.min(states[ally.id].maxHp, states[ally.id].hp + 1);
          const restored = states[ally.id].hp - before;
          amount += restored;
          restoredByTarget.set(ally.id, (restoredByTarget.get(ally.id) ?? 0) + restored);
        }
        states[actor.id].sanguineRecompense = false;
      }
      const reportTargets = targets.length && recompenseActive ? allies : targets;
      const reports = reportTargets.map((target) => `${target.displayName} +${restoredByTarget.get(target.id) ?? 0} HP`);
      detail = targets.length && recompenseActive
        ? `${actor.displayName} restored HP: ${reports.join(", ")}. Sanguine Recompense restored +1 HP to every living ally and was consumed.`
        : targets.length > 1
          ? `${actor.displayName} restored HP to every living ally: ${reports.join(", ")}.`
          : targets.length === 1
            ? `${actor.displayName} restored ${amount} HP to ${targets[0].displayName}.`
            : `${actor.displayName}'s Heal card had no valid target and no effect.`;
    } else if (card.effect === "guard") {
      amount = card.value + (actor.hero.name === "Elara Voss" ? 1 : 0);
      const durationTurns = actor.hero.name === "Bram Coalhand" ? 2 : 1;
      for (const target of targets) {
        addTimedEffect(states[target.id], "shield", amount, target.id === actor.id, durationTurns);
      }
      detail = targets.length > 1
        ? `${actor.displayName} granted ${amount} shield to every living ally.`
        : targets.length === 1
          ? `${actor.displayName} granted ${amount} shield to ${targets[0].displayName}.`
          : `${actor.displayName}'s Guard card had no valid target and no effect.`;
    } else if (card.effect === "support") {
      amount = card.value;
      const reports: string[] = [];
      const supportTargets = card.target === "all-allies" ? allies : targets;
      for (const target of supportTargets) {
        if (card.supportType === "attack") addTimedEffect(states[target.id], "attackBuff", amount, target.id === actor.id);
        if (card.supportType === "shield") addTimedEffect(states[target.id], "shield", amount, target.id === actor.id);
        if (card.supportType === "healing") {
          const before = states[target.id].hp;
          states[target.id].hp = Math.min(states[target.id].maxHp, states[target.id].hp + amount);
          reports.push(`${target.displayName} +${states[target.id].hp - before} HP`);
        }
        if (card.supportType === "dice") addTimedEffect(states[target.id], "diceBuff", amount, target.id === actor.id);
        if (card.supportType === "enemy-dice") addTimedEffect(states[target.id], "dicePenalty", amount, target.id === actor.id);
        if (card.supportType === "dispel-enemy") {
          const removedShield = Math.min(states[target.id].shield, amount);
          removeTimedEffectAmount(states[target.id], "shield", removedShield);
          clearTimedEffect(states[target.id], "attackBuff");
          clearTimedEffect(states[target.id], "diceBuff");
          reports.push(`${target.displayName} lost ${removedShield} shield and all attack and d20 buffs`);
        }
      }
      if (card.supportType === "advance-ally" && selectedAlly) turnOrder = moveTurnTarget(turnOrder, selectedAlly.id, "advance");
      if (card.supportType === "revive" && selectedDefeatedAlly) {
        const revivedState = states[selectedDefeatedAlly.id];
        revivedState.hp = Math.max(1, Math.ceil(revivedState.maxHp / 3));
        revivedState.reviveIn = 0;
        revivedTargetId = selectedDefeatedAlly.id;
        amount = revivedState.hp;
        reports.push(`${selectedDefeatedAlly.displayName} revived immediately with one-third HP (${revivedState.hp}/${revivedState.maxHp})`);
        lifeEvents.push({ id: `life-${turn}-${lifeEventStamp}-returning-light-${selectedDefeatedAlly.id}`, kind: "revive", playerId: selectedDefeatedAlly.id, playerName: selectedDefeatedAlly.displayName, reason: `${selectedDefeatedAlly.displayName} returned immediately through Immediate Resurrection with one-third HP.` });
      }
      if (card.supportType === "skip-enemy" && selectedEnemy) {
        states[selectedEnemy.id].skipTurns = (states[selectedEnemy.id].skipTurns ?? 0) + 1;
        reports.push(`${selectedEnemy.displayName}'s next turn will be skipped`);
      }
      if (card.supportType === "zero-pity" && selectedAlly) {
        const selectedState = states[selectedAlly.id];
        selectedState.zeroPityUntilTurn = Math.max(
          selectedState.zeroPityUntilTurn ?? 0,
          (selectedState.completedPlayerTurns ?? 0) + (selectedAlly.id === actor.id ? 2 : 1)
        );
        reports.push(`${selectedAlly.displayName}'s next played card during their next turn has 0 pity cost`);
      }
      if (card.supportType === "purge-card" && selectedEnemy) {
        const selectedState = states[selectedEnemy.id];
        const candidates = selectedState.hand.filter((id) => selectedEnemy.skillDeck.some((item) => item.id === id));
        const removedId = candidates.length ? pick(candidates) : "";
        const returnAfterPhase = (game.completedPhases ?? Math.max(0, (game.roundNumber ?? 1) - 1)) + 2;
        if (removedId) temporarilyPurgeHandCard(selectedState, removedId, returnAfterPhase);
        reports.push(`one random card from ${selectedEnemy.displayName}'s hand moved to their graveyard for 2 phases, then will return to their draw pile`);
      }
      if (card.supportType === "steal-card" && selectedEnemy) {
        const enemyState = states[selectedEnemy.id];
        const candidates = enemyState.hand.filter((id) => {
          const candidate = selectedEnemy.skillDeck.find((item) => item.id === id);
          return Boolean(candidate);
        });
        const specialCandidates = candidates.filter((id) => selectedEnemy.skillDeck.find((item) => item.id === id)?.unique);
        const preferredCandidates = specialCandidates.length ? specialCandidates : candidates;
        const stolenId = preferredCandidates.length ? pick(preferredCandidates) : "";
        if (stolenId) {
          enemyState.hand = enemyState.hand.filter((id) => id !== stolenId);
          states[actor.id].hand.push(stolenId);
          states[actor.id].borrowedCards.push({
            cardId: stolenId,
            ownerId: selectedEnemy.id,
            borrowedAtTurn: turn,
            expiresAfterBorrowerTurn: (states[actor.id].completedPlayerTurns ?? 0) + 2
          });
          reports.push(`${actor.displayName} stole one random ${specialCandidates.length ? "special " : ""}card from ${selectedEnemy.displayName}; it returns to their discard pile when ${actor.displayName}'s next turn ends`);
        }
      }
      if (card.supportType === "healing") detail = `${actor.displayName} healed the team: ${reports.join(", ")}.`;
      else if (card.supportType === "enemy-dice") detail = `${actor.displayName} gave ${selectedEnemy?.displayName} -${amount} to their next d20 result.`;
      else if (card.supportType === "delay-enemy") detail = `${actor.displayName} moved ${selectedEnemy?.displayName}'s turn to the end of the queue.`;
      else if (card.supportType === "advance-ally") detail = `${actor.displayName} moved ${selectedAlly?.displayName} to the next position in the turn queue.`;
      else if (card.supportType === "dispel-enemy") detail = `${actor.displayName} dispelled ${selectedEnemy?.displayName}: ${reports.join(", ")}.`;
      else if (["revive", "skip-enemy", "purge-card", "steal-card", "zero-pity"].includes(card.supportType ?? "")) detail = reports.length ? `${actor.displayName} used ${card.name}: ${reports.join(", ")}.` : `${actor.displayName} succeeded with ${card.name}, but no eligible card or character was available. The card had no effect.`;
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
      removeTimedEffectAmount(states[actor.id], "shield", lost);
      failureDetail = `${actor.displayName} lost ${lost} shield when their guard broke.`;
    } else if (card.failureEffect === "enemy-shield") {
      for (const enemy of enemies) addTimedEffect(states[enemy.id], "shield", penalty, false);
      failureDetail = `Every enemy gained ${penalty} shield until the end of their next turn because the action failed.`;
    }
    detail = `${detail} ${failureDetail}`;
  }

  const cardDefeatedPlayers = players.filter((player) => hpBeforeAction[player.id] > 0 && (states[player.id]?.hp ?? 0) <= 0);
  for (const player of cardDefeatedPlayers) {
    const reason = success
      ? `${player.displayName} was defeated by ${actor.displayName}'s ${card.name}.`
      : player.id === actor.id
        ? `${player.displayName} was defeated by failure backlash from ${card.name}.`
        : `${player.displayName} was defeated by team backlash from ${actor.displayName}'s ${card.name}.`;
    lifeEvents.push({ id: `life-${turn}-${lifeEventStamp}-card-defeat-${player.id}`, kind: "defeat", playerId: player.id, playerName: player.displayName, reason });
  }

  finishPlayedCard(states, actor.id, card.id);
  expireTimedEffectsAtTurnEnd(states[actor.id]);
  returnExpiredBorrowedCards(states, actor.id);
  const revivedIds = tickRevival(states, revivingAtTurnStart);
  if (revivedIds.length) {
    const revivedNames = revivedIds.map((id) => players.find((player) => player.id === id)?.displayName ?? "An ally");
    detail = `${detail} ${revivedNames.join(", ")} revived with one-third HP.`;
    for (const id of revivedIds) {
      const player = players.find((candidate) => candidate.id === id);
      if (player) lifeEvents.push({ id: `life-${turn}-${lifeEventStamp}-returning-light-${id}`, kind: "revive", playerId: id, playerName: player.displayName, reason: `${player.displayName} returned through Immediate Resurrection with one-third HP.` });
    }
  }
  let adventure = { ...game.adventure, target: randomDiceTarget() };
  if (success && (card.effect === "damage" || card.effect === "aoe")) adventure = { ...adventure, veilInfluence: adventure.veilInfluence + (actor.hero.team === "veil" ? amount : 0), emberInfluence: adventure.emberInfluence + (actor.hero.team === "ember" ? amount : 0) };
  const rollSummary = usePity
    ? `spent ${pityCost} pity (${pityBefore} to ${states[actor.id].pityPoints})`
    : automaticSuccess
      ? `d20 ${roll} ignored; zero-pity card always succeeds`
      : `rolled d20 against target ${game.adventure.target}`;
  const actionHistory: GameHistoryEntry = { id: `turn-${turn}-${Date.now()}`, turn, phase: actionPhase, kind: card.effect, actorName: actor.displayName, actorTeam: actor.hero.team, targetName: targets.map((target) => target.displayName).join(", "), cardName: card.name, message: `${actor.displayName} used ${card.name} (${rollSummary}) — ${detail}`, success, amount, diceRoll: usePity ? undefined : roll, diceTarget: usePity ? undefined : game.adventure.target, diceBonus: usePity ? undefined : totalBonus, dicePenalty: usePity ? undefined : dicePenalty, diceTotal: usePity ? undefined : total, resolution: usePity ? "pity" : "roll", pityCost: usePity || automaticSuccess ? pityCost : undefined, pityBefore, pityAfter: states[actor.id].pityPoints, failureDetail: failureDetail || undefined, createdAt: Date.now() };
  let history = [...(game.history ?? []), actionHistory];
  const passiveRevives = triggerSableRevives(players, states);
  if (passiveRevives.length) {
    const names = passiveRevives.map((player) => player.displayName);
    const reviveMessage = `${names.join(", ")} invoked Foreseen Return and revived with half HP.`;
    detail = `${detail} ${reviveMessage}`;
    actionHistory.message = `${actor.displayName} used ${card.name} (${rollSummary}) — ${detail}`;
    history.push({ id: `sable-revive-${turn}-${Date.now()}`, turn, phase: actionPhase, kind: "system", actorName: "Foreseen Return", message: reviveMessage, success: true, createdAt: Date.now() });
    for (const player of passiveRevives) lifeEvents.push({ id: `life-${turn}-${lifeEventStamp}-second-sight-${player.id}`, kind: "revive", playerId: player.id, playerName: player.displayName, reason: `${player.displayName} invoked Foreseen Return and revived with half HP.` });
  }
  let nextTurnOrder = rotateTurnOrder(turnOrder, actor.id, states);
  if (success && card.supportType === "delay-enemy" && selectedEnemy) nextTurnOrder = moveTurnTarget(nextTurnOrder, selectedEnemy.id, "delay");
  if (revivedTargetId && !nextTurnOrder.includes(revivedTargetId)) nextTurnOrder.push(revivedTargetId);
  let actedThisRound = [...new Set([...(game.actedThisRound ?? []), actor.id, ...(revivedTargetId ? [revivedTargetId] : [])])]
    .filter((id) => (states[id]?.hp ?? 0) > 0);
  let completedPhases = game.completedPhases ?? Math.max(0, (game.roundNumber ?? 1) - 1);
  let roundNumber = game.roundNumber ?? completedPhases + 1;
  let roundOrder = (game.roundOrder?.length ? game.roundOrder : speedOrder(players, states)).filter((id) => (states[id]?.hp ?? 0) > 0);
  if (revivedTargetId && !roundOrder.includes(revivedTargetId)) roundOrder.push(revivedTargetId);
  const livingIds = speedOrder(players, states);
  let phaseCompleted = false;
  if (livingIds.length && livingIds.every((id) => actedThisRound.includes(id))) {
    phaseCompleted = true;
    completedPhases += 1;
    roundNumber += 1;
    actedThisRound = [];
    roundOrder = livingIds;
    nextTurnOrder = livingIds;
  }
  if (phaseCompleted) returnExpiredPurgedCards(states, completedPhases);
  adventure = { ...adventure, chapter: Math.min(30, completedPhases + 1) };
  if (phaseCompleted) {
    const nextPhaseSpeedOrder = speedOrder(players, states);
    roundOrder = nextPhaseSpeedOrder;
    nextTurnOrder = nextPhaseSpeedOrder;
  }
  history = history.slice(-80);

  const finalPhase = completedPhases >= 30;
  const winnerTeam = decideWinner(players, states, adventure, actor.hero.team, finalPhase);
  const ended = winnerTeam !== null;
  const queuedNextIndex = players.findIndex((player) => player.id === nextTurnOrder[0]);
  const nextIndex = ended ? actorIndex : queuedNextIndex >= 0 ? queuedNextIndex : findNextLivingPlayerIndex(players, states, actorIndex);
  const now = Date.now();
  const veilTotal = totals(players, states, "veil").hp;
  const emberTotal = totals(players, states, "ember").hp;
  return { ...game, adventure, activePlayerIndex: nextIndex, completedTurns: turn, completedPhases, maxPhases: 30, roll: usePity ? null : roll, outcome: { id: actionHistory.id, kind: "card", success, total: usePity ? game.adventure.target : total, target: game.adventure.target, label: `${actor.displayName} used ${card.name}`, detail, actorId: actor.id, actorName: actor.displayName, cardId: card.id, cardName: card.name, effect: card.effect, supportType: card.supportType, targetIds: targets.map((target) => target.id), targetName: targets.map((target) => target.displayName).join(", "), roll: usePity ? undefined : roll, bonus: usePity ? undefined : totalBonus, diceBuff: usePity ? undefined : diceBuff, dicePenalty: usePity ? undefined : dicePenalty, resolution: usePity ? "pity" : "roll", pityCost: usePity || automaticSuccess ? pityCost : undefined, pityBefore, pityAfter: states[actor.id].pityPoints, amount, defeated, nextTarget: adventure.target, failureDetail, lifeEvents }, playerStates: states, history, worldEvent: game.worldEvent ?? null, worldEventHistory: game.worldEventHistory ?? [], pendingWorldEvent: game.pendingWorldEvent ?? null, turnStartedAt: now, turnDeadline: ended ? 0 : now + BATTLE_TURN_SECONDS * 1000, turnSeconds: BATTLE_TURN_SECONDS, ended, winnerTeam, endReason: winnerTeam ? `${teamName(winnerTeam)} wins. Total HP: Veilbound ${veilTotal} — Embercourt ${emberTotal}.` : null, turnOrder: nextTurnOrder, roundNumber, roundOrder, actedThisRound };
}

export function resolveAction(adventure: Adventure, cardId: string, roll: number, _advanceChapter = true, availableCards: ActionCard[] = ACTION_CARDS) {
  const card = availableCards.find((item) => item.id === cardId) ?? availableCards[0];
  const total = roll;
  return { success: total >= adventure.target, total, card, adventure: { ...adventure, target: randomDiceTarget() } };
}
