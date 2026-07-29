import {
  getWorldEventDefinition,
  getWorldEventScheduleEntry
} from '../shared/worldEvents.mjs';

export const WORLD_EVENT_CHOICE_SECONDS = 60;
const TIMED_FIELDS = ['shield', 'attackBuff', 'diceBuff', 'dicePenalty'];

function defaultRandomInt(minimum, maximum) {
  const lower = Math.ceil(minimum);
  const upper = Math.floor(maximum);
  const span = upper - lower + 1;
  if (span <= 0 || span > 0x100000000) throw new RangeError('Invalid World Event random range.');
  if (!globalThis.crypto?.getRandomValues) return lower + Math.floor(Math.random() * span);
  const values = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / span) * span;
  do globalThis.crypto.getRandomValues(values); while (values[0] >= limit);
  return lower + (values[0] % span);
}

function randomInt(options, minimum, maximum) {
  return (options?.randomInt || defaultRandomInt)(minimum, maximum);
}

function pickRandom(items, options) {
  return items.length ? items[randomInt(options, 0, items.length - 1)] : undefined;
}

function shuffle(items, options) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = randomInt(options, 0, index);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function sample(items, count, options) {
  const pool = [...items];
  const selected = [];
  while (selected.length < count && pool.length) {
    selected.push(pool.splice(randomInt(options, 0, pool.length - 1), 1)[0]);
  }
  return selected;
}

const asNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const teamLabel = (team) => team === 'veil' ? 'Veilbound' : 'Embercourt';
const livingPlayers = (game, players) => players.filter((player) => (game.playerStates?.[player.id]?.hp || 0) > 0);

function definitionFromLegacy(event) {
  if (!event) return null;
  const title = String(event.title || '').toLocaleLowerCase();
  const phase = asNumber(event.phase ?? event.turn, 0);
  const schedule = getWorldEventScheduleEntry(phase);
  return schedule?.eventKeys
    .map((key) => getWorldEventDefinition(key))
    .find((candidate) => candidate?.title.toLocaleLowerCase() === title) || null;
}

function normalizeResolvedEvent(event) {
  if (!event) return null;
  const matched = getWorldEventDefinition(event.eventKey) || definitionFromLegacy(event);
  const phase = Math.max(0, Math.floor(asNumber(event.phase ?? event.turn, matched?.phase || 0)));
  const level = Math.max(1, Math.floor(asNumber(event.level, matched?.level || 1)));
  const intensityByLevel = ['Opening', 'Opening', 'Minor', 'Moderate', 'Strong', 'Severe', 'Catastrophic'];
  const description = String(event.description || matched?.shortDescription || 'A legacy World Event was resolved.');
  return {
    ...event,
    id: String(event.id || `legacy-world-${phase}-${asNumber(event.resolvedAt, 0)}`),
    eventKey: event.eventKey || matched?.key || 'legacy-world-event',
    phase,
    turn: phase,
    level,
    intensity: event.intensity || matched?.intensity || intensityByLevel[Math.min(6, level)],
    title: String(event.title || matched?.title || 'Legacy World Event'),
    description,
    fullDescription: String(event.fullDescription || matched?.fullDescription || description),
    interactive: Boolean(event.interactive ?? matched?.interactive),
    startedAt: asNumber(event.startedAt, asNumber(event.resolvedAt, 0)),
    resolvedAt: asNumber(event.resolvedAt, asNumber(event.startedAt, 0)),
    results: Array.isArray(event.results) ? event.results : [],
    teamSummaries: Array.isArray(event.teamSummaries) ? event.teamSummaries : []
  };
}

export function normalizeWorldEventState(game) {
  if (!game) return game;
  const current = normalizeResolvedEvent(game.worldEvent);
  const sourceHistory = Array.isArray(game.worldEventHistory)
    ? game.worldEventHistory
    : current ? [current] : [];
  const deduped = [];
  for (const event of sourceHistory.map(normalizeResolvedEvent).filter(Boolean)) {
    const existing = deduped.findIndex((candidate) => candidate.id === event.id);
    if (existing >= 0) deduped[existing] = event;
    else deduped.push(event);
  }
  game.worldEventHistory = deduped.slice(-6);
  game.worldEvent = current || game.worldEventHistory.at(-1) || null;
  if (!game.pendingWorldEvent || typeof game.pendingWorldEvent !== 'object') game.pendingWorldEvent = null;
  else {
    const pending = game.pendingWorldEvent;
    const definition = getWorldEventDefinition(pending.eventKey);
    pending.id = String(pending.id || `world-${pending.phase || definition?.phase || 0}-${pending.eventKey || 'pending'}`);
    pending.phase = Math.max(0, Math.floor(asNumber(pending.phase ?? pending.turn, definition?.phase || 0)));
    pending.turn = pending.phase;
    pending.level = Math.max(1, Math.floor(asNumber(pending.level, definition?.level || 1)));
    pending.intensity = pending.intensity || definition?.intensity || 'Opening';
    pending.title = String(pending.title || definition?.title || 'World Event');
    pending.description = String(pending.description || definition?.shortDescription || 'A World Event is waiting to resolve.');
    pending.fullDescription = String(pending.fullDescription || definition?.fullDescription || pending.description);
    pending.status = 'pending';
    pending.requiredPlayerIds = [...new Set(Array.isArray(pending.requiredPlayerIds) ? pending.requiredPlayerIds : [])];
    pending.submittedPlayerIds = [...new Set(Array.isArray(pending.submittedPlayerIds) ? pending.submittedPlayerIds : [])]
      .filter((id) => pending.requiredPlayerIds.includes(id));
    pending.autoResolvedPlayerIds = [...new Set(Array.isArray(pending.autoResolvedPlayerIds) ? pending.autoResolvedPlayerIds : [])]
      .filter((id) => pending.requiredPlayerIds.includes(id));
    pending.startedAt = asNumber(pending.startedAt, 0);
    pending.deadlineAt = asNumber(pending.deadlineAt, pending.startedAt + WORLD_EVENT_CHOICE_SECONDS * 1000);
    pending.results = Array.isArray(pending.results) ? pending.results : [];
  }
  return game;
}

export function initializeNewBattleWorldEvents(game) {
  if (!game) return game;
  game.worldEvent = null;
  game.worldEventHistory = [];
  game.pendingWorldEvent = null;
  return game;
}

export function captureAuthoritativeWorldEventState(game) {
  normalizeWorldEventState(game);
  return {
    worldEvent: game.worldEvent ? structuredClone(game.worldEvent) : null,
    worldEventHistory: structuredClone(game.worldEventHistory || []),
    pendingWorldEvent: game.pendingWorldEvent ? structuredClone(game.pendingWorldEvent) : null,
    publicWorldHistoryEntries: structuredClone((game.history || []).filter((entry) => entry?.kind === 'world'))
  };
}

export function restoreAuthoritativeWorldEventState(game, captured) {
  if (!game || !captured) return game;
  game.worldEvent = captured.worldEvent ? structuredClone(captured.worldEvent) : null;
  game.worldEventHistory = structuredClone(captured.worldEventHistory || []);
  game.pendingWorldEvent = captured.pendingWorldEvent ? structuredClone(captured.pendingWorldEvent) : null;
  const publicWorldHistoryEntries = structuredClone(captured.publicWorldHistoryEntries || []);
  const authoritativeWorldHistoryIds = new Set(publicWorldHistoryEntries.map((entry) => entry?.id).filter(Boolean));
  const ordinaryHistory = (Array.isArray(game.history) ? game.history : [])
    .filter((entry) => entry?.kind !== 'world' && !authoritativeWorldHistoryIds.has(entry?.id));
  game.history = [...ordinaryHistory, ...publicWorldHistoryEntries]
    .sort((left, right) => Number(left?.createdAt || 0) - Number(right?.createdAt || 0))
    .slice(-80);
  return normalizeWorldEventState(game);
}

function sanitizeResult(result, viewerId) {
  const sanitized = { ...result };
  const privateRedrawnCardCount = sanitized.redrawnCardCountPrivate === true;
  delete sanitized.redrawnCardCountPrivate;
  if (result.playerId !== viewerId) {
    delete sanitized.privateSummary;
    delete sanitized.privateCardIds;
    delete sanitized.privateCardNames;
    if (privateRedrawnCardCount) delete sanitized.redrawnCardCount;
  }
  return sanitized;
}

function sanitizeResolvedEvent(event, viewerId) {
  if (!event) return null;
  return { ...event, results: (event.results || []).map((result) => sanitizeResult(result, viewerId)) };
}

export function sanitizeWorldEventGame(game, viewerId = '') {
  if (!game) return game;
  normalizeWorldEventState(game);
  const pending = game.pendingWorldEvent ? { ...game.pendingWorldEvent } : null;
  if (pending) delete pending.results;
  return {
    ...game,
    worldEvent: sanitizeResolvedEvent(game.worldEvent, viewerId),
    worldEventHistory: (game.worldEventHistory || []).map((event) => sanitizeResolvedEvent(event, viewerId)),
    pendingWorldEvent: pending
  };
}

export function isWorldEventBlocking(game) {
  return Boolean(game?.pendingWorldEvent?.status === 'pending');
}

export function getActiveBattleDeadline(game) {
  return game?.pendingWorldEvent?.deadlineAt || game?.turnDeadline || 0;
}

function ensureState(state) {
  state.hand ||= [];
  state.drawPile ||= [];
  state.discardPile ||= [];
  state.graveyard ||= [];
  state.borrowedCards ||= [];
  state.timedEffects ||= [];
  state.pityPoints = Math.max(0, Math.floor(asNumber(state.pityPoints, 0)));
  state.skipTurns = Math.max(0, Math.floor(asNumber(state.skipTurns, 0)));
  for (const field of TIMED_FIELDS) state[field] = Math.max(0, asNumber(state[field], 0));
  return state;
}

function addTimedEffect(state, kind, value) {
  ensureState(state);
  const amount = Math.max(0, asNumber(value, 0));
  if (!amount) return;
  state[kind] += amount;
  state.timedEffects.push({ kind, value: amount, expiresAfterTurn: (state.completedPlayerTurns || 0) + 1 });
}

function clearTimedEffect(state, kind) {
  ensureState(state);
  state[kind] = 0;
  state.timedEffects = state.timedEffects.filter((effect) => effect.kind !== kind);
}

function removeTimedEffectAmount(state, kind, value) {
  ensureState(state);
  let remaining = Math.min(state[kind], Math.max(0, asNumber(value, 0)));
  const removedTotal = remaining;
  state[kind] = Math.max(0, state[kind] - remaining);
  state.timedEffects = state.timedEffects.map((effect) => {
    if (effect.kind !== kind || remaining <= 0) return effect;
    const removed = Math.min(remaining, Math.max(0, asNumber(effect.value, 0)));
    remaining -= removed;
    return { ...effect, value: effect.value - removed };
  }).filter((effect) => effect.value > 0);
  let trackedLimit = state[kind];
  state.timedEffects = state.timedEffects.map((effect) => {
    if (effect.kind !== kind) return effect;
    const value = Math.min(effect.value, Math.max(0, trackedLimit));
    trackedLimit -= value;
    return { ...effect, value };
  }).filter((effect) => effect.value > 0);
  return removedTotal;
}

function drawReplacement(state, handIndex, options) {
  ensureState(state);
  if (!state.drawPile.length && state.discardPile.length) {
    state.drawPile = shuffle(state.discardPile, options);
    state.discardPile = [];
  }
  if (state.drawPile.length) {
    const index = randomInt(options, 0, state.drawPile.length - 1);
    const cardId = state.drawPile.splice(index, 1)[0];
    state.hand.splice(Math.min(Math.max(0, handIndex), state.hand.length), 0, cardId);
    return 1;
  }
  return 0;
}

function cardDefinition(player, cardId) {
  return (player?.skillDeck || []).find((card) => card.id === cardId);
}

const REUSABLE_CARD_ZONES = ['hand', 'drawPile', 'discardPile'];

function ownedCardOccurrences(player, state) {
  ensureState(state);
  const borrowedRemaining = new Map();
  for (const entry of state.borrowedCards) {
    if (!entry?.cardId) continue;
    borrowedRemaining.set(entry.cardId, (borrowedRemaining.get(entry.cardId) || 0) + 1);
  }
  const occurrences = [];
  for (const zone of REUSABLE_CARD_ZONES) {
    const cardIds = state[zone];
    const borrowedIndexes = new Set();
    for (let index = cardIds.length - 1; index >= 0; index -= 1) {
      const cardId = cardIds[index];
      const remaining = borrowedRemaining.get(cardId) || 0;
      if (!remaining) continue;
      borrowedIndexes.add(index);
      borrowedRemaining.set(cardId, remaining - 1);
    }
    for (let index = 0; index < cardIds.length; index += 1) {
      const cardId = cardIds[index];
      const card = cardDefinition(player, cardId);
      if (card && !borrowedIndexes.has(index)) occurrences.push({ cardId, card, zone, index });
    }
  }
  return occurrences;
}

export function getEligibleTributeCardIds(player, state) {
  if (!player || !state) return [];
  return ownedCardOccurrences(player, state)
    .filter((occurrence) => !occurrence.card.unique)
    .map((occurrence) => occurrence.cardId);
}

function eligibleOwnedCardsInZone(player, state, zone, commonOnly = false) {
  return ownedCardOccurrences(player, state)
    .filter((occurrence) => occurrence.zone === zone && (!commonOnly || !occurrence.card.unique))
    .map((occurrence) => occurrence.cardId);
}

function destroyCardsBatch(player, state, cardIds, options) {
  ensureState(state);
  const selected = [...new Set(cardIds)];
  const available = ownedCardOccurrences(player, state);
  const targets = selected.map((cardId) => available.find((occurrence) => occurrence.cardId === cardId)).filter(Boolean);
  const handPositions = targets
    .filter((occurrence) => occurrence.zone === 'hand')
    .map((occurrence) => ({ cardId: occurrence.cardId, index: occurrence.index }))
    .sort((left, right) => left.index - right.index);
  const ids = targets.map((occurrence) => occurrence.cardId);
  const names = targets.map((occurrence) => occurrence.card.name || 'Unknown card');
  for (const zone of REUSABLE_CARD_ZONES) {
    const inZone = targets.filter((occurrence) => occurrence.zone === zone).sort((left, right) => right.index - left.index);
    for (const occurrence of inZone) state[zone].splice(occurrence.index, 1);
  }
  for (const cardId of ids) {
    if (!state.graveyard.includes(cardId)) state.graveyard.push(cardId);
  }
  let redrawn = 0;
  for (const entry of handPositions) {
    redrawn += drawReplacement(state, entry.index, options);
  }
  return { ids, names, redrawn };
}

function discardAndReplace(player, state, cardId, options) {
  const occurrence = ownedCardOccurrences(player, state)
    .find((candidate) => candidate.zone === 'hand' && candidate.cardId === cardId);
  if (!occurrence) return { redrawn: 0, name: '' };
  const handIndex = occurrence.index;
  state.hand.splice(handIndex, 1);
  if (!state.discardPile.includes(cardId)) state.discardPile.push(cardId);
  return { redrawn: drawReplacement(state, handIndex, options), name: occurrence.card.name || 'Unknown card' };
}

function stateSnapshot(state) {
  return {
    hp: asNumber(state.hp),
    shield: asNumber(state.shield),
    pityPoints: asNumber(state.pityPoints),
    attackBuff: asNumber(state.attackBuff),
    diceBuff: asNumber(state.diceBuff),
    dicePenalty: asNumber(state.dicePenalty),
    skipTurns: asNumber(state.skipTurns)
  };
}

function resultFromDetail(player, state, before, detail = {}) {
  return {
    playerId: player.id,
    playerName: player.displayName,
    team: player.hero.team,
    publicSummary: detail.publicSummary || `${player.displayName} was affected.`,
    privateSummary: detail.privateSummary || detail.publicSummary || `${player.displayName} was affected.`,
    hpChange: asNumber(state.hp) - before.hp,
    shieldChange: asNumber(state.shield) - before.shield,
    pityChange: asNumber(state.pityPoints) - before.pityPoints,
    attackBonusChange: asNumber(state.attackBuff) - before.attackBuff,
    diceBonusChange: asNumber(state.diceBuff) - before.diceBuff,
    dicePenaltyChange: asNumber(state.dicePenalty) - before.dicePenalty,
    skipTurnChange: asNumber(state.skipTurns) - before.skipTurns,
    destroyedCardCount: detail.destroyedCardCount || 0,
    discardedCardCount: detail.discardedCardCount || 0,
    redrawnCardCount: detail.redrawnCardCount || 0,
    ...(detail.redrawnCardCountPrivate ? { redrawnCardCountPrivate: true } : {}),
    ...(detail.privateCardIds?.length ? { privateCardIds: [...detail.privateCardIds] } : {}),
    ...(detail.privateCardNames?.length ? { privateCardNames: [...detail.privateCardNames] } : {}),
    ...(detail.autoResolved ? { autoResolved: true } : {})
  };
}

function speedOrder(game, players) {
  return [...players]
    .filter((player) => (game.playerStates?.[player.id]?.hp || 0) > 0)
    .sort((left, right) => (right.hero.speed || 0) - (left.hero.speed || 0) || left.joinedAt - right.joinedAt)
    .map((player) => player.id);
}

function installOrder(game, players, requestedOrder) {
  const living = new Set(livingPlayers(game, players).map((player) => player.id));
  const order = [...new Set([...(requestedOrder || []), ...speedOrder(game, players)])].filter((id) => living.has(id));
  game.turnOrder = order;
  game.roundOrder = order;
  game.actedThisRound = (game.actedThisRound || []).filter((id) => living.has(id) && order.includes(id));
  if (order.length) {
    const index = players.findIndex((player) => player.id === order[0]);
    if (index >= 0) game.activePlayerIndex = index;
  }
  return order;
}

function teamTotals(game, players, team) {
  const members = players.filter((player) => player.hero.team === team);
  return {
    hp: members.reduce((sum, player) => sum + (game.playerStates?.[player.id]?.hp || 0), 0),
    alive: members.filter((player) => (game.playerStates?.[player.id]?.hp || 0) > 0).length,
    shield: members.reduce((sum, player) => sum + (game.playerStates?.[player.id]?.shield || 0), 0)
  };
}

function decideWinner(game, players, lastTeam, finalPhase = false) {
  const veil = teamTotals(game, players, 'veil');
  const ember = teamTotals(game, players, 'ember');
  if (!veil.alive && ember.alive) return 'ember';
  if (!ember.alive && veil.alive) return 'veil';
  if (!veil.alive && !ember.alive) {
    const veilInfluence = game.adventure?.veilInfluence || 0;
    const emberInfluence = game.adventure?.emberInfluence || 0;
    if (veilInfluence !== emberInfluence) return veilInfluence > emberInfluence ? 'veil' : 'ember';
    return lastTeam || 'veil';
  }
  if (!finalPhase) return null;
  if (veil.hp !== ember.hp) return veil.hp > ember.hp ? 'veil' : 'ember';
  if (veil.alive !== ember.alive) return veil.alive > ember.alive ? 'veil' : 'ember';
  if (veil.shield !== ember.shield) return veil.shield > ember.shield ? 'veil' : 'ember';
  const veilInfluence = game.adventure?.veilInfluence || 0;
  const emberInfluence = game.adventure?.emberInfluence || 0;
  if (veilInfluence !== emberInfluence) return veilInfluence > emberInfluence ? 'veil' : 'ember';
  return lastTeam || 'veil';
}

function updateVictory(game, players, lastTeam) {
  const winner = decideWinner(game, players, lastTeam, (game.completedPhases || 0) >= 30);
  game.ended = Boolean(winner);
  game.winnerTeam = winner;
  if (winner) {
    const veil = teamTotals(game, players, 'veil');
    const ember = teamTotals(game, players, 'ember');
    game.endReason = `${teamLabel(winner)} wins. Total HP: Veilbound ${veil.hp} — Embercourt ${ember.hp}.`;
    game.turnDeadline = 0;
  } else game.endReason = null;
  return winner;
}

function createTeamSummaries(results) {
  return ['veil', 'ember'].map((team) => {
    const teamResults = results.filter((result) => result.team === team);
    const sum = (field) => teamResults.reduce((total, result) => total + result[field], 0);
    const parts = [`${teamResults.length} ${teamResults.length === 1 ? 'player' : 'players'} affected`];
    const metrics = [
      ['HP', sum('hpChange')], ['shield', sum('shieldChange')], ['pity', sum('pityChange')],
      ['attack bonus', sum('attackBonusChange')], ['d20 bonus', sum('diceBonusChange')], ['d20 penalty', sum('dicePenaltyChange')]
    ];
    for (const [label, value] of metrics) if (value) parts.push(`${value > 0 ? '+' : ''}${value} ${label}`);
    const destroyed = sum('destroyedCardCount');
    const discarded = sum('discardedCardCount');
    const redrawn = teamResults.reduce((total, result) => total + (result.redrawnCardCountPrivate ? 0 : asNumber(result.redrawnCardCount)), 0);
    const hasPrivateRedraw = teamResults.some((result) => result.redrawnCardCountPrivate);
    if (destroyed) parts.push(`${destroyed} ${destroyed === 1 ? 'card' : 'cards'} destroyed`);
    if (discarded) parts.push(`${discarded} ${discarded === 1 ? 'card' : 'cards'} discarded`);
    if (redrawn) parts.push(`${redrawn} ${redrawn === 1 ? 'card' : 'cards'} redrawn`);
    if (hasPrivateRedraw) parts.push('owned hands reshuffled');
    return { team, summary: `${teamLabel(team)}: ${parts.join(', ')}.` };
  });
}

function appendWorldEventHistory(game, event, definition, now) {
  game.history ||= [];
  const entry = {
    id: `${event.id}-history`,
    turn: event.phase,
    phase: event.phase,
    kind: 'world',
    actorName: 'World Event',
    message: `World Event · Phase ${event.phase} · Level ${event.level} — ${event.title}: ${definition.shortDescription}`,
    success: true,
    createdAt: now
  };
  if (!game.history.some((candidate) => candidate.id === entry.id)) game.history.push(entry);
  game.history = game.history.slice(-80);
}

function addEventLifeEvents(game, event, players, hpBefore, now) {
  const defeated = players.filter((player) => (hpBefore[player.id] || 0) > 0 && (game.playerStates?.[player.id]?.hp || 0) <= 0);
  const lifeEvents = defeated.map((player) => ({
    id: `${event.id}-defeat-${player.id}`,
    kind: 'defeat',
    playerId: player.id,
    playerName: player.displayName,
    reason: `${player.displayName} was defeated by World Event: ${event.title}.`,
    source: 'world-event'
  }));
  const revived = [];
  for (const player of defeated) {
    const state = game.playerStates[player.id];
    if (player.hero.name !== 'Sable Fen' || !state || state.passiveReviveUsed || state.hp > 0) continue;
    state.hp = Math.max(1, Math.ceil(state.maxHp / 2));
    state.passiveReviveUsed = true;
    state.reviveIn = 0;
    revived.push(player);
    lifeEvents.push({
      id: `${event.id}-second-sight-${player.id}`,
      kind: 'revive',
      playerId: player.id,
      playerName: player.displayName,
      reason: `${player.displayName} invoked Second Sight after ${event.title} and revived with half HP.`,
      source: 'world-event'
    });
  }
  if (lifeEvents.length) {
    game.outcome ||= { kind: 'system', success: true, total: 0, target: game.adventure?.target || 0, label: event.title, detail: event.description };
    game.outcome.lifeEvents = [...(game.outcome.lifeEvents || []), ...lifeEvents];
  }
  return { defeated, revived, lifeEvents, now };
}

function finalizeResolvedEvent(game, players, definition, results, options, startedAt) {
  const now = asNumber(options?.now, Date.now());
  const phase = Math.floor(asNumber(options?.phase, definition.phase));
  const id = String(options?.eventId || `world-${phase}-${definition.key}-${startedAt || now}`);
  const event = {
    id,
    eventKey: definition.key,
    phase,
    turn: phase,
    level: definition.level,
    intensity: definition.intensity,
    title: definition.title,
    description: definition.shortDescription,
    fullDescription: definition.fullDescription,
    interactive: definition.interactive,
    startedAt: startedAt || now,
    resolvedAt: now,
    results,
    teamSummaries: createTeamSummaries(results)
  };
  game.worldEvent = event;
  game.worldEventHistory = [...(game.worldEventHistory || []).filter((candidate) => candidate.id !== id), event].slice(-6);
  game.pendingWorldEvent = null;
  appendWorldEventHistory(game, event, definition, now);
  return event;
}

function applyImmediateEvent(game, players, definition, options) {
  const affected = livingPlayers(game, players);
  const before = Object.fromEntries(affected.map((player) => [player.id, stateSnapshot(ensureState(game.playerStates[player.id]))]));
  const hpBefore = Object.fromEntries(players.map((player) => [player.id, game.playerStates?.[player.id]?.hp || 0]));
  const details = new Map();
  const setDetail = (player, detail) => details.set(player.id, detail);
  let eventOrder = null;

  if (definition.key === 'shifting-arsenal') {
    for (const player of affected) {
      const state = ensureState(game.playerStates[player.id]);
      const ownedOccurrences = ownedCardOccurrences(player, state).filter((occurrence) => occurrence.zone === 'hand');
      const owned = ownedOccurrences.map((occurrence) => occurrence.cardId);
      const positions = ownedOccurrences.map((occurrence) => occurrence.index).sort((a, b) => a - b);
      for (const occurrence of [...ownedOccurrences].sort((left, right) => right.index - left.index)) {
        state.hand.splice(occurrence.index, 1);
      }
      state.drawPile.push(...owned);
      state.drawPile = shuffle(state.drawPile, options);
      let redrawn = 0;
      for (const position of positions) {
        if (!state.drawPile.length) break;
        state.hand.splice(Math.min(position, state.hand.length), 0, state.drawPile.shift());
        redrawn += 1;
      }
      setDetail(player, { publicSummary: `${player.displayName} reshuffled their owned hand and redrew the same number of cards.`, privateSummary: `You reshuffled your owned hand and redrew ${redrawn} ${redrawn === 1 ? 'card' : 'cards'}.`, redrawnCardCount: redrawn, redrawnCardCountPrivate: true });
    }
  } else if (definition.key === 'first-blood') {
    for (const player of affected) {
      const state = game.playerStates[player.id];
      const loss = Math.min(1, state.hp);
      state.hp = Math.max(0, state.hp - 1);
      setDetail(player, { publicSummary: `${player.displayName} lost ${loss} HP, ignoring shield.` });
    }
  } else if (definition.key === 'unstable-wards') {
    for (const player of affected) {
      const state = game.playerStates[player.id];
      if (state.shield > 0) {
        const lost = removeTimedEffectAmount(state, 'shield', 2);
        setDetail(player, { publicSummary: `${player.displayName} lost ${lost} shield.` });
      } else {
        state.pityPoints += 1;
        setDetail(player, { publicSummary: `${player.displayName} had no shield and gained 1 pity point.` });
      }
    }
  } else if (definition.key === 'broken-formation') {
    eventOrder = shuffle(affected.map((player) => player.id), options);
    for (const player of affected) setDetail(player, { publicSummary: `${player.displayName} was placed into the randomized phase-12 order.` });
  } else if (definition.key === 'arcane-static') {
    for (const player of affected) {
      addTimedEffect(game.playerStates[player.id], 'dicePenalty', 1);
      setDetail(player, { publicSummary: `${player.displayName} received -1 to their next d20 result.` });
    }
  } else if (definition.key === 'supply-rot') {
    for (const player of affected) {
      const state = game.playerStates[player.id];
      const eligible = eligibleOwnedCardsInZone(player, state, 'hand');
      const selected = pickRandom(eligible, options);
      if (!selected) setDetail(player, { publicSummary: `${player.displayName} had no eligible owned hand card; Supply Rot had no effect.` });
      else {
        const result = discardAndReplace(player, state, selected, options);
        setDetail(player, { publicSummary: `${player.displayName} discarded and replaced one owned card.`, privateSummary: `${result.name} moved to your discard pile${result.redrawn ? ' and was replaced' : ''}.`, discardedCardCount: 1, redrawnCardCount: result.redrawn, privateCardIds: [selected], privateCardNames: [result.name] });
      }
    }
  } else if (definition.key === 'gravewind') {
    for (const player of affected) {
      const state = game.playerStates[player.id];
      let eligible = [];
      for (const zone of ['hand', 'drawPile', 'discardPile']) {
        eligible = eligibleOwnedCardsInZone(player, state, zone, true);
        if (eligible.length) break;
      }
      const selected = pickRandom(eligible, options);
      if (!selected) setDetail(player, { publicSummary: `${player.displayName} had no eligible common owned card; Gravewind had no effect.` });
      else {
        const result = destroyCardsBatch(player, state, [selected], options);
        setDetail(player, { publicSummary: `${player.displayName} permanently lost one common owned card.`, privateSummary: `${result.names[0]} permanently moved to your graveyard${result.redrawn ? ' and its hand position was replaced' : ''}.`, destroyedCardCount: 1, redrawnCardCount: result.redrawn, privateCardIds: result.ids, privateCardNames: result.names });
      }
    }
  } else if (definition.key === 'eclipse-of-fortune') {
    for (const player of affected) {
      const state = game.playerStates[player.id];
      const paid = Math.min(2, state.pityPoints);
      const damage = 2 - paid;
      state.pityPoints -= paid;
      state.hp = Math.max(0, state.hp - damage);
      setDetail(player, { publicSummary: `${player.displayName} lost ${paid} pity${damage ? ` and ${damage} HP` : ''}.` });
    }
  } else if (definition.key === 'shieldquake') {
    for (const player of affected) {
      const state = game.playerStates[player.id];
      const shield = state.shield;
      clearTimedEffect(state, 'shield');
      state.hp = Math.max(0, state.hp - 1);
      setDetail(player, { publicSummary: `${player.displayName} lost ${shield} shield and 1 HP.` });
    }
  } else if (definition.key === 'severed-oaths') {
    for (const player of affected) {
      const state = game.playerStates[player.id];
      for (const kind of TIMED_FIELDS) clearTimedEffect(state, kind);
      addTimedEffect(state, 'dicePenalty', 2);
      setDetail(player, { publicSummary: `${player.displayName} lost all combat bonuses and received -2 to their next d20 result.` });
    }
  } else if (definition.key === 'time-fracture') {
    for (const team of ['veil', 'ember']) {
      const teamPlayers = affected.filter((player) => player.hero.team === team)
        .sort((left, right) => (right.hero.speed || 0) - (left.hero.speed || 0) || left.joinedAt - right.joinedAt);
      if (teamPlayers.length >= 2) {
        const fastest = teamPlayers[0];
        game.playerStates[fastest.id].skipTurns += 1;
        setDetail(fastest, { publicSummary: `${fastest.displayName}, the fastest ${teamLabel(team)} player, will skip their next turn.` });
        for (const player of teamPlayers.slice(1)) setDetail(player, { publicSummary: `${player.displayName} was not selected by Time Fracture.` });
      } else if (teamPlayers.length === 1) {
        const survivor = teamPlayers[0];
        addTimedEffect(game.playerStates[survivor.id], 'dicePenalty', 3);
        setDetail(survivor, { publicSummary: `${survivor.displayName} is their team's lone survivor and received -3 to their next d20 result.` });
      }
    }
  } else if (definition.key === 'crimson-debt') {
    for (const player of affected) {
      const state = game.playerStates[player.id];
      const pityLost = Math.min(2, state.pityPoints);
      state.hp = Math.max(0, state.hp - 2);
      state.pityPoints -= pityLost;
      setDetail(player, { publicSummary: `${player.displayName} lost 2 HP and ${pityLost} pity.` });
    }
  } else if (definition.key === 'final-collapse') {
    for (const player of affected) {
      const state = game.playerStates[player.id];
      const shield = state.shield;
      const damage = Math.max(2, Math.ceil(state.maxHp * 0.25));
      clearTimedEffect(state, 'shield');
      state.hp = Math.max(0, state.hp - damage);
      setDetail(player, { publicSummary: `${player.displayName} lost ${shield} shield and took ${damage} HP damage.` });
    }
  } else if (definition.key === 'the-last-cards') {
    for (const player of affected) {
      const state = game.playerStates[player.id];
      const reusable = ['hand', 'drawPile', 'discardPile'].flatMap((zone) => eligibleOwnedCardsInZone(player, state, zone));
      const common = reusable.filter((cardId) => !cardDefinition(player, cardId)?.unique);
      const destroyCount = Math.min(2, common.length, Math.max(0, reusable.length - 4));
      const selected = sample(common, destroyCount, options);
      if (!selected.length) setDetail(player, { publicSummary: `${player.displayName} retained the minimum four owned reusable cards.` });
      else {
        const result = destroyCardsBatch(player, state, selected, options);
        setDetail(player, { publicSummary: `${player.displayName} permanently lost ${selected.length} common owned ${selected.length === 1 ? 'card' : 'cards'}.`, privateSummary: `${result.names.join(', ')} permanently moved to your graveyard.`, destroyedCardCount: selected.length, redrawnCardCount: result.redrawn, privateCardIds: result.ids, privateCardNames: result.names });
      }
    }
  } else if (definition.key === 'sudden-death') {
    for (const player of affected) {
      const state = game.playerStates[player.id];
      const hpCap = Math.max(1, Math.ceil(state.maxHp / 2));
      state.hp = Math.max(1, Math.min(state.hp, hpCap));
      clearTimedEffect(state, 'shield');
      addTimedEffect(state, 'attackBuff', 2);
      setDetail(player, { publicSummary: `${player.displayName} was capped at ${hpCap} HP, lost all shield, and gained +2 next-attack damage.` });
    }
  } else throw new Error(`Unsupported World Event: ${definition.key}`);

  const provisionalEvent = { id: String(options?.eventId || `world-${definition.phase}-${definition.key}-${asNumber(options?.now, Date.now())}`), title: definition.title, description: definition.shortDescription };
  const life = addEventLifeEvents(game, provisionalEvent, players, hpBefore, asNumber(options?.now, Date.now()));
  for (const player of life.revived) {
    const detail = details.get(player.id) || { publicSummary: `${player.displayName} was affected.` };
    detail.publicSummary = `${detail.publicSummary} ${player.displayName} invoked Second Sight and revived with half HP.`;
    detail.privateSummary = `${detail.privateSummary || detail.publicSummary} You invoked Second Sight and revived with half HP.`;
    details.set(player.id, detail);
  }
  const results = affected.map((player) => resultFromDetail(player, game.playerStates[player.id], before[player.id], details.get(player.id)));
  const event = finalizeResolvedEvent(game, players, definition, results, { ...options, eventId: provisionalEvent.id }, asNumber(options?.startedAt, asNumber(options?.now, Date.now())));
  if (game.outcome?.lifeEvents?.length) {
    game.outcome.lifeEvents = game.outcome.lifeEvents.map((lifeEvent) => lifeEvent.id.startsWith(provisionalEvent.id)
      ? { ...lifeEvent, reason: lifeEvent.reason.replace(provisionalEvent.title || definition.title, definition.title) }
      : lifeEvent);
  }
  installOrder(game, players, eventOrder || speedOrder(game, players));
  updateVictory(game, players, options?.lastTeam);
  if (!game.ended) {
    const now = asNumber(options?.now, Date.now());
    game.turnStartedAt = now;
    game.turnDeadline = now + Math.max(1, asNumber(game.turnSeconds, 60)) * 1000;
  }
  return event;
}

export function resolveWorldEventByKey(game, players, eventKey, options = {}) {
  normalizeWorldEventState(game);
  const definition = getWorldEventDefinition(eventKey);
  if (!definition) throw new Error(`Unknown World Event key: ${eventKey}`);
  if (definition.interactive && eventKey === 'shattered-tribute') return beginShatteredTribute(game, players, { ...options, phase: options.phase || definition.phase });
  return applyImmediateEvent(game, players, definition, { ...options, phase: options.phase || definition.phase });
}

export function beginShatteredTribute(game, players, options = {}) {
  normalizeWorldEventState(game);
  if (game.pendingWorldEvent) return game.pendingWorldEvent;
  const definition = getWorldEventDefinition('shattered-tribute');
  const now = asNumber(options.now, Date.now());
  const phase = Math.floor(asNumber(options.phase, definition.phase));
  const requiredPlayerIds = livingPlayers(game, players).map((player) => player.id);
  const pending = {
    id: String(options.eventId || `world-${phase}-${definition.key}-${now}`),
    eventKey: definition.key,
    phase,
    turn: phase,
    level: definition.level,
    intensity: definition.intensity,
    title: definition.title,
    description: definition.shortDescription,
    fullDescription: definition.fullDescription,
    status: 'pending',
    requiredPlayerIds,
    submittedPlayerIds: [],
    autoResolvedPlayerIds: [],
    startedAt: now,
    deadlineAt: now + WORLD_EVENT_CHOICE_SECONDS * 1000,
    results: []
  };
  game.pendingWorldEvent = pending;
  game.turnDeadline = 0;
  game.turnStartedAt = now;
  installOrder(game, players, game.turnOrder?.length ? game.turnOrder : speedOrder(game, players));
  if (!requiredPlayerIds.length) finalizePendingWorldEvent(game, players, options);
  return game.pendingWorldEvent || game.worldEvent;
}

function applyTributeSelection(game, players, player, selectedCardIds, options, autoResolved) {
  const pending = game.pendingWorldEvent;
  const state = game.playerStates[player.id];
  const before = stateSnapshot(state);
  const destroyed = destroyCardsBatch(player, state, selectedCardIds, options);
  const count = destroyed.ids.length;
  const result = resultFromDetail(player, state, before, {
    publicSummary: `${player.displayName} permanently sacrificed ${count} ${count === 1 ? 'card' : 'cards'} and redrew ${destroyed.redrawn}.`,
    privateSummary: count ? `${destroyed.names.join(', ')} permanently moved to your graveyard. You redrew ${destroyed.redrawn} ${destroyed.redrawn === 1 ? 'card' : 'cards'}.` : 'You had no eligible owned cards to sacrifice.',
    destroyedCardCount: count,
    redrawnCardCount: destroyed.redrawn,
    privateCardIds: destroyed.ids,
    privateCardNames: destroyed.names,
    autoResolved
  });
  pending.results = [...(pending.results || []).filter((candidate) => candidate.playerId !== player.id), result];
  pending.submittedPlayerIds = [...new Set([...pending.submittedPlayerIds, player.id])];
  if (autoResolved) pending.autoResolvedPlayerIds = [...new Set([...pending.autoResolvedPlayerIds, player.id])];
  return result;
}

function validateTributeChoice(game, players, playerId, eventId, selectedCardIds) {
  if (!game) return 'There is no active battle.';
  normalizeWorldEventState(game);
  const pending = game.pendingWorldEvent;
  if (!pending || pending.status !== 'pending') return 'There is no pending World Event choice.';
  if (pending.eventKey !== 'shattered-tribute') return 'This World Event does not accept card choices.';
  if (String(eventId || '') !== pending.id) return 'The World Event choice is no longer current.';
  const player = players.find((candidate) => candidate.id === playerId);
  if (!player || !game.playerStates?.[player.id]) return 'The submitting player is not in this battle.';
  if (!pending.requiredPlayerIds.includes(player.id)) return 'This player is not required to submit a World Event choice.';
  if (pending.submittedPlayerIds.includes(player.id)) return 'This World Event choice was already submitted.';
  if (!Array.isArray(selectedCardIds)) return 'Choose common cards from your hand, draw pile, or discard pile.';
  if (new Set(selectedCardIds).size !== selectedCardIds.length) return 'Each selected card must be unique.';
  const eligible = getEligibleTributeCardIds(player, game.playerStates[player.id]);
  const requiredCount = Math.min(2, eligible.length);
  if (selectedCardIds.length !== requiredCount) return `Choose exactly ${requiredCount} eligible ${requiredCount === 1 ? 'card' : 'cards'}.`;
  if (selectedCardIds.some((cardId) => !eligible.includes(cardId))) return 'Every selected card must be an owned, non-borrowed common card in your hand, draw pile, or discard pile.';
  return '';
}

export function submitWorldEventChoice(game, players, playerId, eventId, selectedCardIds, options = {}) {
  const error = validateTributeChoice(game, players, playerId, eventId, selectedCardIds);
  if (error) return { ok: false, error, finalized: false };
  const player = players.find((candidate) => candidate.id === playerId);
  applyTributeSelection(game, players, player, selectedCardIds, options, false);
  const finalized = game.pendingWorldEvent.requiredPlayerIds.every((id) => game.pendingWorldEvent.submittedPlayerIds.includes(id));
  const event = finalized ? finalizePendingWorldEvent(game, players, options) : null;
  return { ok: true, error: '', finalized, event };
}

export function finalizePendingWorldEvent(game, players, options = {}) {
  normalizeWorldEventState(game);
  const pending = game.pendingWorldEvent;
  if (!pending) return null;
  const definition = getWorldEventDefinition(pending.eventKey);
  if (!definition) return null;
  const event = finalizeResolvedEvent(game, players, definition, pending.results || [], {
    ...options,
    phase: pending.phase,
    eventId: pending.id,
    now: asNumber(options.now, Date.now())
  }, pending.startedAt);
  installOrder(game, players, game.turnOrder?.length ? game.turnOrder : speedOrder(game, players));
  updateVictory(game, players, options.lastTeam);
  if (!game.ended) {
    const now = asNumber(options.now, Date.now());
    game.turnStartedAt = now;
    game.turnDeadline = now + Math.max(1, asNumber(game.turnSeconds, 60)) * 1000;
  }
  return event;
}

export function resolvePendingWorldEventTimeout(game, players, options = {}) {
  normalizeWorldEventState(game);
  const pending = game.pendingWorldEvent;
  const now = asNumber(options.now, Date.now());
  if (!pending || now < pending.deadlineAt) return { resolved: false, event: null };
  for (const playerId of pending.requiredPlayerIds.filter((id) => !pending.submittedPlayerIds.includes(id))) {
    const player = players.find((candidate) => candidate.id === playerId);
    const state = game.playerStates?.[playerId];
    if (!player || !state || state.hp <= 0) continue;
    const eligible = getEligibleTributeCardIds(player, state);
    const selected = sample(eligible, Math.min(2, eligible.length), options);
    applyTributeSelection(game, players, player, selected, options, true);
  }
  pending.requiredPlayerIds = pending.requiredPlayerIds.filter((id) => players.some((player) => player.id === id) && game.playerStates?.[id]);
  const event = finalizePendingWorldEvent(game, players, { ...options, now });
  return { resolved: true, event };
}

export function removeWorldEventParticipant(game, players, playerId, options = {}) {
  normalizeWorldEventState(game);
  const pending = game.pendingWorldEvent;
  if (!pending) {
    updateVictory(game, players, options.lastTeam);
    return { changed: false, finalized: false, event: null };
  }
  const wasRequired = pending.requiredPlayerIds.includes(playerId);
  pending.requiredPlayerIds = pending.requiredPlayerIds.filter((id) => id !== playerId);
  pending.submittedPlayerIds = pending.submittedPlayerIds.filter((id) => id !== playerId);
  pending.autoResolvedPlayerIds = pending.autoResolvedPlayerIds.filter((id) => id !== playerId);
  pending.results = (pending.results || []).filter((result) => result.playerId !== playerId);
  const finalized = pending.requiredPlayerIds.every((id) => pending.submittedPlayerIds.includes(id));
  const event = finalized ? finalizePendingWorldEvent(game, players, options) : null;
  if (!finalized) {
    game.turnDeadline = 0;
    updateVictory(game, players, options.lastTeam);
  }
  return { changed: wasRequired, finalized, event };
}

export function triggerWorldEventAfterPhase(game, players, previousCompletedPhases, completedPhases, options = {}) {
  normalizeWorldEventState(game);
  const previous = Math.floor(asNumber(previousCompletedPhases, 0));
  const completed = Math.floor(asNumber(completedPhases, 0));
  if (completed !== previous + 1) return { triggered: false, status: 'none', reason: 'no-single-phase-transition', event: null };
  if (game.ended || game.pendingWorldEvent) return { triggered: false, status: 'none', reason: game.ended ? 'battle-ended' : 'event-pending', event: null };
  const upcomingPhase = completed + 1;
  const schedule = getWorldEventScheduleEntry(upcomingPhase);
  if (!schedule) return { triggered: false, status: 'none', reason: 'unscheduled-phase', event: null };
  const alreadyResolved = (game.worldEventHistory || []).some((event) => event.phase === upcomingPhase)
    || game.worldEvent?.phase === upcomingPhase;
  if (alreadyResolved) return { triggered: false, status: 'none', reason: 'already-resolved', event: game.worldEvent };
  const eventKey = schedule.selection === 'fixed' ? schedule.eventKeys[0] : pickRandom(schedule.eventKeys, options);
  const event = resolveWorldEventByKey(game, players, eventKey, { ...options, phase: upcomingPhase });
  return { triggered: true, status: game.pendingWorldEvent ? 'pending' : 'resolved', event };
}
