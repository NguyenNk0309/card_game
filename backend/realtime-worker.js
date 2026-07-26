const emptyRoom = () => ({ players: [], phase: 'lobby', game: null, revision: 0 });
let room = emptyRoom();
const peers = new Map();
const roomCacheKey = new Request('https://shattered-oath-room.internal/shared-state-v3');
let durableStorage = null;
let roomQueue = Promise.resolve();

function publicState(viewerId = '') {
  const game = room.game ? {
    ...room.game,
    playerStates: Object.fromEntries(Object.entries(room.game.playerStates || {}).map(([id, state]) => [
      id,
      id === viewerId ? state : { ...state, hand: [], drawPile: [], discardPile: [], graveyard: [], borrowedCards: [], cardUses: {} }
    ]))
  } : null;
  return { players: room.players, phase: room.phase, game, revision: room.revision, serverNow: Date.now(), viewerSessionId: viewerId };
}

async function hydrateRoom() {
  try {
    if (durableStorage) {
      const state = await durableStorage.get('shared-room');
      if (state?.revision >= room.revision && Array.isArray(state.players)) room = state;
      return;
    }
    const cached = await caches.default.match(roomCacheKey);
    if (!cached) return;
    const state = await cached.json();
    if (state?.revision >= room.revision && Array.isArray(state.players)) room = state;
  } catch {
    // The in-isolate state still keeps the room usable if the cache is unavailable.
  }
}

async function persistRoom() {
  try {
    if (durableStorage) {
      await durableStorage.put('shared-room', room);
      if (room.phase === 'game' && room.game?.turnDeadline && !room.game.ended) {
        await durableStorage.setAlarm(room.game.turnDeadline);
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
const randomAmount = (minimum, maximum) => minimum + Math.floor(Math.random() * (maximum - minimum + 1));
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
function normalizeServerTurnOrder(game) {
  if (!game || !room.players.length) return [];
  if (!Number.isFinite(game.completedPhases)) game.completedPhases = Math.max(0, (game.roundNumber || 1) - 1);
  game.maxPhases = 30;
  for (const state of Object.values(game.playerStates || {})) {
    state.graveyard ||= [];
    state.cardUses ||= {};
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
    game.roundOrder = livingIds;
    game.turnOrder = livingIds;
  }
  game.actedThisRound = acted;
  return phaseCompleted;
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

function startNewCycleIfEmpty(state) {
  state.hand ||= [];
  state.drawPile ||= [];
  state.discardPile ||= [];
  if (!state.hand.length && !state.drawPile.length && state.discardPile.length) {
    state.drawPile = [...state.discardPile].sort(() => Math.random() - 0.5);
    state.discardPile = [];
    while (state.hand.length < 4 && state.drawPile.length) {
      const replacementIndex = Math.floor(Math.random() * state.drawPile.length);
      state.hand.push(state.drawPile.splice(replacementIndex, 1)[0]);
    }
  }
}

function drawOneOrStartNewCycle(state, handIndex = (state.hand || []).length) {
  state.hand ||= [];
  state.drawPile ||= [];
  state.discardPile ||= [];
  if (state.drawPile.length) {
    const replacementIndex = Math.floor(Math.random() * state.drawPile.length);
    const replacement = state.drawPile.splice(replacementIndex, 1)[0];
    state.hand.splice(Math.min(Math.max(0, handIndex), state.hand.length), 0, replacement);
  } else startNewCycleIfEmpty(state);
}

function moveCardToGraveyard(state, cardId) {
  const handIndex = (state.hand || []).indexOf(cardId);
  removeCardFromZones(state, cardId);
  state.graveyard ||= [];
  if (!state.graveyard.includes(cardId)) state.graveyard.push(cardId);
  if (handIndex >= 0) drawOneOrStartNewCycle(state, handIndex);
  else startNewCycleIfEmpty(state);
}

function returnBorrowedCards(game, completedOwnerId) {
  const owner = game.playerStates[completedOwnerId];
  if (!owner) return [];
  const returned = [];
  for (const borrower of Object.values(game.playerStates)) {
    const returning = (borrower.borrowedCards || []).filter((entry) =>
      entry.ownerId === completedOwnerId && (entry.expiresAfterOwnerTurn ?? owner.completedPlayerTurns) <= owner.completedPlayerTurns
    );
    for (const entry of returning) {
      removeCardFromZones(borrower, entry.cardId);
      if (!(owner.discardPile || []).includes(entry.cardId)) {
        owner.discardPile.push(entry.cardId);
        startNewCycleIfEmpty(owner);
      }
      returned.push(entry);
    }
    borrower.borrowedCards = (borrower.borrowedCards || []).filter((entry) => !returning.includes(entry));
    if (returning.length) drawOneOrStartNewCycle(borrower);
  }
  return returned;
}

function tickPendingRevives(game) {
  const revived = [];
  for (const player of room.players) {
    const state = game.playerStates[player.id];
    if (!state || state.hp > 0 || !(state.reviveIn > 0)) continue;
    state.reviveIn -= 1;
    if (state.reviveIn === 0) {
      state.hp = Math.max(1, Math.ceil(state.maxHp / 3));
      revived.push(player.displayName);
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
  const card = room.players.flatMap((player) => player.skillDeck || []).find((item) => item.id === outcome.cardId)
    || room.players.flatMap((player) => player.skillDeck || []).find((item) => item.name === outcome.cardName);
  if (!card || !(previousState.hand || []).includes(card.id)) return 'The selected card is not in the active hand.';
  const before = Math.max(0, Math.floor(Number(previousState.pityPoints) || 0));
  const cost = cardPityCost(card);
  if (outcome.resolution === 'pity') {
    if (before < cost) return 'There are not enough pity points for that card.';
    incomingState.pityPoints = before - cost;
    outcome.success = true;
    outcome.pityCost = cost;
  } else {
    incomingState.pityPoints = before + (outcome.success ? 0 : 1);
  }
  outcome.pityBefore = before;
  outcome.pityAfter = incomingState.pityPoints;
  return '';
}

function reconcileOutcomeMetadata(incomingGame, actor) {
  const outcome = incomingGame?.outcome;
  if (!outcome || outcome.kind !== 'card' || !actor) return;
  outcome.actorId = actor.id;
  const card = room.players.flatMap((player) => player.skillDeck || []).find((item) => item.id === outcome.cardId)
    || room.players.flatMap((player) => player.skillDeck || []).find((item) => item.name === outcome.cardName);
  if (card) outcome.cardId = card.id;
  const validIds = new Set(room.players.map((player) => player.id));
  const namedIds = String(outcome.targetName || '').split(', ').map((name) => room.players.find((player) => player.displayName === name)?.id).filter(Boolean);
  outcome.targetIds = [...new Set([...(Array.isArray(outcome.targetIds) ? outcome.targetIds : []), ...namedIds])].filter((id) => validIds.has(id));
  if (Array.isArray(outcome.impacts)) outcome.impacts = outcome.impacts.filter((impact) => impact && validIds.has(impact.targetId));
}

function reconcileHiddenCardEffects(previousGame, incomingGame, actor) {
  if (!previousGame || !incomingGame || !actor) return;
  returnBorrowedCards(incomingGame, actor.id, incomingGame.completedTurns);
  const outcome = incomingGame.outcome;
  const card = actor.skillDeck.find((item) => item.name === outcome?.cardName);
  if (!outcome?.success || card?.effect !== 'support') return;
  const targetName = String(outcome.targetName || '').split(', ')[0];
  const target = room.players.find((player) => player.id === outcome.targetIds?.[0]) || room.players.find((player) => player.displayName === targetName);
  const targetState = target && incomingGame.playerStates[target.id];
  if (!target || !targetState) return;
  let serverDetail = '';
  if (card.supportType === 'purge-card' && target.id !== actor.id && target.hero.team === actor.hero.team && (targetState.hp || 0) > 0) {
    const zoneIds = [...(targetState.hand || []), ...(targetState.drawPile || []), ...(targetState.discardPile || [])];
    const candidates = zoneIds.filter((id) => {
      const candidate = target.skillDeck.find((item) => item.id === id);
      return candidate && !candidate.unique && candidate.effect === 'none';
    });
    const removedId = candidates[Math.floor(Math.random() * candidates.length)];
    if (removedId) {
      moveCardToGraveyard(targetState, removedId);
      const removed = target.skillDeck.find((item) => item.id === removedId);
      serverDetail = ` ${removed?.name || 'One no-effect common card'} moved to ${target.displayName}'s graveyard for this battle.`;
      outcome.impacts = [...(outcome.impacts || []).filter((impact) => impact.kind !== 'card-purge'), { targetId: target.id, kind: 'card-purge', cardId: removedId }];
    }
  }
  if (card.supportType === 'steal-card') {
    const candidates = (targetState.hand || []).filter((id) => {
      const candidate = target.skillDeck.find((item) => item.id === id);
      return candidate && !candidate.unique;
    });
    const stolenId = candidates[Math.floor(Math.random() * candidates.length)];
    if (stolenId) {
      targetState.hand = targetState.hand.filter((id) => id !== stolenId);
      const actorState = incomingGame.playerStates[actor.id];
      actorState.hand.push(stolenId);
      actorState.borrowedCards = [...(actorState.borrowedCards || []), { cardId: stolenId, ownerId: target.id, borrowedAtTurn: incomingGame.completedTurns }];
      serverDetail = ` ${actor.displayName} temporarily stole one hidden common card from ${target.displayName}.`;
      outcome.impacts = [...(outcome.impacts || []).filter((impact) => impact.kind !== 'card-steal'), { targetId: target.id, kind: 'card-steal', cardId: stolenId }];
    }
  }
  if (serverDetail) {
    incomingGame.outcome.detail = `${incomingGame.outcome.detail || ''}${serverDetail}`.trim();
    const entry = incomingGame.history?.at(-1);
    if (entry?.kind !== 'world') entry.message = `${entry.message}${serverDetail}`;
  }
}
function applyWorldEvent(game, turn, now) {
  const level = Math.ceil(turn / 5);
  const living = (filterTeam) => room.players.filter((player) => (!filterTeam || player.hero.team === filterTeam) && (game.playerStates[player.id]?.hp || 0) > 0);
  const titles = ['Chaos Convergence', 'Fractured Fate', 'Crimson World Pulse', 'Unstable Arena Surge'];
  const title = titles[Math.floor(Math.random() * titles.length)];
  const reports = [];
  const results = [];
  for (const player of living()) {
    const kind = Math.floor(Math.random() * 5);
    const state = game.playerStates[player.id];
    if (kind === 0) {
      const damage = randomAmount(1, level + 1);
      const hpBefore = state.hp;
      state.hp = Math.max(0, state.hp - damage);
      const amount = hpBefore - state.hp;
      reports.push(`${player.displayName} -${amount} HP`);
      results.push({ targetId: player.id, kind: 'damage', amount, hpBefore, hpAfter: state.hp, defeated: state.hp === 0 });
    } else if (kind === 1) {
      const before = state.hp;
      state.hp = Math.min(state.maxHp, state.hp + randomAmount(1, level + 1));
      const amount = state.hp - before;
      reports.push(`${player.displayName} +${amount} HP`);
      results.push({ targetId: player.id, kind: 'heal', amount, hpBefore: before, hpAfter: state.hp });
    } else if (kind === 2) {
      const shieldBefore = state.shield || 0;
      const lost = Math.min(state.shield || 0, randomAmount(1, level * 2));
      state.shield -= lost;
      reports.push(`${player.displayName} -${lost} shield`);
      results.push({ targetId: player.id, kind: 'shield-loss', amount: lost, shieldBefore, shieldAfter: state.shield });
    } else if (kind === 3) {
      const bonus = randomAmount(1, level);
      state.attackBuff = (state.attackBuff || 0) + bonus;
      reports.push(`${player.displayName} +${bonus} next-attack damage`);
      results.push({ targetId: player.id, kind: 'attack-buff', amount: bonus });
    } else {
      const amount = randomAmount(1, level + 1);
      if (Math.random() < 0.5) {
        const hpBefore = state.hp;
        state.hp = Math.max(0, state.hp - amount);
        const damage = hpBefore - state.hp;
        reports.push(`${player.displayName} -${damage} HP`);
        results.push({ targetId: player.id, kind: 'damage', amount: damage, hpBefore, hpAfter: state.hp, defeated: state.hp === 0 });
      } else {
        const before = state.hp;
        state.hp = Math.min(state.maxHp, state.hp + amount);
        const healing = state.hp - before;
        reports.push(`${player.displayName} +${healing} HP`);
        results.push({ targetId: player.id, kind: 'heal', amount: healing, hpBefore: before, hpAfter: state.hp });
      }
    }
  }
  const passiveRevives = triggerSableRevives(game);
  for (const player of passiveRevives) {
    reports.push(`${player.displayName} invoked Second Sight and revived with half HP`);
    results.push({ targetId: player.id, kind: 'revive', hpBefore: 0, hpAfter: game.playerStates[player.id].hp });
  }
  const description = `Both teams are affected with a separate random result for every living player: ${reports.join('; ')}.`;
  const event = { id: `world-${turn}-${now}`, turn, level, title, description, results };
  game.worldEvent = event;
  game.history.push({ id: `${event.id}-history`, turn, phase: turn, kind: 'world', actorName: 'World Event', message: `World Event · Level ${level} — ${title}: ${description}`, success: true, createdAt: now });
}

function removePlayerFromRoom(targetId, removedBy, removedById = '') {
  const removingIndex = room.players.findIndex((player) => player.id === targetId);
  if (removingIndex < 0) return null;
  const removedPlayer = room.players[removingIndex];
  const wasActive = room.phase === 'game' && room.game && removingIndex === room.game.activePlayerIndex;
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
      if (removingIndex < room.game.activePlayerIndex) room.game.activePlayerIndex -= 1;
      else if (wasActive) room.game.activePlayerIndex = Math.min(removingIndex, room.players.length - 1);
      if (wasActive && !room.game.ended) {
        const now = Date.now();
        room.game.turnStartedAt = now;
        room.game.turnDeadline = now + TURN_SECONDS * 1000;
        room.game.outcome = {
          kind: 'system',
          success: false,
          total: 0,
          target: room.game.adventure.target,
          label: `${removedPlayer.displayName} was removed`,
          detail: `${removedBy} removed this player. The next turn begins now.`,
          actorId: removedById || undefined,
          actorName: removedBy,
          targetIds: [removedPlayer.id],
          targetName: removedPlayer.displayName,
          impacts: [{ targetId: removedPlayer.id, kind: 'none', amount: 0 }]
        };
        room.game.history = [...(room.game.history || []), { id: `remove-${Date.now()}`, turn: room.game.completedTurns, phase: Math.min(30, (room.game.completedPhases || 0) + 1), kind: 'system', actorName: removedBy, message: `${removedBy} removed ${removedPlayer.displayName} from the battle.`, success: true, createdAt: Date.now() }].slice(-80);
      }
      const fallbackTeam = room.players[0]?.hero.team || removedPlayer.hero.team;
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
  state.timedEffects = keeping;
}

async function passCurrentTurn(kind, now = Date.now(), discardedCardName = '', discardedCardId = '') {
  const game = room.game;
  if (room.phase !== 'game' || !game || game.ended || !room.players.length) return false;
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
  game.completedTurns = completedTurns;
  game.adventure = { ...game.adventure, target: randomDiceTarget() };
  game.outcome = {
    kind,
    success: false,
    total: 0,
    target: game.adventure.target,
    label: discarded ? `${playerName} discarded ${discardedCardName}` : forced ? `${playerName}'s turn was cancelled` : timedOut ? `${playerName} ran out of time` : `${playerName} skipped the turn`,
    detail: discarded ? `${discardedCardName} entered the discard pile and advanced the full-deck cycle. Expiring effects ended normally.` : forced ? 'A support effect cancelled this turn. Cards were preserved; expiring effects ended normally.' : timedOut ? 'The turn was automatically passed. No cards were discarded or shuffled; expiring effects ended normally.' : 'The turn was skipped. No cards were discarded or shuffled; expiring effects ended normally.',
    actorId: passingPlayer?.id,
    actorName: playerName,
    cardId: discardedCardId || undefined,
    cardName: discardedCardName || undefined,
    targetIds: passingPlayer ? [passingPlayer.id] : [],
    impacts: passingPlayer ? [{ targetId: passingPlayer.id, kind: forced ? 'skip-turn' : 'none', amount: forced ? 1 : 0 }] : []
  };
  game.history = [...(game.history || []), { id: `${kind}-${completedTurns}-${now}`, turn: completedTurns, phase: actionPhase, kind, actorName: playerName, actorTeam: passingPlayer?.hero.team, cardName: discardedCardName || undefined, message: discarded ? `${playerName} manually discarded ${discardedCardName} and advanced their full-deck cycle. Expiring effects ended normally.` : forced ? `${playerName}'s turn was cancelled by an enemy support effect. Their hand was preserved; expiring effects ended normally.` : timedOut ? `${playerName} ran out of time and automatically passed. Their hand was preserved; expiring effects ended normally.` : `${playerName} manually skipped the turn. Their hand was preserved; expiring effects ended normally.`, success: false, createdAt: now }];
  game.worldEvent = null;
  if (revived.length) game.history.push({ id: `revive-${completedTurns}-${now}`, turn: completedTurns, phase: actionPhase, kind: 'system', actorName: 'Returning Light', message: `${revived.join(', ')} revived with one-third HP.`, success: true, createdAt: now });
  game.roll = null;
  let phaseCompleted = false;
  if (passingPlayer) {
    rotateServerTurn(game, passingPlayer.id);
    phaseCompleted = completeRoundTurn(game, passingPlayer.id);
  }
  game.adventure = { ...game.adventure, chapter: Math.min(30, (game.completedPhases || 0) + 1) };
  if (phaseCompleted && game.completedPhases % 5 === 0) applyWorldEvent(game, game.completedPhases, now);
  game.history = game.history.slice(-80);
  const winner = decideWinner(game, passingPlayer?.hero.team || 'veil', (game.completedPhases || 0) >= 30);
  game.ended = Boolean(winner); game.winnerTeam = winner;
  const veil = teamTotals(game, 'veil'); const ember = teamTotals(game, 'ember');
  game.endReason = winner ? `${teamLabel(winner)} wins. Total HP: Veilbound ${veil.hp} — Embercourt ${ember.hp}.` : null;
  game.turnStartedAt = now;
  game.turnSeconds = TURN_SECONDS;
  game.turnDeadline = winner ? 0 : now + TURN_SECONDS * 1000;
  await commitRoom();
  if (kind !== 'forced-skip') await advanceForcedSkippedTurns(now + 1);
  return true;
}

async function advanceTimedOutTurn(now = Date.now()) {
  const game = room.game;
  if (room.phase !== 'game' || !game || game.ended || !game.turnDeadline || now < game.turnDeadline || !room.players.length) return false;
  return passCurrentTurn('timeout', now);
}

async function advanceForcedSkippedTurns(now = Date.now()) {
  let advanced = false;
  for (let count = 0; count < room.players.length; count += 1) {
    const game = room.game;
    if (room.phase !== 'game' || !game || game.ended) break;
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

async function applyCommand(ownerId, message) {
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
    const removed = removePlayerFromRoom(String(message.targetSessionId || ''), requester.displayName, requester.id);
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
    room.phase = 'game';
    room.game = message.game;
    room.game.adventure.target = randomDiceTarget();
    room.game.turnSeconds = TURN_SECONDS;
    room.game.turnStartedAt = Date.now();
    room.game.turnDeadline = room.game.turnStartedAt + TURN_SECONDS * 1000;
    normalizeServerTurnOrder(room.game);
    await commitRoom();
    return null;
  }

  if (message.type === 'game:update') {
    await advanceTimedOutTurn();
    if (room.phase !== 'game' || !room.game) return 'There is no active adventure.';
    const order = normalizeServerTurnOrder(room.game);
    const activePlayer = room.players.find((player) => player.id === order[0]) || room.players[room.game.activePlayerIndex];
    if (!activePlayer || ownerId !== activePlayer.id) return 'Only the current player can resolve this turn.';
    if (!message.game?.adventure) return 'The turn update is incomplete.';
    if ((room.game.playerStates[activePlayer.id]?.hp || 0) <= 0) return 'A defeated player cannot play a card.';
    const previousGame = room.game;
    for (const [id, state] of Object.entries(room.game.playerStates || {})) {
      if (id !== activePlayer.id && message.game.playerStates?.[id]) {
        message.game.playerStates[id].hand = [...(state.hand || [])];
        message.game.playerStates[id].drawPile = [...(state.drawPile || [])];
        message.game.playerStates[id].discardPile = [...(state.discardPile || [])];
        message.game.playerStates[id].graveyard = [...(state.graveyard || [])];
        message.game.playerStates[id].borrowedCards = [...(state.borrowedCards || [])];
        message.game.playerStates[id].cardUses = { ...(state.cardUses || {}) };
        message.game.playerStates[id].pityPoints = Math.max(0, Math.floor(Number(state.pityPoints) || 0));
      }
    }
    const pityError = reconcilePityPoints(previousGame, message.game, activePlayer);
    if (pityError) return pityError;
    reconcileOutcomeMetadata(message.game, activePlayer);
    reconcileHiddenCardEffects(previousGame, message.game, activePlayer);
    message.game.adventure.target = randomDiceTarget();
    if (message.game.outcome?.kind === 'card') message.game.outcome.nextTarget = message.game.adventure.target;
    room.game = message.game;
    room.game.turnSeconds = TURN_SECONDS;
    room.game.turnStartedAt = Date.now();
    room.game.turnDeadline = room.game.ended ? 0 : room.game.turnStartedAt + TURN_SECONDS * 1000;
    normalizeServerTurnOrder(room.game);
    await commitRoom();
    await advanceForcedSkippedTurns();
    return null;
  }

  if (message.type === 'skip-turn') {
    await advanceTimedOutTurn();
    if (room.phase !== 'game' || !room.game) return 'There is no active adventure.';
    const order = normalizeServerTurnOrder(room.game);
    const activePlayer = room.players.find((player) => player.id === order[0]) || room.players[room.game.activePlayerIndex];
    if (!activePlayer || ownerId !== activePlayer.id || ownerId !== message.sessionId) return 'Only the current player can skip this turn.';
    if ((room.game.playerStates[activePlayer.id]?.hp || 0) <= 0) return 'A defeated player cannot skip a turn.';
    await passCurrentTurn('skip');
    return null;
  }

  if (message.type === 'discard-card') {
    await advanceTimedOutTurn();
    if (room.phase !== 'game' || !room.game) return 'There is no active adventure.';
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
        startNewCycleIfEmpty(owner);
      }
    } else state.discardPile.push(message.cardId);
    drawOneOrStartNewCycle(state, discardedIndex >= 0 ? discardedIndex : state.hand.length);
    await passCurrentTurn('discard', Date.now(), card?.name || 'a card', card?.id || message.cardId);
    return null;
  }

  if (message.type === 'expire-turn') {
    await advanceTimedOutTurn();
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
      room.game.turnStartedAt = now;
      room.game.turnDeadline = room.game.ended ? 0 : now + TURN_SECONDS * 1000;
      if (room.players.length < 2) {
        room.game.ended = true;
        room.game.winnerTeam = room.players[0]?.hero.team || null;
        room.game.endReason = room.game.winnerTeam ? `${teamLabel(room.game.winnerTeam)} wins because the opposing team has no warriors left.` : 'The battle has ended.';
        room.game.turnDeadline = 0;
      } else if (!room.game.ended) {
        const winner = decideWinner(room.game, room.players[0].hero.team, false);
        if (winner) { room.game.ended = true; room.game.winnerTeam = winner; room.game.endReason = `${teamLabel(winner)} wins because the opposing team has no warriors left.`; room.game.turnDeadline = 0; }
        else normalizeServerTurnOrder(room.game);
      }
    }
    await commitRoom();
    return null;
  }

  if (message.type === 'return:lobby') {
    room.phase = 'lobby';
    room.game = null;
    room.players = room.players.map((player) => ({ ...player, ready: false }));
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
  await advanceTimedOutTurn();
  const error = await applyCommand(peers.get(socket), message);
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
  await advanceTimedOutTurn();
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
  const error = await applyCommand(requesterId, message);
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
      if (stored && Array.isArray(stored.players)) room = stored;
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
      await advanceTimedOutTurn();
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
