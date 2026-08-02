export const MAX_GOLD_UNITS = 24;
export const MAX_GOLD = MAX_GOLD_UNITS / 2;
export const SHOP_INVENTORY_CAP = 5;
export const MAX_EXTERNAL_CARDS = 3;
export const PITY_EXCHANGE_GOLD_UNITS = 4;

const externalCard = (card) => ({
  bonus: 0,
  failureEffect: 'self-damage',
  failureValue: 1,
  pityCost: 3,
  unique: true,
  external: true,
  ...card
});

export const SHOP_CATALOG = Object.freeze([
  { id: 'shield-potion', category: 'potion', name: 'Aegis Tonic', description: 'Immediately gain 3 normal Shield until the end of your next turn.', basePriceUnits: 4, repeatIncreaseUnits: 2, purchaseLimit: 3, amount: 3 },
  { id: 'attack-potion', category: 'potion', name: 'Warflame Tonic', description: 'Your next successful attack deals +2 damage.', basePriceUnits: 6, repeatIncreaseUnits: 2, purchaseLimit: 2, amount: 2 },
  { id: 'dice-potion', category: 'potion', name: 'Truecast Tonic', description: 'Gain +2 on your next rolled card.', basePriceUnits: 5, repeatIncreaseUnits: 2, purchaseLimit: 2, amount: 2 },
  { id: 'pity-potion', category: 'potion', name: 'Mercy Tonic', description: 'Your next played card has 0 pity cost and succeeds automatically.', basePriceUnits: 6, repeatIncreaseUnits: 2, purchaseLimit: 2, amount: 1 },
  { id: 'golden-shield', category: 'item', name: 'Golden Shield', description: 'Consume to gain 2 permanent Golden Shield. Enemy attacks consume normal Shield first.', basePriceUnits: 12, repeatIncreaseUnits: 0, purchaseLimit: 1, amount: 2 },
  { id: 'revive-item', category: 'item', name: 'Phoenix Sigil', description: 'While defeated, consume to revive once with one-third of maximum HP.', basePriceUnits: 16, repeatIncreaseUnits: 0, purchaseLimit: 1, amount: 1 },
  { id: 'additional-die', category: 'item', name: 'Twin-Fate Die', description: 'Consume to roll twice on your next rolled card and use the higher d20.', basePriceUnits: 10, repeatIncreaseUnits: 3, purchaseLimit: 2, amount: 1 },
  { id: 'piercing-blade', category: 'item', name: 'Piercing Blade', description: 'Consume so your next attack ignores normal and Golden Shield.', basePriceUnits: 8, repeatIncreaseUnits: 2, purchaseLimit: 2, amount: 1 },
  { id: 'lucky-die', category: 'item', name: 'Lucky Die', description: 'Consume to reroll once if your next rolled card would fail.', basePriceUnits: 8, repeatIncreaseUnits: 2, purchaseLimit: 2, amount: 1 },
  { id: 'shield-break', category: 'external', name: 'Shield Break', description: 'Destroy 2 Shield from one living enemy, consuming normal Shield first.', basePriceUnits: 8, repeatIncreaseUnits: 0, purchaseLimit: 1, card: externalCard({ name: 'Shield Break', description: 'Destroy 2 Shield from one living enemy, consuming normal Shield first.', effect: 'support', supportType: 'shield-break', target: 'enemy', value: 2 }) },
  { id: 'piercing-attack', category: 'external', name: 'Piercing Attack', description: 'Your next attack ignores normal and Golden Shield.', basePriceUnits: 8, repeatIncreaseUnits: 0, purchaseLimit: 1, card: externalCard({ name: 'Piercing Attack', description: 'Your next attack ignores normal and Golden Shield.', effect: 'support', supportType: 'piercing-attack', target: 'self', value: 1 }) },
  { id: 'marked-target', category: 'external', name: 'Marked Target', description: 'Choose one living enemy. Gain +1 on your next attack roll against them.', basePriceUnits: 6, repeatIncreaseUnits: 0, purchaseLimit: 1, card: externalCard({ name: 'Marked Target', description: 'Choose one living enemy. Gain +1 on your next attack roll against them.', effect: 'support', supportType: 'marked-target', target: 'enemy', value: 1 }) },
  { id: 'bad-luck', category: 'external', name: 'Bad Luck', description: 'One living enemy receives -1 on their next d20 roll.', basePriceUnits: 6, repeatIncreaseUnits: 0, purchaseLimit: 1, card: externalCard({ name: 'Bad Luck', description: 'One living enemy receives -1 on their next d20 roll.', effect: 'support', supportType: 'enemy-dice', target: 'enemy', value: 1 }) },
  { id: 'control-cards', category: 'external', name: 'Control Cards', description: 'One living enemy discards one random card from their hand and draws a replacement.', basePriceUnits: 8, repeatIncreaseUnits: 0, purchaseLimit: 1, card: externalCard({ name: 'Control Cards', description: 'One living enemy discards one random card from their hand and draws a replacement.', effect: 'support', supportType: 'discard-random-card', target: 'enemy', value: 1 }) },
  { id: 'steal-gold', category: 'external', name: 'Steal Gold', description: 'Steal up to 2 Gold from one living enemy, subject to your Gold cap.', basePriceUnits: 10, repeatIncreaseUnits: 0, purchaseLimit: 1, card: externalCard({ name: 'Steal Gold', description: 'Steal up to 2 Gold from one living enemy, subject to your Gold cap.', effect: 'support', supportType: 'steal-gold', target: 'enemy', value: 2 }) }
]);

export function getShopOffer(offerId) {
  return SHOP_CATALOG.find((offer) => offer.id === offerId);
}

export function formatGoldUnits(units) {
  const value = Math.max(0, Number(units) || 0) / 2;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function getShopPriceUnits(offer, purchaseCount = 0) {
  return offer.basePriceUnits + Math.max(0, Math.floor(Number(purchaseCount) || 0)) * offer.repeatIncreaseUnits;
}

export function normalizeShopState(state) {
  if (!state) return state;
  state.goldUnits = Math.min(MAX_GOLD_UNITS, Math.max(0, Math.floor(Number(state.goldUnits) || 0)));
  state.goldenShield = Math.max(0, Math.floor(Number(state.goldenShield) || 0));
  state.shopInventory = Array.isArray(state.shopInventory)
    ? state.shopInventory.filter((entry) => entry && getShopOffer(entry.itemId)?.category === 'item' && Number(entry.quantity) > 0).map((entry) => ({ itemId: entry.itemId, quantity: Math.max(1, Math.floor(Number(entry.quantity) || 1)) }))
    : [];
  state.shopPurchases = state.shopPurchases && typeof state.shopPurchases === 'object' ? { ...state.shopPurchases } : {};
  state.externalCardsPurchased = Math.max(0, Math.floor(Number(state.externalCardsPurchased) || 0));
  state.shopShieldUntilTurn = Math.max(0, Math.floor(Number(state.shopShieldUntilTurn) || 0));
  state.shopAttackBonus = Math.max(0, Math.floor(Number(state.shopAttackBonus) || 0));
  state.shopDiceBonus = Math.max(0, Math.floor(Number(state.shopDiceBonus) || 0));
  state.shopFreePity = Boolean(state.shopFreePity);
  state.additionalDieActive = Boolean(state.additionalDieActive);
  state.luckyDieActive = Boolean(state.luckyDieActive);
  state.piercingAttackActive = Boolean(state.piercingAttackActive);
  state.markedTargetId = String(state.markedTargetId || '');
  state.markedTargetBonus = Math.max(0, Math.floor(Number(state.markedTargetBonus) || 0));
  return state;
}

export function getInventoryQuantity(state, itemId) {
  normalizeShopState(state);
  return state.shopInventory.find((entry) => entry.itemId === itemId)?.quantity || 0;
}

export function getInventorySize(state) {
  normalizeShopState(state);
  return state.shopInventory.reduce((sum, entry) => sum + entry.quantity, 0);
}

function addInventoryItem(state, itemId) {
  const entry = state.shopInventory.find((candidate) => candidate.itemId === itemId);
  if (entry) entry.quantity += 1;
  else state.shopInventory.push({ itemId, quantity: 1 });
}

function removeInventoryItem(state, itemId) {
  const entry = state.shopInventory.find((candidate) => candidate.itemId === itemId);
  if (!entry || entry.quantity <= 0) return false;
  entry.quantity -= 1;
  state.shopInventory = state.shopInventory.filter((candidate) => candidate.quantity > 0);
  return true;
}

function activePlayerId(game, players) {
  return game?.turnOrder?.[0] || players?.[game?.activePlayerIndex || 0]?.id || '';
}

function addTimedShield(state, amount, expiresAfterTurn) {
  state.shield = Math.max(0, Number(state.shield) || 0) + amount;
  state.timedEffects = [...(state.timedEffects || []), { kind: 'shield', value: amount, expiresAfterTurn }];
  state.shopShieldUntilTurn = expiresAfterTurn;
}

function appendShopHistory(game, player, message, now = Date.now()) {
  if (!game) return;
  game.history = [...(game.history || []), {
    id: `shop-${player.id}-${now}-${game.history?.length || 0}`,
    turn: game.completedTurns || 0,
    phase: game.adventure?.chapter || 1,
    kind: 'system',
    actorName: player.displayName,
    actorTeam: player.hero?.team,
    message,
    success: true,
    createdAt: now
  }].slice(-80);
}

function appendShopUseNotice(game, player, offer, now = Date.now()) {
  if (!game || !player || !offer) return;
  const notice = {
    id: `shop-use-${player.id}-${offer.id}-${now}-${game.history?.length || 0}`,
    kind: 'shop-use',
    title: `${player.displayName} used ${offer.name}`,
    detail: offer.description,
    actorId: player.id,
    shopOfferId: offer.id
  };
  game.outcome ||= {
    id: `shop-notice-${player.id}-${now}`,
    kind: 'system',
    success: true,
    total: 0,
    target: game.adventure?.target || 0,
    label: notice.title,
    detail: notice.detail
  };
  game.outcome.notices ||= [];
  if (!game.outcome.notices.some((item) => item.id === notice.id)) game.outcome.notices.push(notice);
}

function offerActivationError(state, offerId) {
  if (offerId === 'shield-potion' && state.shopShieldUntilTurn > (state.completedPlayerTurns || 0)) return 'Aegis Tonic is already active.';
  if (offerId === 'attack-potion' && (state.shopAttackBonus > 0 || state.attackBuff > 0)) return 'A next-attack damage buff is already active.';
  if (offerId === 'dice-potion' && (state.shopDiceBonus > 0 || state.diceBuff > 0)) return 'A next-roll bonus is already active.';
  if (offerId === 'pity-potion' && (state.shopFreePity || (state.zeroPityUntilTurn || 0) > (state.completedPlayerTurns || 0))) return 'A zero-pity effect is already active.';
  return '';
}

export function purchaseShopOffer(game, players, playerId, offerId, now = Date.now()) {
  if (!game || game.ended) return { ok: false, error: 'The Shop is closed because the battle has ended.' };
  const player = players.find((candidate) => candidate.id === playerId);
  const state = player && game.playerStates?.[player.id];
  const offer = getShopOffer(offerId);
  if (!player || !state) return { ok: false, error: 'Join the active battle before using the Shop.' };
  normalizeShopState(state);
  if (state.hp <= 0) return { ok: false, error: 'A defeated player cannot buy from the Shop.' };
  if (!offer) return { ok: false, error: 'That Shop offer does not exist.' };
  const bought = Math.max(0, Math.floor(Number(state.shopPurchases[offer.id]) || 0));
  if (bought >= offer.purchaseLimit) return { ok: false, error: `${offer.name} is sold out for you this battle.` };
  const priceUnits = getShopPriceUnits(offer, bought);
  if (state.goldUnits < priceUnits) return { ok: false, error: `You need ${formatGoldUnits(priceUnits)} Gold to buy ${offer.name}.` };
  if (offer.category === 'external' && state.externalCardsPurchased >= MAX_EXTERNAL_CARDS) return { ok: false, error: `You can only acquire ${MAX_EXTERNAL_CARDS} External Cards per battle.` };
  if (offer.category === 'item' && getInventorySize(state) >= SHOP_INVENTORY_CAP) return { ok: false, error: `Your inventory is full (${SHOP_INVENTORY_CAP} item units).` };
  const activationError = offer.category === 'potion' ? offerActivationError(state, offer.id) : '';
  if (activationError) return { ok: false, error: activationError };

  state.goldUnits -= priceUnits;
  state.shopPurchases[offer.id] = bought + 1;
  if (offer.category === 'potion') {
    if (offer.id === 'shield-potion') {
      const ownActiveTurn = activePlayerId(game, players) === player.id;
      addTimedShield(state, offer.amount, (state.completedPlayerTurns || 0) + (ownActiveTurn ? 2 : 1));
    }
    if (offer.id === 'attack-potion') state.shopAttackBonus = offer.amount;
    if (offer.id === 'dice-potion') state.shopDiceBonus = offer.amount;
    if (offer.id === 'pity-potion') state.shopFreePity = true;
  } else if (offer.category === 'item') {
    addInventoryItem(state, offer.id);
  } else {
    const runtimeId = `${player.id}::shop::${offer.id}::${bought + 1}`;
    const card = { ...offer.card, id: runtimeId, shopOfferId: offer.id };
    player.skillDeck = [...(player.skillDeck || []), card];
    state.drawPile = [...(state.drawPile || []), runtimeId];
    state.externalCardsPurchased += 1;
  }
  appendShopHistory(game, player, `${player.displayName} bought ${offer.name} for ${formatGoldUnits(priceUnits)} Gold.`, now);
  if (offer.category === 'potion') appendShopUseNotice(game, player, offer, now);
  return { ok: true, offer, priceUnits };
}

export function exchangePityForGold(game, players, playerId, now = Date.now()) {
  if (!game || game.ended) return { ok: false, error: 'The exchange is closed because the battle has ended.' };
  const player = players.find((candidate) => candidate.id === playerId);
  const state = player && game.playerStates?.[player.id];
  if (!player || !state) return { ok: false, error: 'Join the active battle before exchanging pity.' };
  normalizeShopState(state);
  if (state.hp <= 0) return { ok: false, error: 'A defeated player cannot exchange pity.' };
  if ((state.pityPoints || 0) < 1) return { ok: false, error: 'You need 1 pity point for this exchange.' };
  if (state.goldUnits > MAX_GOLD_UNITS - PITY_EXCHANGE_GOLD_UNITS) return { ok: false, error: `You need room for 2 Gold before exchanging pity (maximum ${MAX_GOLD}).` };
  state.pityPoints -= 1;
  state.goldUnits += PITY_EXCHANGE_GOLD_UNITS;
  appendShopHistory(game, player, `${player.displayName} exchanged 1 pity point for 2 Gold.`, now);
  return { ok: true };
}

export function useShopItem(game, players, playerId, itemId, now = Date.now()) {
  if (!game || game.ended) return { ok: false, error: 'Items cannot be used after the battle ends.' };
  const player = players.find((candidate) => candidate.id === playerId);
  const state = player && game.playerStates?.[player.id];
  const offer = getShopOffer(itemId);
  if (!player || !state) return { ok: false, error: 'Join the active battle before using an item.' };
  normalizeShopState(state);
  if (!offer || offer.category !== 'item' || getInventoryQuantity(state, itemId) <= 0) return { ok: false, error: 'That item is not in your inventory.' };
  const defeated = state.hp <= 0;
  if (defeated && itemId !== 'revive-item') return { ok: false, error: 'While defeated, you can only use a Phoenix Sigil.' };
  if (!defeated && itemId === 'revive-item') return { ok: false, error: 'Phoenix Sigil can only be used while defeated.' };
  if (itemId === 'additional-die' && (state.additionalDieActive || state.luckyDieActive)) return { ok: false, error: 'A Twin-Fate Die or Lucky Die is already active.' };
  if (itemId === 'lucky-die' && (state.additionalDieActive || state.luckyDieActive)) return { ok: false, error: 'A Twin-Fate Die or Lucky Die is already active.' };
  if (itemId === 'piercing-blade' && state.piercingAttackActive) return { ok: false, error: 'A shield-piercing attack is already prepared.' };
  if (itemId === 'golden-shield' && state.goldenShield > 0) return { ok: false, error: 'Golden Shield is already active.' };

  removeInventoryItem(state, itemId);
  if (itemId === 'golden-shield') state.goldenShield += offer.amount;
  if (itemId === 'additional-die') state.additionalDieActive = true;
  if (itemId === 'lucky-die') state.luckyDieActive = true;
  if (itemId === 'piercing-blade') state.piercingAttackActive = true;
  if (itemId === 'revive-item') {
    state.hp = Math.max(1, Math.ceil(state.maxHp / 3));
    state.reviveIn = 0;
    game.turnOrder = [...new Set([...(game.turnOrder || []), player.id])];
    game.roundOrder = [...new Set([...(game.roundOrder || []), player.id])];
  }
  appendShopHistory(game, player, `${player.displayName} used ${offer.name}.`, now);
  appendShopUseNotice(game, player, offer, now);
  return { ok: true, offer };
}

export function goldRewardUnitsForOutcome(outcome) {
  if (outcome?.kind === 'card') {
    if (outcome.success) return 2;
    if (outcome.resolution === 'roll') return 1;
  }
  if (['skip', 'discard', 'timeout', 'forced-skip'].includes(outcome?.kind)) return 1;
  return 0;
}

export function applyGoldReward(state, outcome) {
  normalizeShopState(state);
  const beforeUnits = state.goldUnits;
  const requested = goldRewardUnitsForOutcome(outcome);
  state.goldUnits = Math.min(MAX_GOLD_UNITS, state.goldUnits + requested);
  const awardedUnits = state.goldUnits - beforeUnits;
  if (outcome) {
    outcome.goldBefore = beforeUnits / 2;
    outcome.goldChange = awardedUnits / 2;
    outcome.goldAfter = state.goldUnits / 2;
  }
  return awardedUnits;
}

export function reconcileShopTurn(previousGame, incomingGame, players, actor) {
  if (!previousGame || !incomingGame || !actor || incomingGame.outcome?.kind !== 'card') return;
  const outcome = incomingGame.outcome;
  const previousActorState = previousGame.playerStates?.[actor.id];
  const incomingActorState = incomingGame.playerStates?.[actor.id];
  if (!previousActorState || !incomingActorState) return;
  const card = players.flatMap((player) => player.skillDeck || []).find((item) => item.id === outcome.cardId)
    || players.flatMap((player) => player.skillDeck || []).find((item) => item.name === outcome.cardName);
  if (!card) return;
  for (const player of players) {
    const before = previousGame.playerStates?.[player.id];
    const after = incomingGame.playerStates?.[player.id];
    if (!before || !after) continue;
    normalizeShopState(before);
    normalizeShopState(after);
    after.goldUnits = before.goldUnits;
    after.shopInventory = before.shopInventory.map((entry) => ({ ...entry }));
    after.shopPurchases = { ...before.shopPurchases };
    after.externalCardsPurchased = before.externalCardsPurchased;
    after.shopShieldUntilTurn = before.shopShieldUntilTurn;
    after.goldenShield = Math.min(before.goldenShield, after.goldenShield);
    if (player.id !== actor.id) {
      after.shopAttackBonus = before.shopAttackBonus;
      after.shopDiceBonus = before.shopDiceBonus;
      after.shopFreePity = before.shopFreePity;
      after.additionalDieActive = before.additionalDieActive;
      after.luckyDieActive = before.luckyDieActive;
      after.piercingAttackActive = before.piercingAttackActive;
      after.markedTargetId = before.markedTargetId;
      after.markedTargetBonus = before.markedTargetBonus;
    }
  }
  normalizeShopState(previousActorState);
  normalizeShopState(incomingActorState);
  const isAttack = card.effect === 'damage' || card.effect === 'aoe';
  const selectedTargetId = String(outcome.targetIds?.[0] || '');
  incomingActorState.shopAttackBonus = outcome.success && isAttack && outcome.targetIds?.length ? 0 : previousActorState.shopAttackBonus;
  incomingActorState.shopDiceBonus = outcome.resolution === 'roll' ? 0 : previousActorState.shopDiceBonus;
  incomingActorState.shopFreePity = false;
  incomingActorState.additionalDieActive = outcome.resolution === 'roll' ? false : previousActorState.additionalDieActive;
  incomingActorState.luckyDieActive = outcome.resolution === 'roll' ? false : previousActorState.luckyDieActive;
  incomingActorState.piercingAttackActive = outcome.success && isAttack && outcome.targetIds?.length
    ? false
    : outcome.success && card.supportType === 'piercing-attack'
      ? true
      : previousActorState.piercingAttackActive;
  if (isAttack && previousActorState.markedTargetId === selectedTargetId) {
    incomingActorState.markedTargetId = '';
    incomingActorState.markedTargetBonus = 0;
  } else if (outcome.success && card.supportType === 'marked-target' && selectedTargetId) {
    incomingActorState.markedTargetId = selectedTargetId;
    incomingActorState.markedTargetBonus = Math.max(0, Number(card.value) || 0);
  } else {
    incomingActorState.markedTargetId = previousActorState.markedTargetId;
    incomingActorState.markedTargetBonus = previousActorState.markedTargetBonus;
  }
  if (outcome.success && card.supportType === 'steal-gold' && selectedTargetId) {
    const targetState = incomingGame.playerStates?.[selectedTargetId];
    if (targetState) {
      normalizeShopState(targetState);
      const stolenUnits = Math.min(Math.max(0, Number(card.value) || 0) * 2, targetState.goldUnits, MAX_GOLD_UNITS - incomingActorState.goldUnits);
      targetState.goldUnits -= stolenUnits;
      incomingActorState.goldUnits += stolenUnits;
    }
  }
  applyGoldReward(incomingActorState, outcome);
  const historyEntry = [...(incomingGame.history || [])].reverse().find((entry) => entry.cardName === card.name && entry.actorName === actor.displayName);
  if (historyEntry) {
    historyEntry.goldBefore = outcome.goldBefore;
    historyEntry.goldChange = outcome.goldChange;
    historyEntry.goldAfter = outcome.goldAfter;
  }
  if (outcome.goldChange && !/Earned [\d.]+ Gold\./.test(String(outcome.detail || ''))) outcome.detail = `${outcome.detail || ''} Earned ${outcome.goldChange} Gold.`.trim();
  if (historyEntry && outcome.goldChange && !/Earned [\d.]+ Gold\./.test(String(historyEntry.message || ''))) historyEntry.message = `${historyEntry.message || ''} Earned ${outcome.goldChange} Gold.`.trim();
}

export function stripShopCards(player) {
  return { ...player, skillDeck: (player.skillDeck || []).filter((card) => !card.external && !String(card.id || '').includes('::shop::')) };
}

export function initializeShopBattle(game, players) {
  for (const player of players) {
    const state = game?.playerStates?.[player.id];
    if (!state) continue;
    state.goldUnits = 0;
    state.goldenShield = 0;
    state.shopInventory = [];
    state.shopPurchases = {};
    state.externalCardsPurchased = 0;
    state.shopShieldUntilTurn = 0;
    state.shopAttackBonus = 0;
    state.shopDiceBonus = 0;
    state.shopFreePity = false;
    state.additionalDieActive = false;
    state.luckyDieActive = false;
    state.piercingAttackActive = false;
    state.markedTargetId = '';
    state.markedTargetBonus = 0;
  }
}
