import {
  normalizeWorldEventState,
  initializeNewBattleWorldEvents,
  captureAuthoritativeWorldEventState,
  restoreAuthoritativeWorldEventState,
  sanitizeWorldEventGame,
  triggerWorldEventAfterPhase,
  submitWorldEventChoice,
  resolvePendingWorldEventTimeout,
  removeWorldEventParticipant,
  isWorldEventBlocking,
  getActiveBattleDeadline
} from './world-event-engine.mjs';

const emptyRoom = () => ({ players: [], phase: 'lobby', game: null, revision: 0, phaseFiveOriginalCards: {} });
let room = emptyRoom();
const peers = new Map();
const roomCacheKey = new Request('https://shattered-oath-room.internal/shared-state-v3');
let durableStorage = null;
let roomQueue = Promise.resolve();

function publicState(viewerId = '') {
  if (room.game) {
    normalizeWorldEventState(room.game);
    upgradePhaseFiveCards(room.game);
  }
  const personalizedGame = room.game ? {
    ...room.game,
    playerStates: Object.fromEntries(Object.entries(room.game.playerStates || {}).map(([id, state]) => [
      id,
      id === viewerId ? state : { ...state, hand: [], drawPile: [], discardPile: [], graveyard: [], borrowedCards: [], purgedCards: [], cardUses: {} }
    ]))
  } : null;
  const game = personalizedGame ? sanitizeWorldEventGame(personalizedGame, viewerId) : null;
  return { players: room.players, phase: room.phase, game, revision: room.revision, serverNow: Date.now(), viewerSessionId: viewerId };
}

async function hydrateRoom() {
  try {
    if (durableStorage) {
      const state = await durableStorage.get('shared-room');
      if (state?.revision >= room.revision && Array.isArray(state.players)) room = state;
      if (room.game) {
        normalizeWorldEventState(room.game);
        upgradePhaseFiveCards(room.game);
      }
      return;
    }
    const cached = await caches.default.match(roomCacheKey);
    if (cached) {
      const state = await cached.json();
      if (state?.revision >= room.revision && Array.isArray(state.players)) room = state;
    }
    if (room.game) {
      normalizeWorldEventState(room.game);
      upgradePhaseFiveCards(room.game);
    }
  } catch {
    // The in-isolate state still keeps the room usable if the cache is unavailable.
  }
}

async function persistRoom() {
  try {
    if (durableStorage) {
      await durableStorage.put('shared-room', room);
      const activeDeadline = getActiveBattleDeadline(room.game);
      if (room.phase === 'game' && activeDeadline && !room.game?.ended) {
        await durableStorage.setAlarm(activeDeadline);
      } else {
        await durableStorage.deleteAlarm();
      }
      return;
    }
    await caches.default.put(roomCacheKey, new Response(JSON.stringify(room), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' }
    }));
  } catch {
    // Continue with in-isolate state; clients will retry on the next poll.
  }
}

function serialized(task) {
  const next = roomQueue.then(task, task);
  roomQueue = next.catch(() => {});
  return next;
}

function send(socket, payload) {
  if (socket.readyState === 1) socket.send(JSON.stringify(payload));
}

function broadcast() {
  for (const [socket, viewerId] of peers.entries()) {
    if (socket.readyState === 1) socket.send(JSON.stringify({ type: 'state', state: publicState(viewerId) }));
  }
}

async function commitRoom() {
  room.revision += 1;
  await persistRoom();
  broadcast();
}

const teamLabel = (team) => team === 'veil' ? 'Veilbound' : 'Embercourt';
const secureRandomInt = (minimum, maximum) => {
  const span = maximum - minimum + 1;
  const values = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / span) * span;
  do globalThis.crypto.getRandomValues(values); while (values[0] >= limit);
  return minimum + (values[0] % span);
};
const randomDiceTarget = () => secureRandomInt(8, 16);
const TURN_SECONDS = 60;
function teamTotals(game, team) { const members = room.players.filter((player) => player.hero.team === team); return { hp: members.reduce((sum, player) => sum + (game.playerStates[player.id]?.hp || 0), 0), alive: members.filter((player) => (game.playerStates[player.id]?.hp || 0) > 0).length, shield: members.reduce((sum, player) => sum + (game.playerStates[player.id]?.shield || 0), 0) }; }
function decideWinner(game, lastTeam, finalTurn = false) {
  const veil = teamTotals(game, 'veil'); const ember = teamTotals(game, 'ember');
  if (!veil.alive && ember.alive) return 'ember'; if (!ember.alive && veil.alive) return 'veil';
  if (!veil.alive && !ember.alive) return game.adventure.veilInfluence !== game.adventure.emberInfluence ? (game.adventure.veilInfluence > game.adventure.emberInfluence ? 'veil' : 'ember') : lastTeam;
  if (!finalTurn) return null;
  if (veil.hp !== ember.hp) return veil.hp > ember.hp ? 'veil' : 'ember'; if (veil.alive !== ember.alive) return veil.alive > ember.alive ? 'veil' : 'ember'; if (veil.shield !== ember.shield) return veil.shield > ember.shield ? 'veil' : 'ember'; if (game.adventure.veilInfluence !== game.adventure.emberInfluence) return game.adventure.veilInfluence > game.adventure.emberInfluence ? 'veil' : 'ember'; return lastTeam;
}
function nextLivingIndex(game, currentIndex) { for (let offset = 1; offset <= room.players.length; offset += 1) { const index = (currentIndex + offset) % room.players.length; if ((game.playerStates[room.players[index]?.id]?.hp || 0) > 0) return index; } return currentIndex; }
const PHASE_FIVE_CARD_UPGRADES = {
  'lost-momentum': 'heavy',
  'broken-plan': 'brace',
  'empty-gesture': 'second-wind'
};
function matchesCommonCardId(cardId, commonId) { return cardId === commonId || cardId.endsWith(`-common-${commonId}`); }
function phaseFiveSourceCards(skillDeck) {
  return (skillDeck || []).filter((card) => Object.keys(PHASE_FIVE_CARD_UPGRADES).some((sourceId) => matchesCommonCardId(card.id, sourceId)));
}
function preservePhaseFiveOriginalCards() {
  room.phaseFiveOriginalCards ||= {};
  for (const player of room.players) {
    if (!Array.isArray(room.phaseFiveOriginalCards[player.id])) room.phaseFiveOriginalCards[player.id] = structuredClone(phaseFiveSourceCards(player.skillDeck));
  }
}
function restorePhaseFiveOriginalCards() {
  const originals = room.phaseFiveOriginalCards || {};
  room.players = room.players.map((player) => {
    const originalCards = new Map((originals[player.id] || []).map((card) => [card.id, card]));
    return {
      ...player,
      ready: false,
      skillDeck: (player.skillDeck || []).map((card) => originalCards.has(card.id) ? structuredClone(originalCards.get(card.id)) : card)
    };
  });
  room.phaseFiveOriginalCards = {};
}
function appendOutcomeNotice(game, notice) {
  if (!game) return;
  game.outcome ||= {
    id: `notice-${game.completedTurns || 0}-${game.turnStartedAt || Date.now()}`,
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
function gameNoticeScope(game) {
  return game?.history?.at(-1)?.id || `turn-${game?.completedTurns || 0}-${game?.turnStartedAt || Date.now()}`;
}
function appendPhaseStartNotice(game) {
  if (!game || game.ended || isWorldEventBlocking(game)) return;
  const phase = Math.min(30, Math.max(1, Number(game.completedPhases || 0) + 1));
  const activeId = game.turnOrder?.[0] || room.players[game.activePlayerIndex]?.id;
  const activePlayer = room.players.find((player) => player.id === activeId);
  appendOutcomeNotice(game, {
    id: `${gameNoticeScope(game)}-phase-${phase}-start`,
    kind: 'phase-start',
    title: `Phase ${phase} started`,
    detail: activePlayer
      ? `Phase ${phase} has begun. ${activePlayer.displayName}'s turn is active.`
      : `Phase ${phase} has begun.`
  });
}
function upgradePhaseFiveCards(game) {
  if ((game?.completedPhases || 0) < 5) return false;
  preservePhaseFiveOriginalCards();
  let changed = false;
  const transformations = new Set();
  room.players = room.players.map((player) => {
    let playerChanged = false;
    const skillDeck = (player.skillDeck || []).map((card) => {
      const upgrade = Object.entries(PHASE_FIVE_CARD_UPGRADES).find(([sourceId]) => matchesCommonCardId(card.id, sourceId));
      if (!upgrade || card.effect !== 'none') return card;
      const target = player.skillDeck.find((candidate) => matchesCommonCardId(candidate.id, upgrade[1]));
      if (!target) return card;
      const { id: _targetId, ...targetAbilities } = target;
      const effectLabel = ['damage', 'aoe'].includes(target.effect) ? 'attack' : target.effect === 'guard' ? 'shield' : 'heal';
      transformations.add(`${card.name} → ${target.name} (${effectLabel})`);
      playerChanged = true;
      changed = true;
      return { ...targetAbilities, id: card.id };
    });
    return playerChanged ? { ...player, skillDeck } : player;
  });
  if (changed) appendOutcomeNotice(game, {
    id: `${gameNoticeScope(game)}-phase-${game.completedPhases}-card-transform`,
    kind: 'card-transform',
    title: 'No-effect cards upgraded',
    detail: `${[...transformations].join('; ')}.`
  });
  return changed;
}
function normalizeServerTurnOrder(game) {
  if (!game || !room.players.length) return [];
  normalizeWorldEventState(game);
  if (!Number.isFinite(game.completedPhases)) game.completedPhases = Math.max(0, (game.roundNumber || 1) - 1);
  upgradePhaseFiveCards(game);
  game.maxPhases = 30;
  for (const state of Object.values(game.playerStates || {})) {
    state.graveyard ||= [];
    state.cardUses ||= {};
    state.purgedCards ||= [];
    state.borrowedCards = (state.borrowedCards || []).map((entry) => Number.isFinite(entry.expiresAfterBorrowerTurn)
      ? entry
      : { ...entry, expiresAfterBorrowerTurn: (state.completedPlayerTurns || 0) + 1 });
    state.zeroPityUntilTurn = Math.max(0, Math.floor(Number(state.zeroPityUntilTurn) || 0));
    state.pityPoints = Math.max(0, Math.floor(Number(state.pityPoints) || 0));
  }
  const validIds = new Set(room.players.map((player) => player.id));
  const currentId = room.players[game.activePlayerIndex]?.id;
  const fallback = currentId ? [...room.players.slice(game.activePlayerIndex), ...room.players.slice(0, game.activePlayerIndex)].map((player) => player.id) : room.players.map((player) => player.id);
  const source = Array.isArray(game.turnOrder) && game.turnOrder.length ? game.turnOrder : fallback;
  const order = [...new Set([...source.filter((id) => validIds.has(id)), ...fallback])].filter((id) => (game.playerStates[id]?.hp || 0) > 0);
  game.turnOrder = order;
  if (order.length) { const index = room.players.findIndex((player) => player.id === order[0]); if (index >= 0) game.activePlayerIndex = index; }
  return order;
}
function speedOrder(game) {
  return [...room.players]
    .filter((player) => (game.playerStates[player.id]?.hp || 0) > 0)
    .sort((left, right) => (right.hero.speed || 0) - (left.hero.speed || 0) || left.joinedAt - right.joinedAt)
    .map((player) => player.id);
}
function resetPhaseTurnOrder(game) {
  const order = speedOrder(game);
  game.roundOrder = order;
  game.turnOrder = order;
  if (order.length) {
    const index = room.players.findIndex((player) => player.id === order[0]);
    if (index >= 0) game.activePlayerIndex = index;
  }
  return order;
}
function completeRoundTurn(game, actorId) {
  const livingIds = speedOrder(game);
  let acted = [...new Set([...(game.actedThisRound || []), actorId])].filter((id) => livingIds.includes(id));
  game.completedPhases ??= Math.max(0, (game.roundNumber || 1) - 1);
  game.maxPhases = 30;
  game.roundNumber ||= game.completedPhases + 1;
  game.roundOrder = (game.roundOrder?.length ? game.roundOrder : livingIds).filter((id) => livingIds.includes(id));
  let phaseCompleted = false;
  if (livingIds.length && livingIds.every((id) => acted.includes(id))) {
    phaseCompleted = true;
    game.completedPhases += 1;
    game.roundNumber += 1;
    acted = [];
    resetPhaseTurnOrder(game);
  }
  game.actedThisRound = acted;
  return phaseCompleted;
}
function deriveAuthoritativePlayedPhase(previousGame, incomingGame, actor) {
  const livingIds = speedOrder(incomingGame);
  let actedThisRound = [...new Set([...(previousGame.actedThisRound || []), actor.id])]
    .filter((id) => livingIds.includes(id));
  const outcome = incomingGame.outcome;
  const card = room.players.flatMap((player) => player.skillDeck || []).find((item) => item.id === outcome?.cardId)
    || room.players.flatMap((player) => player.skillDeck || []).find((item) => item.name === outcome?.cardName);
  const immediateReviveId = outcome?.success && card?.supportType === 'revive' ? String(outcome.targetIds?.[0] || '') : '';
  if (immediateReviveId) actedThisRound = actedThisRound.filter((id) => id !== immediateReviveId);
  const phaseCompleted = livingIds.length > 0 && livingIds.every((id) => actedThisRound.includes(id));
  const previousCompletedPhases = Number(previousGame.completedPhases || 0);
  const completedPhases = previousCompletedPhases + (phaseCompleted ? 1 : 0);
  return {
    phaseCompleted,
    completedPhases,
    roundNumber: completedPhases + 1,
    actedThisRound: phaseCompleted ? [] : actedThisRound
  };
}
function rotateServerTurn(game, actorId) {
  const order = normalizeServerTurnOrder(game).filter((id) => id !== actorId);
  if ((game.playerStates[actorId]?.hp || 0) > 0 && room.players.some((player) => player.id === actorId)) order.push(actorId);
  game.turnOrder = order;
  normalizeServerTurnOrder(game);
}

function removeCardFromZones(state, cardId) {
  state.hand = (state.hand || []).filter((id) => id !== cardId);
  state.drawPile = (state.drawPile || []).filter((id) => id !== cardId);
  state.discardPile = (state.discardPile || []).filter((id) => id !== cardId);
}

function shuffleCards(cards) {
  const shuffled = [...cards];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function drawOneOrRecycleDiscard(state, handIndex = (state.hand || []).length) {
  state.hand ||= [];
  state.drawPile ||= [];
  state.discardPile ||= [];
  if (state.drawPile.length === 0 && state.discardPile.length > 0) {
    state.drawPile = shuffleCards(state.discardPile);
    state.discardPile = [];
  }
  if (state.drawPile.length) {
    const replacementIndex = Math.floor(Math.random() * state.drawPile.length);
    const replacement = state.drawPile.splice(replacementIndex, 1)[0];
    state.hand.splice(Math.min(Math.max(0, handIndex), state.hand.length), 0, replacement);
  }
}

function moveCardToGraveyard(state, cardId) {
  const handIndex = (state.hand || []).indexOf(cardId);
  removeCardFromZones(state, cardId);
  state.graveyard ||= [];
  if (!state.graveyard.includes(cardId)) state.graveyard.push(cardId);
  if (handIndex >= 0) drawOneOrRecycleDiscard(state, handIndex);
}

function temporarilyPurgeHandCard(state, cardId, returnAfterPhase) {
  if (!(state.hand || []).includes(cardId)) return false;
  moveCardToGraveyard(state, cardId);
  state.purgedCards = [...(state.purgedCards || []).filter((entry) => entry.cardId !== cardId), { cardId, returnAfterPhase }];
  return true;
}

function returnExpiredPurgedCards(game, completedPhases) {
  const returned = [];
  for (const player of room.players) {
    const state = game.playerStates?.[player.id];
    if (!state) continue;
    const returning = (state.purgedCards || []).filter((entry) => entry.returnAfterPhase <= completedPhases);
    for (const entry of returning) {
      removeCardFromZones(state, entry.cardId);
      state.graveyard = (state.graveyard || []).filter((id) => id !== entry.cardId);
      state.discardPile ||= [];
      if (!state.discardPile.includes(entry.cardId)) state.discardPile.push(entry.cardId);
      returned.push({ playerId: player.id, cardId: entry.cardId });
    }
    state.purgedCards = (state.purgedCards || []).filter((entry) => !returning.includes(entry));
  }
  return returned;
}

function returnBorrowedCards(game, completedBorrowerId) {
  const borrower = game.playerStates[completedBorrowerId];
  if (!borrower) return [];
  const returning = (borrower.borrowedCards || []).filter((entry) =>
    (entry.expiresAfterBorrowerTurn ?? borrower.completedPlayerTurns + 1) <= borrower.completedPlayerTurns
  );
  let removedFromHand = false;
  for (const entry of returning) {
    if ((borrower.hand || []).includes(entry.cardId)) removedFromHand = true;
    removeCardFromZones(borrower, entry.cardId);
    const owner = game.playerStates[entry.ownerId];
    if (owner) {
      owner.discardPile ||= [];
      if (!owner.discardPile.includes(entry.cardId)) owner.discardPile.push(entry.cardId);
    }
  }
  borrower.borrowedCards = (borrower.borrowedCards || []).filter((entry) => !returning.includes(entry));
  if (removedFromHand) drawOneOrRecycleDiscard(borrower);
  return returning;
}

function returnPlayedBorrowedCard(game, borrowerId, cardId) {
  if (!cardId) return false;
  const borrower = game.playerStates?.[borrowerId];
  const borrowed = (borrower?.borrowedCards || []).find((entry) => entry.cardId === cardId);
  if (!borrower || !borrowed) return false;
  removeCardFromZones(borrower, cardId);
  borrower.borrowedCards = borrower.borrowedCards.filter((entry) => entry.cardId !== cardId);
  const owner = game.playerStates?.[borrowed.ownerId];
  if (owner) {
    owner.discardPile ||= [];
    if (!owner.discardPile.includes(cardId)) owner.discardPile.push(cardId);
  }
  return true;
}

function tickPendingRevives(game) {
  const revived = [];
  for (const player of room.players) {
    const state = game.playerStates[player.id];
    if (!state || state.hp > 0 || !(state.reviveIn > 0)) continue;
    state.reviveIn -= 1;
    if (state.reviveIn === 0) {
      state.hp = Math.max(1, Math.ceil(state.maxHp / 3));
      revived.push(player);
    }
  }
  return revived;
}
function triggerSableRevives(game) {
  return room.players.filter((player) => {
    const state = game.playerStates[player.id];
    if (player.hero.name !== 'Sable Fen' || !state || state.hp > 0 || state.passiveReviveUsed) return false;
    state.hp = Math.max(1, Math.ceil(state.maxHp / 2));
    state.passiveReviveUsed = true;
    state.reviveIn = 0;
    return true;
  });
}

function cardPityCost(card) {
  const stored = Number(card?.pityCost);
  if (Number.isFinite(stored) && stored >= 0) return Math.min(8, Math.floor(stored));
  if (card?.effect === 'none') return 0;
  if (!card?.unique) return Math.min(5, Math.max(3, Number(card?.value) || 0));
  if (card?.effect === 'damage') return Math.min(8, 2 + (Number(card.value) || 0) + (card.ignoresShield ? 1 : 0));
  if (card?.effect === 'aoe') return Math.min(8, 3 + (Number(card.value) || 0) + (card.ignoresShield ? 1 : 0));
  if (card?.effect === 'heal' || card?.effect === 'guard') return Math.min(7, 2 + (Number(card.value) || 0));
  if (['revive', 'skip-enemy', 'steal-card'].includes(card?.supportType || '')) return 7;
  if (['purge-card', 'advance-ally', 'dispel-enemy'].includes(card?.supportType || '')) return 6;
  return Math.min(6, 3 + (Number(card?.value) || 0));
}

function reconcilePityPoints(previousGame, incomingGame, actor) {
  const previousState = previousGame?.playerStates?.[actor?.id];
  const incomingState = incomingGame?.playerStates?.[actor?.id];
  const outcome = incomingGame?.outcome;
  if (!previousState || !incomingState || outcome?.kind !== 'card') return 'The pity update is incomplete.';
  const actionHistoryId = [...(incomingGame.history || [])].reverse()
    .find((entry) => entry.turn === incomingGame.completedTurns && entry.actorName === actor.displayName && entry.cardName === outcome.cardName)?.id;
  outcome.id = String(actionHistoryId || `turn-${incomingGame.completedTurns}-${actor.id}-${Date.now()}`);
  outcome.actorId = actor.id;
  outcome.actorName = actor.displayName;
  const card = room.players.flatMap((player) => player.skillDeck || []).find((item) => item.id === outcome.cardId)
    || room.players.flatMap((player) => player.skillDeck || []).find((item) => item.name === outcome.cardName);
  if (!card || !(previousState.hand || []).includes(card.id)) return 'The selected card is not in the active hand.';
  const before = Math.max(0, Math.floor(Number(previousState.pityPoints) || 0));
  const favorableOmenActive = (previousState.zeroPityUntilTurn || 0) > (previousState.completedPlayerTurns || 0);
  const cost = favorableOmenActive ? 0 : cardPityCost(card);
  if (outcome.resolution === 'pity') {
    if (before < cost) return 'There are not enough pity points for that card.';
    incomingState.pityPoints = before - cost;
    outcome.success = true;
  } else {
    if (favorableOmenActive) outcome.success = true;
    incomingState.pityPoints = before + (outcome.success ? 0 : 1);
  }
  if (outcome.resolution === 'pity' || cost === 0) outcome.pityCost = cost;
  else delete outcome.pityCost;
  if (favorableOmenActive) incomingState.zeroPityUntilTurn = 0;
  outcome.pityBefore = before;
  outcome.pityAfter = incomingState.pityPoints;
  if (!outcome.success) appendOutcomeNotice(incomingGame, {
    id: `${gameNoticeScope(incomingGame)}-card-failed-${actor.id}`,
    kind: 'card-failed',
    title: 'Card failed',
    detail: `${actor.displayName}'s ${card.name} failed and gained 1 pity point (${before} → ${incomingState.pityPoints}).`
  });
  return '';
}

function reconcileHiddenCardEffects(previousGame, incomingGame, actor) {
  if (!previousGame || !incomingGame || !actor) return;
  const outcome = incomingGame.outcome;
  returnPlayedBorrowedCard(incomingGame, actor.id, outcome?.cardId);
  returnBorrowedCards(incomingGame, actor.id);
  const card = room.players.flatMap((player) => player.skillDeck || []).find((item) => item.id === outcome?.cardId)
    || room.players.flatMap((player) => player.skillDeck || []).find((item) => item.name === outcome?.cardName);
  if (!outcome?.success || card?.effect !== 'support') return;
  const targetName = String(outcome.targetName || '').split(', ')[0];
  const target = room.players.find((player) => player.id === outcome.targetIds?.[0]) || room.players.find((player) => player.displayName === targetName);
  const targetState = target && incomingGame.playerStates[target.id];
  if (!target || !targetState) return;
  let replacementDetail = '';
  if (card.supportType === 'purge-card' && target.id !== actor.id && target.hero.team !== actor.hero.team && (previousGame.playerStates?.[target.id]?.hp || 0) > 0) {
    const candidates = (targetState.hand || []).filter((id) => target.skillDeck.some((item) => item.id === id));
    const removedId = candidates[Math.floor(Math.random() * candidates.length)];
    if (removedId) {
      temporarilyPurgeHandCard(targetState, removedId, Number(previousGame.completedPhases || 0) + 2);
      replacementDetail = `${target.displayName} had one random hand card moved to their graveyard for 2 phases; it will then return to their discard pile.`;
    } else replacementDetail = `${target.displayName} had no eligible card in hand, so Tactical Purge had no effect.`;
  }
  if (card.supportType === 'steal-card' && target.id !== actor.id && target.hero.team !== actor.hero.team && (previousGame.playerStates?.[target.id]?.hp || 0) > 0) {
    const candidates = (targetState.hand || []).filter((id) => target.skillDeck.some((item) => item.id === id));
    const specialCandidates = candidates.filter((id) => target.skillDeck.some((item) => item.id === id && item.unique));
    const preferredCandidates = specialCandidates.length ? specialCandidates : candidates;
    const stolenId = preferredCandidates[Math.floor(Math.random() * preferredCandidates.length)];
    if (stolenId) {
      targetState.hand = targetState.hand.filter((id) => id !== stolenId);
      const actorState = incomingGame.playerStates[actor.id];
      actorState.hand.push(stolenId);
      actorState.borrowedCards = [...(actorState.borrowedCards || []), {
        cardId: stolenId,
        ownerId: target.id,
        borrowedAtTurn: incomingGame.completedTurns,
        expiresAfterBorrowerTurn: (actorState.completedPlayerTurns || 0) + 1
      }];
      replacementDetail = `${actor.displayName} stole one random ${specialCandidates.length ? 'special ' : ''}card from ${target.displayName}; it will return to ${target.displayName}'s discard pile when ${actor.displayName}'s next turn ends.`;
    } else replacementDetail = `${target.displayName} had no eligible card in hand, so Pilfered Chance had no effect.`;
  }
  if (card.supportType === 'zero-pity' && target.hero.team === actor.hero.team && (previousGame.playerStates?.[target.id]?.hp || 0) > 0) {
    targetState.zeroPityUntilTurn = Math.max(
      targetState.zeroPityUntilTurn || 0,
      (targetState.completedPlayerTurns || 0) + 1
    );
    replacementDetail = `${target.displayName}'s next played card during their next turn has 0 pity cost. If they do not play a card, the omen expires at the end of that turn.`;
  }
  if (replacementDetail) {
    incomingGame.outcome.detail = `${actor.displayName} used ${card.name}: ${replacementDetail}`;
    const entry = incomingGame.history?.at(-1);
    if (entry?.kind !== 'world') entry.message = `${actor.displayName} used ${card.name} — ${replacementDetail}`;
  }
}
function removePlayerFromRoom(targetId, removedBy) {
  const removingIndex = room.players.findIndex((player) => player.id === targetId);
  if (removingIndex < 0) return null;
  const removedPlayer = room.players[removingIndex];
  const wasActive = room.phase === 'game' && room.game && removingIndex === room.game.activePlayerIndex;
  const worldEventWasBlocking = room.phase === 'game' && isWorldEventBlocking(room.game);
  room.players.splice(removingIndex, 1);

  if (room.phase === 'game' && room.game) {
    delete room.game.playerStates[targetId];
    room.game.turnOrder = (room.game.turnOrder || []).filter((id) => id !== targetId);
    room.game.roundOrder = (room.game.roundOrder || []).filter((id) => id !== targetId);
    room.game.actedThisRound = (room.game.actedThisRound || []).filter((id) => id !== targetId);
    if (!room.players.length) {
      room.phase = 'lobby';
      room.game = null;
    } else {
      const now = Date.now();
      const fallbackTeam = room.players[0]?.hero.team || removedPlayer.hero.team;
      if (removingIndex < room.game.activePlayerIndex) room.game.activePlayerIndex -= 1;
      else if (wasActive) room.game.activePlayerIndex = Math.min(removingIndex, room.players.length - 1);
      const worldEventResult = removeWorldEventParticipant(room.game, room.players, targetId, { now, lastTeam: fallbackTeam });
      if (wasActive && !room.game.ended && !worldEventWasBlocking) {
        room.game.turnStartedAt = now;
        room.game.turnDeadline = now + TURN_SECONDS * 1000;
        room.game.outcome = {
          kind: 'system',
          success: false,
          total: 0,
          target: room.game.adventure.target,
          label: `${removedPlayer.displayName} was removed`,
          detail: `${removedBy} removed this player. The next turn begins now.`,
          actorName: removedBy
        };
        room.game.history = [...(room.game.history || []), { id: `remove-${now}`, turn: room.game.completedTurns, phase: Math.min(30, (room.game.completedPhases || 0) + 1), kind: 'system', actorName: removedBy, message: `${removedBy} removed ${removedPlayer.displayName} from the battle.`, success: true, createdAt: now }].slice(-80);
      }
      const winner = decideWinner(room.game, fallbackTeam, false);
      if (room.players.length < 2 || winner) {
        room.game.ended = true;
        room.game.winnerTeam = winner || fallbackTeam;
        room.game.endReason = `${teamLabel(room.game.winnerTeam)} wins because the opposing team has no warriors left.`;
        room.game.turnDeadline = 0;
      } else if (room.game.ended) {
        room.game.turnDeadline = 0;
      } else {
        normalizeServerTurnOrder(room.game);
      }
      if (room.game.ended) room.game.pendingWorldEvent = null;
      if (worldEventResult.finalized) appendPhaseStartNotice(room.game);
    }
  }

  return removedPlayer;
}

function expireTimedEffectsAtTurnEnd(state) {
  if (!state) return;
  const completedPlayerTurns = (state.completedPlayerTurns || 0) + 1;
  const effects = [...(state.timedEffects || [])];
  for (const kind of ['shield', 'attackBuff', 'diceBuff', 'dicePenalty']) {
    const tracked = effects.filter((effect) => effect.kind === kind).reduce((sum, effect) => sum + effect.value, 0);
    const untracked = Math.max(0, (state[kind] || 0) - tracked);
    if (untracked > 0) effects.push({ kind, value: untracked, expiresAfterTurn: completedPlayerTurns });
  }
  const keeping = [];
  for (const effect of effects) {
    if (effect.expiresAfterTurn <= completedPlayerTurns) {
      state[effect.kind] = Math.max(0, (state[effect.kind] || 0) - effect.value);
    } else keeping.push(effect);
  }
  state.completedPlayerTurns = completedPlayerTurns;
  if ((state.zeroPityUntilTurn || 0) <= completedPlayerTurns) state.zeroPityUntilTurn = 0;
  state.timedEffects = keeping;
}

async function passCurrentTurn(kind, now = Date.now(), discardedCardName = '', discardedCardId = '') {
  const game = room.game;
  if (room.phase !== 'game' || !game || game.ended || !room.players.length || isWorldEventBlocking(game)) return false;
  const previousCompletedPhases = Number(game.completedPhases || 0);
  const order = normalizeServerTurnOrder(game);
  const passingPlayer = room.players.find((player) => player.id === order[0]) || room.players[game.activePlayerIndex];
  const completedTurns = game.completedTurns + 1;
  const actionPhase = Math.min(30, (game.completedPhases || 0) + 1);
  if (passingPlayer) expireTimedEffectsAtTurnEnd(game.playerStates[passingPlayer.id]);
  if (passingPlayer) returnBorrowedCards(game, passingPlayer.id);
  const revived = tickPendingRevives(game);
  const playerName = passingPlayer?.displayName || 'Player';
  const timedOut = kind === 'timeout';
  const forced = kind === 'forced-skip';
  const discarded = kind === 'discard';
  const outcomeId = `${kind}-${completedTurns}-${now}`;
  game.completedTurns = completedTurns;
  game.adventure = { ...game.adventure, target: randomDiceTarget() };
  game.outcome = { id: outcomeId, kind, success: false, total: 0, target: game.adventure.target, label: discarded ? `${playerName} discarded ${discardedCardName}` : forced ? `${playerName}'s turn was cancelled` : timedOut ? `${playerName} ran out of time` : `${playerName} skipped the turn`, detail: discarded ? `${discardedCardName} entered the discard pile and drew a random replacement when available. Expiring effects ended normally.` : forced ? 'A support effect cancelled this turn. Cards were preserved; expiring effects ended normally.' : timedOut ? 'The turn was automatically passed. No cards were discarded or shuffled; expiring effects ended normally.' : 'The turn was skipped. No cards were discarded or shuffled; expiring effects ended normally.', actorId: passingPlayer?.id, actorName: playerName, cardId: discardedCardId || undefined, cardName: discardedCardName || undefined, lifeEvents: revived.map((player) => ({ id: `life-${completedTurns}-${now}-returning-light-${player.id}`, kind: 'revive', playerId: player.id, playerName: player.displayName, reason: `${player.displayName} returned through Returning Light with one-third HP.` })) };
  game.history = [...(game.history || []), { id: outcomeId, turn: completedTurns, phase: actionPhase, kind, actorName: playerName, actorTeam: passingPlayer?.hero.team, cardName: discardedCardName || undefined, message: discarded ? `${playerName} manually discarded ${discardedCardName} and drew a random replacement when available. Expiring effects ended normally.` : forced ? `${playerName}'s turn was cancelled by an enemy support effect. Their hand was preserved; expiring effects ended normally.` : timedOut ? `${playerName} ran out of time and automatically passed. Their hand was preserved; expiring effects ended normally.` : `${playerName} manually skipped the turn. Their hand was preserved; expiring effects ended normally.`, success: false, createdAt: now }];
  if (revived.length) game.history.push({ id: `revive-${completedTurns}-${now}`, turn: completedTurns, phase: actionPhase, kind: 'system', actorName: 'Returning Light', message: `${revived.map((player) => player.displayName).join(', ')} revived with one-third HP.`, success: true, createdAt: now });
  game.roll = null;
  let phaseCompleted = false;
  if (passingPlayer) {
    rotateServerTurn(game, passingPlayer.id);
    phaseCompleted = completeRoundTurn(game, passingPlayer.id);
  }
  if (phaseCompleted) {
    returnExpiredPurgedCards(game, game.completedPhases);
    upgradePhaseFiveCards(game);
  }
  game.adventure = { ...game.adventure, chapter: Math.min(30, (game.completedPhases || 0) + 1) };
  if (phaseCompleted) resetPhaseTurnOrder(game);
  if (phaseCompleted) triggerWorldEventAfterPhase(game, room.players, previousCompletedPhases, game.completedPhases, {
    now,
    lastTeam: passingPlayer?.hero.team || 'veil'
  });
  game.history = game.history.slice(-80);
  const winner = decideWinner(game, passingPlayer?.hero.team || 'veil', (game.completedPhases || 0) >= 30);
  game.ended = Boolean(winner); game.winnerTeam = winner;
  const veil = teamTotals(game, 'veil'); const ember = teamTotals(game, 'ember');
  game.endReason = winner ? `${teamLabel(winner)} wins. Total HP: Veilbound ${veil.hp} — Embercourt ${ember.hp}.` : null;
  game.turnStartedAt = now;
  game.turnSeconds = TURN_SECONDS;
  game.turnDeadline = winner || isWorldEventBlocking(game) ? 0 : now + TURN_SECONDS * 1000;
  if (phaseCompleted) appendPhaseStartNotice(game);
  await commitRoom();
  if (kind !== 'forced-skip') await advanceForcedSkippedTurns(now + 1);
  return true;
}

async function advanceTimedOutTurn(now = Date.now()) {
  const game = room.game;
  if (room.phase !== 'game' || !game || game.ended || isWorldEventBlocking(game) || !game.turnDeadline || now < game.turnDeadline || !room.players.length) return false;
  return passCurrentTurn('timeout', now);
}

async function advanceActiveDeadline(now = Date.now()) {
  const game = room.game;
  if (room.phase !== 'game' || !game || game.ended || !room.players.length) return false;
  if (!isWorldEventBlocking(game)) return advanceTimedOutTurn(now);
  const result = resolvePendingWorldEventTimeout(game, room.players, { now });
  if (!result.resolved) return false;
  appendPhaseStartNotice(game);
  await commitRoom();
  return true;
}

async function advanceForcedSkippedTurns(now = Date.now()) {
  let advanced = false;
  for (let count = 0; count < room.players.length; count += 1) {
    const game = room.game;
    if (room.phase !== 'game' || !game || game.ended || isWorldEventBlocking(game)) break;
    const order = normalizeServerTurnOrder(game);
    const player = room.players.find((candidate) => candidate.id === order[0]);
    const state = player && game.playerStates[player.id];
    if (!state || !(state.skipTurns > 0)) break;
    state.skipTurns -= 1;
    await passCurrentTurn('forced-skip', now + count);
    advanced = true;
  }
  return advanced;
}

async function applyCommand(ownerId, message, deadlineAdvanced = false) {
  if (message.type === 'join') {
    const player = message.player;
    if (room.phase !== 'lobby') return 'The adventure has already started.';
    if (!player?.id || !player?.displayName || !player?.hero || !Array.isArray(player.skillDeck)) return 'The player session is incomplete.';
    if (!ownerId || ownerId !== player.id) return 'This browser cannot create another browser session.';
    if (room.players.some((current) => current.id === player.id)) return null;
    if (room.players.length >= 10) return 'This lobby already has 10 players.';
    if (room.players.some((current) => current.displayName.toLowerCase() === player.displayName.toLowerCase())) return 'That player name is already joined.';
    if (!['veil', 'ember'].includes(player.hero.team)) return 'Choose an empty Veilbound or Embercourt slot.';
    if (room.players.filter((current) => current.hero.team === player.hero.team).length >= 5) return `${teamLabel(player.hero.team)} already has five players.`;
    room.players.push({ ...player, ready: false });
    await commitRoom();
    return null;
  }

  if (message.type === 'ready') {
    if (room.phase !== 'lobby') return 'Readiness can only change in the lobby.';
    if (!ownerId || ownerId !== message.sessionId) return 'You can only ready your own player.';
    const player = room.players.find((current) => current.id === message.sessionId);
    if (!player) return 'Join the lobby before pressing Ready.';
    player.ready = typeof message.ready === 'boolean' ? message.ready : !player.ready;
    await commitRoom();
    return null;
  }

  if (message.type === 'character') {
    if (room.phase !== 'lobby') return 'Characters can only change in the lobby.';
    if (!ownerId || ownerId !== message.sessionId) return 'You can only change your own character.';
    const player = room.players.find((current) => current.id === message.sessionId);
    if (!player) return 'Join the lobby before changing characters.';
    if (player.ready) return 'Cancel Ready before changing characters.';
    const selection = message.player;
    if (!selection?.hero || !Array.isArray(selection.skillDeck) || selection.skillDeck.length !== 10
      || selection.id !== player.id || selection.displayName !== player.displayName || selection.hero.team !== player.hero.team) {
      return 'The character selection is incomplete.';
    }
    player.hero = selection.hero;
    player.skillDeck = selection.skillDeck;
    player.randomHero = Boolean(selection.randomHero);
    await commitRoom();
    return null;
  }

  if (message.type === 'team') {
    if (room.phase !== 'lobby') return 'Teams can only change in the lobby.';
    if (!ownerId || ownerId !== message.sessionId) return 'You can only move your own player.';
    if (!['veil', 'ember'].includes(message.team)) return 'Choose an empty Veilbound or Embercourt slot.';
    const player = room.players.find((current) => current.id === message.sessionId);
    if (!player) return 'Join the lobby before switching teams.';
    if (player.ready) return 'Cancel Ready before switching teams.';
    if (player.hero.team === message.team) return null;
    if (room.players.filter((current) => current.hero.team === message.team).length >= 5) return `${teamLabel(message.team)} already has five players.`;
    player.hero.team = message.team;
    await commitRoom();
    return null;
  }

  if (message.type === 'leave') {
    if (room.phase !== 'lobby') return 'Players cannot leave during an active adventure.';
    if (!ownerId || ownerId !== message.sessionId) return 'You can only remove your own player.';
    room.players = room.players.filter((current) => current.id !== message.sessionId);
    await commitRoom();
    return null;
  }

  if (message.type === 'remove-player') {
    const requester = room.players.find((player) => player.id === ownerId);
    if (!ownerId || ownerId !== message.sessionId || !requester) return 'Only a joined player can remove another player.';
    if (message.targetSessionId === ownerId) return 'Use Leave to remove your own player.';
    const removed = removePlayerFromRoom(String(message.targetSessionId || ''), requester.displayName);
    if (!removed) return 'That player is no longer in the room.';
    await commitRoom();
    return null;
  }

  if (message.type === 'start') {
    if (room.phase !== 'lobby') return null;
    if (room.players.length < 2) return 'At least two players must join.';
    if (!room.players.some((player) => player.hero.team === 'veil') || !room.players.some((player) => player.hero.team === 'ember')) return 'At least one player must join each team.';
    if (!room.players.every((player) => player.ready)) return 'Every joined player must be ready.';
    if (!message.game?.adventure) return 'The adventure state is missing.';
    if (room.players.some((player) => player.randomHero)) {
      if (!Array.isArray(message.players) || message.players.length !== room.players.length) return 'Random characters must be assigned when the battle starts.';
      const resolvedPlayers = room.players.map((current) => message.players.find((candidate) => candidate?.id === current.id));
      const invalidResolution = resolvedPlayers.some((resolved, index) => {
        const current = room.players[index];
        return !resolved?.hero || !Array.isArray(resolved.skillDeck) || resolved.skillDeck.length !== 10
          || resolved.displayName !== current.displayName || resolved.hero.team !== current.hero.team
          || resolved.randomHero || (!current.randomHero && resolved.hero.name !== current.hero.name);
      });
      if (invalidResolution) return 'The random character assignment is invalid.';
      room.players = resolvedPlayers.map((player, index) => ({ ...player, ready: room.players[index].ready, joinedAt: room.players[index].joinedAt, randomHero: false }));
    }
    room.phaseFiveOriginalCards = Object.fromEntries(room.players.map((player) => [player.id, structuredClone(phaseFiveSourceCards(player.skillDeck))]));
    room.phase = 'game';
    room.game = message.game;
    initializeNewBattleWorldEvents(room.game);
    room.game.adventure.target = randomDiceTarget();
    room.game.turnSeconds = TURN_SECONDS;
    room.game.turnStartedAt = Date.now();
    room.game.turnDeadline = room.game.turnStartedAt + TURN_SECONDS * 1000;
    normalizeServerTurnOrder(room.game);
    appendPhaseStartNotice(room.game);
    await commitRoom();
    return null;
  }

  if (message.type === 'world-event:choose') {
    if (deadlineAdvanced) return 'The battle state advanced at the deadline. Refresh the room before taking another action.';
    if (room.phase !== 'game' || !room.game) return 'There is no active adventure.';
    if (room.game.ended) return 'The battle has already ended.';
    if (!ownerId || ownerId !== message.sessionId) return 'You can only submit your own World Event choice.';
    const player = room.players.find((candidate) => candidate.id === ownerId);
    if (!player) return 'Join the battle before submitting a World Event choice.';
    const now = Date.now();
    const result = submitWorldEventChoice(room.game, room.players, ownerId, message.eventId, message.cardIds, {
      now,
      lastTeam: player.hero.team
    });
    if (!result.ok) return result.error;
    if (result.finalized) appendPhaseStartNotice(room.game);
    await commitRoom();
    if (result.finalized) await advanceForcedSkippedTurns(now + 1);
    return null;
  }

  if (message.type === 'game:update') {
    if (deadlineAdvanced) return 'The battle state advanced at the deadline. Refresh the room before taking another action.';
    if (room.phase !== 'game' || !room.game) return 'There is no active adventure.';
    if (room.game.ended) return 'The battle has already ended.';
    if (isWorldEventBlocking(room.game)) return 'The pending World Event must be resolved before normal battle actions can continue.';
    const order = normalizeServerTurnOrder(room.game);
    const activePlayer = room.players.find((player) => player.id === order[0]) || room.players[room.game.activePlayerIndex];
    if (!activePlayer || ownerId !== activePlayer.id) return 'Only the current player can resolve this turn.';
    if (!message.game?.adventure) return 'The turn update is incomplete.';
    if ((room.game.playerStates[activePlayer.id]?.hp || 0) <= 0) return 'A defeated player cannot play a card.';
    const previousGame = room.game;
    const acknowledgedWorldEventId = message.game.worldEvent?.id || null;
    const authoritativeWorldEventId = previousGame.worldEvent?.id || null;
    if (acknowledgedWorldEventId !== authoritativeWorldEventId) {
      return 'The World Event state changed. Refresh the room before taking another action.';
    }
    const previousCompletedPhases = Number(previousGame.completedPhases || 0);
    const incomingCompletedPhases = Number(message.game.completedPhases);
    const authoritativePhase = deriveAuthoritativePlayedPhase(previousGame, message.game, activePlayer);
    if (!Number.isInteger(incomingCompletedPhases)
      || incomingCompletedPhases !== authoritativePhase.completedPhases) {
      return 'The turn update contains an impossible phase jump.';
    }
    const phaseAdvanced = authoritativePhase.phaseCompleted;
    const authoritativeWorldEvents = captureAuthoritativeWorldEventState(previousGame);
    restoreAuthoritativeWorldEventState(message.game, authoritativeWorldEvents);
    message.game.completedPhases = authoritativePhase.completedPhases;
    message.game.roundNumber = authoritativePhase.roundNumber;
    message.game.actedThisRound = authoritativePhase.actedThisRound;
    message.game.adventure = { ...message.game.adventure, chapter: Math.min(30, authoritativePhase.completedPhases + 1) };
    for (const [id, state] of Object.entries(room.game.playerStates || {})) {
      const incomingState = message.game.playerStates?.[id];
      if (!incomingState) continue;
      incomingState.purgedCards = [...(state.purgedCards || [])];
      incomingState.borrowedCards = [...(state.borrowedCards || [])];
      incomingState.zeroPityUntilTurn = state.zeroPityUntilTurn || 0;
      if (id !== activePlayer.id) {
        incomingState.hand = [...(state.hand || [])];
        incomingState.drawPile = [...(state.drawPile || [])];
        incomingState.discardPile = [...(state.discardPile || [])];
        incomingState.graveyard = [...(state.graveyard || [])];
        incomingState.cardUses = { ...(state.cardUses || {}) };
        incomingState.pityPoints = Math.max(0, Math.floor(Number(state.pityPoints) || 0));
      }
    }
    if (message.game.outcome) message.game.outcome.notices = [];
    const pityError = reconcilePityPoints(previousGame, message.game, activePlayer);
    if (pityError) return pityError;
    reconcileHiddenCardEffects(previousGame, message.game, activePlayer);
    if (phaseAdvanced) returnExpiredPurgedCards(message.game, message.game.completedPhases);
    message.game.adventure.target = randomDiceTarget();
    if (message.game.outcome?.kind === 'card') message.game.outcome.nextTarget = message.game.adventure.target;
    room.game = message.game;
    room.game.turnSeconds = TURN_SECONDS;
    const actionWinner = decideWinner(room.game, activePlayer.hero.team, (room.game.completedPhases || 0) >= 30);
    room.game.ended = Boolean(actionWinner);
    room.game.winnerTeam = actionWinner;
    const veil = teamTotals(room.game, 'veil');
    const ember = teamTotals(room.game, 'ember');
    room.game.endReason = actionWinner ? `${teamLabel(actionWinner)} wins. Total HP: Veilbound ${veil.hp} â€” Embercourt ${ember.hp}.` : null;
    const now = Date.now();
    room.game.turnStartedAt = now;
    normalizeServerTurnOrder(room.game);
    if (phaseAdvanced) resetPhaseTurnOrder(room.game);
    if (phaseAdvanced && !actionWinner) triggerWorldEventAfterPhase(room.game, room.players, previousCompletedPhases, incomingCompletedPhases, {
      now,
      lastTeam: activePlayer.hero.team
    });
    room.game.turnDeadline = room.game.ended || isWorldEventBlocking(room.game) ? 0 : now + TURN_SECONDS * 1000;
    if (phaseAdvanced) appendPhaseStartNotice(room.game);
    await commitRoom();
    await advanceForcedSkippedTurns();
    return null;
  }

  if (message.type === 'skip-turn') {
    if (deadlineAdvanced) return 'The battle state advanced at the deadline. Refresh the room before taking another action.';
    if (room.phase !== 'game' || !room.game) return 'There is no active adventure.';
    if (room.game.ended) return 'The battle has already ended.';
    if (isWorldEventBlocking(room.game)) return 'The pending World Event must be resolved before normal battle actions can continue.';
    const order = normalizeServerTurnOrder(room.game);
    const activePlayer = room.players.find((player) => player.id === order[0]) || room.players[room.game.activePlayerIndex];
    if (!activePlayer || ownerId !== activePlayer.id || ownerId !== message.sessionId) return 'Only the current player can skip this turn.';
    if ((room.game.playerStates[activePlayer.id]?.hp || 0) <= 0) return 'A defeated player cannot skip a turn.';
    await passCurrentTurn('skip');
    return null;
  }

  if (message.type === 'discard-card') {
    if (deadlineAdvanced) return 'The battle state advanced at the deadline. Refresh the room before taking another action.';
    if (room.phase !== 'game' || !room.game) return 'There is no active adventure.';
    if (room.game.ended) return 'The battle has already ended.';
    if (isWorldEventBlocking(room.game)) return 'The pending World Event must be resolved before normal battle actions can continue.';
    const order = normalizeServerTurnOrder(room.game);
    const activePlayer = room.players.find((player) => player.id === order[0]) || room.players[room.game.activePlayerIndex];
    if (!activePlayer || ownerId !== activePlayer.id || ownerId !== message.sessionId) return 'Only the current player can discard a card.';
    const state = room.game.playerStates[activePlayer.id];
    if (!state || state.hp <= 0) return 'A defeated player cannot discard a card.';
    if (!state.hand.includes(message.cardId)) return 'Choose a card from your hand to discard.';
    const card = activePlayer.skillDeck.find((item) => item.id === message.cardId);
    const borrowed = (state.borrowedCards || []).find((entry) => entry.cardId === message.cardId);
    const discardedIndex = state.hand.indexOf(message.cardId);
    state.hand = state.hand.filter((id) => id !== message.cardId);
    if (borrowed) {
      state.borrowedCards = state.borrowedCards.filter((entry) => entry.cardId !== message.cardId);
      const owner = room.game.playerStates[borrowed.ownerId];
      if (owner && !owner.discardPile.includes(message.cardId)) {
        owner.discardPile.push(message.cardId);
      }
    } else state.discardPile.push(message.cardId);
    drawOneOrRecycleDiscard(state, discardedIndex >= 0 ? discardedIndex : state.hand.length);
    await passCurrentTurn('discard', Date.now(), card?.name || 'a card', message.cardId);
    return null;
  }

  if (message.type === 'expire-turn') {
    if (isWorldEventBlocking(room.game)) return 'The pending World Event must be resolved before normal battle actions can continue.';
    return null;
  }

  if (message.type === 'end-game') {
    if (room.phase !== 'game' || !room.game) return 'There is no active adventure.';
    if (!ownerId || ownerId !== message.sessionId || !room.players.some((player) => player.id === ownerId)) return 'Only a joined player can end the game.';
    const player = room.players.find((current) => current.id === ownerId);
    const winner = decideWinner(room.game, player?.hero.team || 'veil', true);
    const veil = teamTotals(room.game, 'veil');
    const ember = teamTotals(room.game, 'ember');
    room.game.ended = true;
    room.game.winnerTeam = winner;
    room.game.endReason = `${teamLabel(winner)} wins. Total HP: Veilbound ${veil.hp} — Embercourt ${ember.hp}. Battle ended by ${player?.displayName || 'a player'}.`;
    room.game.pendingWorldEvent = null;
    room.game.turnDeadline = 0;
    await commitRoom();
    return null;
  }

  if (message.type === 'leave-game') {
    if (room.phase !== 'game' || !room.game) return 'There is no active adventure.';
    if (!ownerId || ownerId !== message.sessionId) return 'You can only remove your own player.';
    const leavingIndex = room.players.findIndex((player) => player.id === ownerId);
    if (leavingIndex < 0) return 'That player is not in the adventure.';
    const wasActive = leavingIndex === room.game.activePlayerIndex;
    const worldEventWasBlocking = isWorldEventBlocking(room.game);
    room.players.splice(leavingIndex, 1);
    delete room.game.playerStates[ownerId];
    room.game.turnOrder = (room.game.turnOrder || []).filter((id) => id !== ownerId);
    room.game.roundOrder = (room.game.roundOrder || []).filter((id) => id !== ownerId);
    room.game.actedThisRound = (room.game.actedThisRound || []).filter((id) => id !== ownerId);
    if (!room.players.length) {
      room.phase = 'lobby';
      room.game = null;
    } else {
      if (leavingIndex < room.game.activePlayerIndex) room.game.activePlayerIndex -= 1;
      else if (wasActive) room.game.activePlayerIndex = Math.min(leavingIndex, room.players.length - 1);
      const now = Date.now();
      const fallbackTeam = room.players[0]?.hero.team || null;
      const worldEventResult = removeWorldEventParticipant(room.game, room.players, ownerId, { now, lastTeam: fallbackTeam });
      if (!worldEventWasBlocking && !room.game.ended) {
        room.game.turnStartedAt = now;
        room.game.turnDeadline = now + TURN_SECONDS * 1000;
      }
      if (room.players.length < 2) {
        room.game.ended = true;
        room.game.winnerTeam = room.players[0]?.hero.team || null;
        room.game.endReason = room.game.winnerTeam ? `${teamLabel(room.game.winnerTeam)} wins because the opposing team has no warriors left.` : 'The battle has ended.';
        room.game.turnDeadline = 0;
      } else if (!room.game.ended) {
        const winner = decideWinner(room.game, fallbackTeam, false);
        if (winner) { room.game.ended = true; room.game.winnerTeam = winner; room.game.endReason = `${teamLabel(winner)} wins because the opposing team has no warriors left.`; room.game.turnDeadline = 0; }
        else normalizeServerTurnOrder(room.game);
      }
      if (room.game.ended) room.game.pendingWorldEvent = null;
      if (worldEventResult.finalized) appendPhaseStartNotice(room.game);
    }
    await commitRoom();
    return null;
  }

  if (message.type === 'return:lobby') {
    room.phase = 'lobby';
    room.game = null;
    restorePhaseFiveOriginalCards();
    await commitRoom();
    return null;
  }

  return 'The shared room does not recognize that action.';
}

async function handleSocketMessage(socket, text) {
  let message;
  try {
    message = JSON.parse(text);
  } catch {
    send(socket, { type: 'error', message: 'The room received an invalid message.' });
    return;
  }
  if (message.type === 'hello') {
    peers.set(socket, String(message.sessionId || ''));
    send(socket, { type: 'state', state: publicState(String(message.sessionId || '')) });
    return;
  }
  await hydrateRoom();
  const deadlineAdvanced = await advanceActiveDeadline();
  const error = await applyCommand(peers.get(socket), message, deadlineAdvanced);
  if (error) send(socket, { type: 'error', message: error });
  else send(socket, { type: 'state', state: publicState(peers.get(socket) || '') });
}

async function connectWebSocket() {
  await hydrateRoom();
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  server.accept();
  peers.set(server, '');
  server.addEventListener('message', (event) => {
    void serialized(() => handleSocketMessage(server, event.data));
  });
  server.addEventListener('close', () => peers.delete(server));
  server.addEventListener('error', () => peers.delete(server));
  return new Response(null, { status: 101, webSocket: client });
}

function json(payload, status = 200) {
  return Response.json(payload, { status, headers: { 'Cache-Control': 'no-store', 'Content-Language': 'en' } });
}

function withAssetHeaders(response, pathname) {
  const headers = new Headers(response.headers);
  headers.set('Content-Language', 'en');
  const contentType = headers.get('Content-Type') || '';
  if (contentType.includes('text/html')) {
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
  } else if (/_next\/static\//.test(pathname)) {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function handleRoomApi(request) {
  await hydrateRoom();
  const deadlineAdvanced = await advanceActiveDeadline();
  const requestUrl = new URL(request.url);
  const viewerId = requestUrl.searchParams.get('sessionId') || '';
  if (request.method === 'GET') return json({ state: publicState(viewerId) });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  let message;
  try {
    message = await request.json();
  } catch {
    return json({ error: 'The room received an invalid message.', state: publicState(viewerId) }, 400);
  }
  const requesterId = String(message.sessionId || '');
  const error = await applyCommand(requesterId, message, deadlineAdvanced);
  return json({ state: publicState(requesterId), error: error || null }, error ? 400 : 200);
}

async function handleRoomRequest(request) {
  const url = new URL(request.url);
  if (url.pathname === '/api/room') return serialized(() => handleRoomApi(request));
  if (url.pathname === '/ws') {
    return serialized(() => connectWebSocket());
  }
  return json({ error: 'Room route not found.' }, 404);
}

function proxyRoomRequest(request, origin) {
  const upstream = new URL(request.url);
  const target = new URL(origin);
  upstream.protocol = target.protocol;
  upstream.host = target.host;
  return fetch(new Request(upstream, request));
}

export class GameRoom {
  constructor(state) {
    durableStorage = state.storage;
    this.ready = state.blockConcurrencyWhile(async () => {
      const stored = await durableStorage.get('shared-room');
      if (stored && Array.isArray(stored.players)) {
        room = stored;
        if (room.game) normalizeWorldEventState(room.game);
      }
    });
  }

  async fetch(request) {
    await this.ready;
    return handleRoomRequest(request);
  }

  async alarm() {
    await this.ready;
    await serialized(async () => {
      await hydrateRoom();
      await advanceActiveDeadline();
    });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/realtime-config') {
      return json({ origin: env.REALTIME_ORIGIN || url.origin });
    }
    if (url.pathname === '/api/room' || url.pathname === '/ws') {
      if (env.GAME_ROOM) {
        const id = env.GAME_ROOM.idFromName('shared-room');
        return env.GAME_ROOM.get(id).fetch(request);
      }
      if (env.REALTIME_ORIGIN) return proxyRoomRequest(request, env.REALTIME_ORIGIN);
      return handleRoomRequest(request);
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) return withAssetHeaders(response, url.pathname);
    if (!url.pathname.includes('.')) {
      url.pathname = '/index.html';
      return withAssetHeaders(await env.ASSETS.fetch(new Request(url, request)), url.pathname);
    }
    return withAssetHeaders(response, url.pathname);
  }
};
