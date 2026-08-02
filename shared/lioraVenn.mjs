export const LIORA_VENN_NAME = 'Liora Venn';
export const LIORA_VENN_HEALTH_COST = 3;
export const LIORA_VENN_MINIMUM_HP = 4;

export const LIORA_VENN_SPECIAL_CARDS = Object.freeze([
  Object.freeze({
    id: 'lv-verdict',
    name: 'Crimson Verdict',
    description: 'Requires at least 4 HP. On success, lose 3 HP, then deal 4 damage to one living enemy.',
    bonus: 0,
    effect: 'damage',
    target: 'enemy',
    value: 4,
    failureEffect: 'self-damage',
    failureValue: 2,
    pityCost: 6
  }),
  Object.freeze({
    id: 'lv-remedy',
    name: 'Bloodbound Remedy',
    description: 'All living allies, including yourself, restore 4 HP (5 with Sanguine Recompense); cannot revive.',
    bonus: 0,
    effect: 'heal',
    target: 'all-allies',
    value: 4,
    failureEffect: 'self-damage',
    failureValue: 2,
    pityCost: 7
  }),
  Object.freeze({
    id: 'lv-communion',
    name: 'Red Communion',
    description: 'Requires at least 4 HP. On success, lose 3 HP, then deal 3 damage to every living enemy.',
    bonus: 0,
    effect: 'aoe',
    target: 'all-enemies',
    value: 3,
    failureEffect: 'team-damage',
    failureValue: 1,
    pityCost: 7
  })
]);

const HEALTH_EXCHANGE_CARD_IDS = new Set(['lv-verdict', 'lv-communion']);

export function templateCardId(cardId) {
  const id = String(cardId || '');
  const separator = id.lastIndexOf('::');
  return separator >= 0 ? id.slice(separator + 2) : id;
}

export function isLioraVennHealthExchangeCard(card) {
  return HEALTH_EXCHANGE_CARD_IDS.has(templateCardId(card?.id));
}

export function canPayLioraVennHealthCost(card, hp) {
  return !isLioraVennHealthExchangeCard(card) || Number(hp) >= LIORA_VENN_MINIMUM_HP;
}

export function normalizeLioraVennCards(players) {
  const definitions = new Map(LIORA_VENN_SPECIAL_CARDS.map((card) => [card.id, card]));
  let changed = false;
  for (const player of players || []) {
    player.skillDeck = (player.skillDeck || []).map((card) => {
      const definition = definitions.get(templateCardId(card.id));
      if (!definition) return card;
      const normalized = { ...card, ...definition, id: card.id, unique: true };
      if (JSON.stringify(card) !== JSON.stringify(normalized)) changed = true;
      return normalized;
    });
  }
  return changed;
}

function findOutcomeCard(outcome, players) {
  return (players || []).flatMap((player) => player.skillDeck || []).find((card) => card.id === outcome?.cardId)
    || (players || []).flatMap((player) => player.skillDeck || []).find((card) => card.name === outcome?.cardName);
}

function sameIds(left, right) {
  return [...left].sort().join('|') === [...right].sort().join('|');
}

function healTargets(previousGame, outcome, actor, card, players) {
  const livingAllies = (players || []).filter((player) =>
    player.hero?.team === actor.hero?.team && (previousGame.playerStates?.[player.id]?.hp || 0) > 0
  );
  if (card.target === 'all-allies') return livingAllies;
  if (card.target === 'self') return livingAllies.filter((player) => player.id === actor.id);
  if (card.target !== 'ally') return [];
  const targetIds = Array.isArray(outcome.targetIds) ? outcome.targetIds : [];
  return targetIds.length === 1 ? livingAllies.filter((player) => player.id === targetIds[0]) : [];
}

export function reconcileLioraVennImpact(previousGame, incomingGame, actor, players) {
  const outcome = incomingGame?.outcome;
  if (!previousGame || !incomingGame || !actor || outcome?.kind !== 'card') return '';
  const card = findOutcomeCard(outcome, players);
  const previousActorState = previousGame.playerStates?.[actor.id];
  const incomingActorState = incomingGame.playerStates?.[actor.id];
  if (!card || !previousActorState || !incomingActorState) return '';

  incomingActorState.sanguineRecompense = Boolean(previousActorState.sanguineRecompense);

  if (isLioraVennHealthExchangeCard(card)) {
    if (!canPayLioraVennHealthCost(card, previousActorState.hp)) {
      return `${card.name} requires at least ${LIORA_VENN_MINIMUM_HP} HP.`;
    }
    if (!outcome.success) return '';

    const livingEnemies = (players || []).filter((player) =>
      player.hero?.team !== actor.hero?.team && (previousGame.playerStates?.[player.id]?.hp || 0) > 0
    );
    const targetIds = Array.isArray(outcome.targetIds) ? outcome.targetIds : [];
    if (card.target === 'enemy') {
      const target = targetIds.length === 1 ? livingEnemies.find((player) => player.id === targetIds[0]) : null;
      if (!target) return `Choose one living enemy for ${card.name}.`;
    } else if (!livingEnemies.length || !sameIds(targetIds, livingEnemies.map((player) => player.id))) {
      return `${card.name} must target every living enemy.`;
    }

    incomingActorState.hp = Math.max(1, Number(previousActorState.hp) - LIORA_VENN_HEALTH_COST);
    if (actor.hero?.name === LIORA_VENN_NAME) incomingActorState.sanguineRecompense = true;
    return '';
  }

  if (actor.hero?.name !== LIORA_VENN_NAME || card.effect !== 'heal' || !outcome.success || !previousActorState.sanguineRecompense) return '';
  const targets = healTargets(previousGame, outcome, actor, card, players);
  if (!targets.length) return '';

  const expectedTargetIds = targets.map((target) => target.id);
  if (!sameIds(outcome.targetIds || [], expectedTargetIds)) return `${card.name} has an invalid healing target.`;
  const targetIds = new Set(expectedTargetIds);
  const livingAllies = (players || []).filter((player) =>
    player.hero?.team === actor.hero?.team && (previousGame.playerStates?.[player.id]?.hp || 0) > 0
  );
  const cardPower = Math.max(0, Number(card.value) || 0);
  let restoredTotal = 0;
  for (const ally of livingAllies) {
    const previousState = previousGame.playerStates?.[ally.id];
    const incomingState = incomingGame.playerStates?.[ally.id];
    if (!previousState || !incomingState) return 'The Sanguine Recompense update is incomplete.';
    const maximumHp = Math.max(1, Number(previousState.maxHp || ally.hero?.maxHp) || 1);
    const power = (targetIds.has(ally.id) ? cardPower : 0) + 1;
    const healedHp = Math.min(maximumHp, Math.max(0, Number(previousState.hp) || 0) + power);
    restoredTotal += healedHp - Math.max(0, Number(previousState.hp) || 0);
    incomingState.hp = healedHp;
  }
  incomingActorState.sanguineRecompense = false;
  outcome.amount = restoredTotal;
  outcome.targetIds = expectedTargetIds;
  outcome.targetName = targets.map((target) => target.displayName).join(', ');
  const historyEntry = [...(incomingGame.history || [])].reverse()
    .find((entry) => entry.cardName === card.name && entry.actorName === actor.displayName);
  if (historyEntry) {
    historyEntry.amount = restoredTotal;
    historyEntry.targetName = outcome.targetName;
  }
  return '';
}
