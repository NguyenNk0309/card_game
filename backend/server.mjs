import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import next from 'next';
import { WebSocketServer } from 'ws';

const dev = process.argv.includes('--dev');
const hostname = process.env.HOSTNAME || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
const app = dev ? next({ dev: true, hostname, port }) : null;
const assetRoot = resolve('dist/assets');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2'
};

async function serveStatic(request, response) {
  const url = new URL(request.url || '/', `http://${request.headers.host}`);
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }

  let target = resolve(assetRoot, `.${pathname}`);
  if (!target.startsWith(`${assetRoot}${sep}`) && target !== assetRoot) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const details = await stat(target);
    if (details.isDirectory()) target = resolve(target, 'index.html');
    await stat(target);
  } catch {
    if (extname(pathname)) {
      response.writeHead(404).end('Not found');
      return;
    }
    target = resolve(assetRoot, 'index.html');
  }

  response.writeHead(200, {
    'Content-Type': contentTypes[extname(target).toLowerCase()] || 'application/octet-stream',
    'Content-Language': 'en',
    'Cache-Control': target.endsWith('.html') ? 'no-store, no-cache, must-revalidate' : 'public, max-age=31536000, immutable',
    ...(target.endsWith('.html') ? { Pragma: 'no-cache', Expires: '0' } : {})
  });
  createReadStream(target).pipe(response);
}

const room = {
  players: [],
  phase: 'lobby',
  game: null,
  revision: 0
};

const peers = new Map();

function publicState(viewerId = '') {
  const game = room.game ? {
    ...room.game,
    playerStates: Object.fromEntries(Object.entries(room.game.playerStates || {}).map(([id, state]) => [
      id,
      id === viewerId ? state : { ...state, hand: [], drawPile: [], discardPile: [], borrowedCards: [] }
    ]))
  } : null;
  return {
    players: room.players,
    phase: room.phase,
    game,
    revision: room.revision,
    serverNow: Date.now()
  };
}

function send(socket, payload) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(payload));
}

function broadcast() {
  room.revision += 1;
  for (const [socket, viewerId] of peers.entries()) {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify({ type: 'state', state: publicState(viewerId) }));
  }
}

function reject(socket, message) {
  send(socket, { type: 'error', message });
}

function ownSession(socket, requestedId) {
  const sessionId = peers.get(socket);
  return Boolean(sessionId && sessionId === requestedId);
}

const teamLabel = (team) => team === 'veil' ? 'Veilbound' : 'Embercourt';
const randomDiceTarget = () => 8 + Math.floor(Math.random() * 9);
const randomAmount = (minimum, maximum) => minimum + Math.floor(Math.random() * (maximum - minimum + 1));
const TURN_SECONDS = 30;

function teamTotals(game, team) {
  const members = room.players.filter((player) => player.hero.team === team);
  return {
    hp: members.reduce((sum, player) => sum + (game.playerStates[player.id]?.hp || 0), 0),
    alive: members.filter((player) => (game.playerStates[player.id]?.hp || 0) > 0).length,
    shield: members.reduce((sum, player) => sum + (game.playerStates[player.id]?.shield || 0), 0)
  };
}

function decideWinner(game, lastTeam, finalTurn = false) {
  const veil = teamTotals(game, 'veil');
  const ember = teamTotals(game, 'ember');
  if (!veil.alive && ember.alive) return 'ember';
  if (!ember.alive && veil.alive) return 'veil';
  if (!veil.alive && !ember.alive) return game.adventure.veilInfluence !== game.adventure.emberInfluence ? (game.adventure.veilInfluence > game.adventure.emberInfluence ? 'veil' : 'ember') : lastTeam;
  if (!finalTurn) return null;
  if (veil.hp !== ember.hp) return veil.hp > ember.hp ? 'veil' : 'ember';
  if (veil.alive !== ember.alive) return veil.alive > ember.alive ? 'veil' : 'ember';
  if (veil.shield !== ember.shield) return veil.shield > ember.shield ? 'veil' : 'ember';
  if (game.adventure.veilInfluence !== game.adventure.emberInfluence) return game.adventure.veilInfluence > game.adventure.emberInfluence ? 'veil' : 'ember';
  return lastTeam;
}

function nextLivingIndex(game, currentIndex) {
  for (let offset = 1; offset <= room.players.length; offset += 1) {
    const index = (currentIndex + offset) % room.players.length;
    if ((game.playerStates[room.players[index]?.id]?.hp || 0) > 0) return index;
  }
  return currentIndex;
}

function normalizeServerTurnOrder(game) {
  if (!game || !room.players.length) return [];
  const validIds = new Set(room.players.map((player) => player.id));
  const currentId = room.players[game.activePlayerIndex]?.id;
  const fallback = currentId
    ? [...room.players.slice(game.activePlayerIndex), ...room.players.slice(0, game.activePlayerIndex)].map((player) => player.id)
    : room.players.map((player) => player.id);
  const source = Array.isArray(game.turnOrder) && game.turnOrder.length ? game.turnOrder : fallback;
  const order = [...new Set([...source.filter((id) => validIds.has(id)), ...fallback])]
    .filter((id) => (game.playerStates[id]?.hp || 0) > 0);
  game.turnOrder = order;
  if (order.length) {
    const index = room.players.findIndex((player) => player.id === order[0]);
    if (index >= 0) game.activePlayerIndex = index;
  }
  return order;
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

function returnBorrowedCards(game, actorId, completedTurn) {
  const actorState = game.playerStates[actorId];
  if (!actorState) return [];
  const returning = (actorState.borrowedCards || []).filter((entry) => entry.borrowedAtTurn < completedTurn);
  for (const entry of returning) {
    removeCardFromZones(actorState, entry.cardId);
    const owner = game.playerStates[entry.ownerId];
    if (owner && !(owner.discardPile || []).includes(entry.cardId)) owner.discardPile.push(entry.cardId);
  }
  actorState.borrowedCards = (actorState.borrowedCards || []).filter((entry) => entry.borrowedAtTurn >= completedTurn);
  return returning;
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
  if (card.supportType === 'purge-card' && target.id !== actor.id) {
    const beneficial = target.hero.team === actor.hero.team;
    const zoneIds = [...(targetState.hand || []), ...(targetState.drawPile || []), ...(targetState.discardPile || [])];
    const candidates = zoneIds.filter((id) => {
      const candidate = target.skillDeck.find((item) => item.id === id);
      return candidate && !candidate.unique && (beneficial ? candidate.effect === 'none' : candidate.effect !== 'none');
    });
    const removedId = candidates[Math.floor(Math.random() * candidates.length)];
    if (removedId) {
      removeCardFromZones(targetState, removedId);
      const removed = target.skillDeck.find((item) => item.id === removedId);
      serverDetail = ` ${removed?.name || 'One common card'} was removed from ${target.displayName}'s deck.`;
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
  for (const player of living()) {
    const kind = Math.floor(Math.random() * 5);
    const state = game.playerStates[player.id];
    if (kind === 0) {
      const damage = randomAmount(1, level + 1);
      state.hp = Math.max(0, state.hp - damage);
      reports.push(`${player.displayName} -${damage} HP`);
    } else if (kind === 1) {
      const before = state.hp;
      state.hp = Math.min(state.maxHp, state.hp + randomAmount(1, level + 1));
      reports.push(`${player.displayName} +${state.hp - before} HP`);
    } else if (kind === 2) {
      const lost = Math.min(state.shield || 0, randomAmount(1, level * 2));
      state.shield -= lost;
      reports.push(`${player.displayName} -${lost} shield`);
    } else if (kind === 3) {
      const bonus = randomAmount(1, level);
      state.attackBuff = (state.attackBuff || 0) + bonus;
      reports.push(`${player.displayName} +${bonus} next-attack damage`);
    } else {
      const amount = randomAmount(1, level + 1);
      if (Math.random() < 0.5) {
        const damage = amount;
        state.hp = Math.max(0, state.hp - damage);
        reports.push(`${player.displayName} -${damage} HP`);
      } else {
        const before = state.hp;
        state.hp = Math.min(state.maxHp, state.hp + amount);
        reports.push(`${player.displayName} +${state.hp - before} HP`);
      }
    }
  }
  const passiveRevives = triggerSableRevives(game);
  for (const player of passiveRevives) reports.push(`${player.displayName} invoked Second Sight and revived with half HP`);
  const description = `Both teams are affected with a separate random result for every living player: ${reports.join('; ')}.`;
  const event = { id: `world-${turn}-${now}`, turn, level, title, description };
  game.worldEvent = event;
  game.history.push({ id: `${event.id}-history`, turn, kind: 'world', actorName: 'World Event', message: `World Event · Level ${level} — ${title}: ${description}`, success: true, createdAt: now });
}

function removePlayerFromRoom(targetId, removedBy) {
  const removingIndex = room.players.findIndex((player) => player.id === targetId);
  if (removingIndex < 0) return null;
  const removedPlayer = room.players[removingIndex];
  const wasActive = room.phase === 'game' && room.game && removingIndex === room.game.activePlayerIndex;
  room.players.splice(removingIndex, 1);

  if (room.phase === 'game' && room.game) {
    delete room.game.playerStates[targetId];
    room.game.turnOrder = (room.game.turnOrder || []).filter((id) => id !== targetId);
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
          actorName: removedBy
        };
        room.game.history = [...(room.game.history || []), { id: `remove-${Date.now()}`, turn: room.game.completedTurns, kind: 'system', actorName: removedBy, message: `${removedBy} removed ${removedPlayer.displayName} from the battle.`, success: true, createdAt: Date.now() }].slice(-80);
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

function passCurrentTurn(kind, now = Date.now()) {
  const game = room.game;
  if (room.phase !== 'game' || !game || game.ended || !room.players.length) return false;
  const order = normalizeServerTurnOrder(game);
  const passingPlayer = room.players.find((player) => player.id === order[0]) || room.players[game.activePlayerIndex];
  const completedTurns = game.completedTurns + 1;
  if (passingPlayer) returnBorrowedCards(game, passingPlayer.id, completedTurns);
  const revived = tickPendingRevives(game);
  const playerName = passingPlayer?.displayName || 'Player';
  const timedOut = kind === 'timeout';
  const forced = kind === 'forced-skip';
  game.completedTurns = completedTurns;
  game.adventure = { ...game.adventure, chapter: Math.min(30, completedTurns + 1), target: randomDiceTarget() };
  game.outcome = { kind, success: false, total: 0, target: game.adventure.target, label: forced ? `${playerName}'s turn was cancelled` : timedOut ? `${playerName} ran out of time` : `${playerName} skipped the turn`, detail: forced ? 'A support effect cancelled this turn. Cards and active buffs were preserved.' : timedOut ? 'The turn was automatically passed. No cards were discarded or shuffled.' : 'The turn was skipped. No cards were discarded or shuffled.', actorName: playerName };
  game.history = [...(game.history || []), { id: `${kind}-${completedTurns}-${now}`, turn: completedTurns, kind, actorName: playerName, actorTeam: passingPlayer?.hero.team, message: forced ? `${playerName}'s turn was cancelled by an enemy support effect. Their hand and active buffs were preserved.` : timedOut ? `${playerName} ran out of time and automatically passed. Their hand was preserved.` : `${playerName} manually skipped the turn. Their hand was preserved.`, success: false, createdAt: now }];
  game.worldEvent = null;
  if (revived.length) game.history.push({ id: `revive-${completedTurns}-${now}`, turn: completedTurns, kind: 'system', actorName: 'Returning Light', message: `${revived.join(', ')} revived with one-third HP.`, success: true, createdAt: now });
  if (completedTurns % 5 === 0) applyWorldEvent(game, completedTurns, now);
  game.history = game.history.slice(-80);
  game.roll = null;
  const winner = decideWinner(game, passingPlayer?.hero.team || 'veil', completedTurns >= 30);
  game.ended = Boolean(winner);
  game.winnerTeam = winner;
  const veil = teamTotals(game, 'veil'); const ember = teamTotals(game, 'ember');
  game.endReason = winner ? `${teamLabel(winner)} wins. Total HP: Veilbound ${veil.hp} — Embercourt ${ember.hp}.` : null;
  if (!winner && passingPlayer) rotateServerTurn(game, passingPlayer.id);
  game.turnStartedAt = now;
  game.turnSeconds = TURN_SECONDS;
  game.turnDeadline = winner ? 0 : now + TURN_SECONDS * 1000;
  broadcast();
  if (kind !== 'forced-skip') advanceForcedSkippedTurns(now + 1);
  return true;
}

function advanceTimedOutTurn(now = Date.now()) {
  const game = room.game;
  if (room.phase !== 'game' || !game || game.ended || !game.turnDeadline || now < game.turnDeadline || !room.players.length) return false;
  return passCurrentTurn('timeout', now);
}

function advanceForcedSkippedTurns(now = Date.now()) {
  let advanced = false;
  for (let count = 0; count < room.players.length; count += 1) {
    const game = room.game;
    if (room.phase !== 'game' || !game || game.ended) break;
    const order = normalizeServerTurnOrder(game);
    const player = room.players.find((candidate) => candidate.id === order[0]);
    const state = player && game.playerStates[player.id];
    if (!state || !(state.skipTurns > 0)) break;
    state.skipTurns -= 1;
    passCurrentTurn('forced-skip', now + count);
    advanced = true;
  }
  return advanced;
}

function handleMessage(socket, rawMessage) {
  let message;
  try {
    message = JSON.parse(rawMessage.toString());
  } catch {
    reject(socket, 'The room received an invalid message.');
    return;
  }

  if (message.type === 'hello') {
    peers.set(socket, String(message.sessionId || ''));
    send(socket, { type: 'state', state: publicState(String(message.sessionId || '')) });
    return;
  }

  if (message.type === 'join') {
    if (room.phase !== 'lobby') return reject(socket, 'The adventure has already started.');
    const player = message.player;
    if (!player?.id || !player?.displayName || !player?.hero || !Array.isArray(player.skillDeck)) {
      return reject(socket, 'The player session is incomplete.');
    }
    if (!ownSession(socket, player.id)) return reject(socket, 'This browser cannot create another browser session.');
    if (room.players.some((current) => current.id === player.id)) {
      send(socket, { type: 'state', state: publicState(peers.get(socket) || '') });
      return;
    }
    if (room.players.length >= 10) return reject(socket, 'This lobby already has 10 players.');
    if (room.players.some((current) => current.displayName.toLowerCase() === player.displayName.toLowerCase())) {
      return reject(socket, 'That player name is already joined.');
    }

    const veilCount = room.players.filter((current) => current.hero.team === 'veil').length;
    const emberCount = room.players.length - veilCount;
    player.hero.team = veilCount <= emberCount ? 'veil' : 'ember';
    room.players.push({ ...player, ready: false });
    broadcast();
    return;
  }

  if (message.type === 'ready') {
    if (room.phase !== 'lobby') return reject(socket, 'Readiness can only change in the lobby.');
    if (!ownSession(socket, message.sessionId)) return reject(socket, 'You can only ready your own player.');
    const player = room.players.find((current) => current.id === message.sessionId);
    if (!player) return reject(socket, 'Join the lobby before pressing Ready.');
    player.ready = typeof message.ready === 'boolean' ? message.ready : !player.ready;
    broadcast();
    return;
  }

  if (message.type === 'leave') {
    if (room.phase !== 'lobby') return reject(socket, 'Players cannot leave during an active adventure.');
    if (!ownSession(socket, message.sessionId)) return reject(socket, 'You can only remove your own player.');
    room.players = room.players.filter((current) => current.id !== message.sessionId);
    broadcast();
    return;
  }

  if (message.type === 'remove-player') {
    if (!ownSession(socket, message.sessionId)) return reject(socket, 'Only a joined player can remove another player.');
    const requester = room.players.find((player) => player.id === message.sessionId);
    if (!requester) return reject(socket, 'Join the room before removing a player.');
    if (message.targetSessionId === message.sessionId) return reject(socket, 'Use Leave to remove your own player.');
    const removed = removePlayerFromRoom(String(message.targetSessionId || ''), requester.displayName);
    if (!removed) return reject(socket, 'That player is no longer in the room.');
    broadcast();
    return;
  }

  if (message.type === 'start') {
    if (room.phase !== 'lobby') return;
    if (room.players.length < 2) return reject(socket, 'At least two players must join.');
    if (!room.players.every((player) => player.ready)) return reject(socket, 'Every joined player must be ready.');
    if (!message.game?.adventure) return reject(socket, 'The adventure state is missing.');
    room.phase = 'game';
    room.game = message.game;
    room.game.adventure.target = randomDiceTarget();
    room.game.turnSeconds = TURN_SECONDS;
    room.game.turnStartedAt = Date.now();
    room.game.turnDeadline = room.game.turnStartedAt + TURN_SECONDS * 1000;
    normalizeServerTurnOrder(room.game);
    broadcast();
    return;
  }

  if (message.type === 'game:update') {
    advanceTimedOutTurn();
    if (room.phase !== 'game' || !room.game) return reject(socket, 'There is no active adventure.');
    const order = normalizeServerTurnOrder(room.game);
    const activePlayer = room.players.find((player) => player.id === order[0]) || room.players[room.game.activePlayerIndex];
    if (!activePlayer || !ownSession(socket, activePlayer.id)) {
      return reject(socket, 'Only the current player can resolve this turn.');
    }
    if (!message.game?.adventure) return reject(socket, 'The turn update is incomplete.');
    if ((room.game.playerStates[activePlayer.id]?.hp || 0) <= 0) return reject(socket, 'A defeated player cannot play a card.');
    const previousGame = room.game;
    for (const [id, state] of Object.entries(room.game.playerStates || {})) {
      if (id !== activePlayer.id && message.game.playerStates?.[id]) {
        message.game.playerStates[id].hand = [...(state.hand || [])];
        message.game.playerStates[id].drawPile = [...(state.drawPile || [])];
        message.game.playerStates[id].discardPile = [...(state.discardPile || [])];
        message.game.playerStates[id].borrowedCards = [...(state.borrowedCards || [])];
      }
    }
    reconcileHiddenCardEffects(previousGame, message.game, activePlayer);
    message.game.adventure.target = randomDiceTarget();
    if (message.game.outcome?.kind === 'card') message.game.outcome.nextTarget = message.game.adventure.target;
    room.game = message.game;
    room.game.turnSeconds = TURN_SECONDS;
    room.game.turnStartedAt = Date.now();
    room.game.turnDeadline = room.game.ended ? 0 : room.game.turnStartedAt + TURN_SECONDS * 1000;
    normalizeServerTurnOrder(room.game);
    broadcast();
    advanceForcedSkippedTurns();
    return;
  }

  if (message.type === 'skip-turn') {
    advanceTimedOutTurn();
    if (room.phase !== 'game' || !room.game) return reject(socket, 'There is no active adventure.');
    const order = normalizeServerTurnOrder(room.game);
    const activePlayer = room.players.find((player) => player.id === order[0]) || room.players[room.game.activePlayerIndex];
    if (!activePlayer || !ownSession(socket, activePlayer.id) || message.sessionId !== activePlayer.id) return reject(socket, 'Only the current player can skip this turn.');
    if ((room.game.playerStates[activePlayer.id]?.hp || 0) <= 0) return reject(socket, 'A defeated player cannot skip a turn.');
    passCurrentTurn('skip');
    return;
  }

  if (message.type === 'expire-turn') {
    advanceTimedOutTurn();
    send(socket, { type: 'state', state: publicState() });
    return;
  }

  if (message.type === 'end-game') {
    if (room.phase !== 'game' || !room.game) return reject(socket, 'There is no active adventure.');
    if (!ownSession(socket, message.sessionId) || !room.players.some((player) => player.id === message.sessionId)) return reject(socket, 'Only a joined player can end the game.');
    const player = room.players.find((current) => current.id === message.sessionId);
    room.game.ended = true;
    room.game.winnerTeam = null;
    room.game.endReason = `The battle was ended by ${player?.displayName || 'a player'}.`;
    room.game.turnDeadline = 0;
    broadcast();
    return;
  }

  if (message.type === 'leave-game') {
    if (room.phase !== 'game' || !room.game) return reject(socket, 'There is no active adventure.');
    if (!ownSession(socket, message.sessionId)) return reject(socket, 'You can only remove your own player.');
    const leavingIndex = room.players.findIndex((player) => player.id === message.sessionId);
    if (leavingIndex < 0) return reject(socket, 'That player is not in the adventure.');
    const wasActive = leavingIndex === room.game.activePlayerIndex;
    room.players.splice(leavingIndex, 1);
    delete room.game.playerStates[message.sessionId];
    room.game.turnOrder = (room.game.turnOrder || []).filter((id) => id !== message.sessionId);
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
    broadcast();
    return;
  }

  if (message.type === 'return:lobby') {
    room.phase = 'lobby';
    room.game = null;
    room.players = room.players.map((player) => ({ ...player, ready: false }));
    broadcast();
  }
}

async function handleRoomApi(request, response) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  if (request.method === 'GET') {
    const viewerId = new URL(request.url || '/', `http://${request.headers.host}`).searchParams.get('sessionId') || '';
    response.end(JSON.stringify({ state: publicState(viewerId) }));
    return;
  }
  if (request.method !== 'POST') {
    response.writeHead(405).end(JSON.stringify({ error: 'Method not allowed.', state: publicState() }));
    return;
  }

  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) {
      response.writeHead(413).end(JSON.stringify({ error: 'Room message is too large.', state: publicState() }));
      return;
    }
  }

  let message;
  try {
    message = JSON.parse(body);
  } catch {
    response.writeHead(400).end(JSON.stringify({ error: 'The room received an invalid message.', state: publicState() }));
    return;
  }

  let result = null;
  const requestPeer = {
    OPEN: 1,
    readyState: 1,
    send(payload) {
      result = JSON.parse(payload);
    }
  };
  peers.set(requestPeer, String(message.sessionId || ''));
  handleMessage(requestPeer, Buffer.from(JSON.stringify(message)));
  peers.delete(requestPeer);
  const error = result?.type === 'error' ? result.message : null;
  response.writeHead(error ? 400 : 200).end(JSON.stringify({ state: publicState(String(message.sessionId || '')), error }));
}

if (app) await app.prepare();

const server = createServer((request, response) => {
  const pathname = new URL(request.url || '/', `http://${request.headers.host}`).pathname;
  if (pathname === '/api/room') {
    handleRoomApi(request, response).catch(() => response.writeHead(500).end(JSON.stringify({ error: 'Server error.' })));
    return;
  }
  if (app) {
    app.getRequestHandler()(request, response);
    return;
  }
  serveStatic(request, response).catch(() => response.writeHead(500).end('Server error'));
});
const wss = new WebSocketServer({ noServer: true });
const nextUpgrade = app?.getUpgradeHandler();

wss.on('connection', (socket) => {
  peers.set(socket, '');
  send(socket, { type: 'state', state: publicState() });
  socket.on('message', (message) => handleMessage(socket, message));
  socket.on('close', () => peers.delete(socket));
});

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '/', `http://${request.headers.host}`).pathname;
  if (pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (webSocket) => wss.emit('connection', webSocket, request));
    return;
  }
  if (nextUpgrade) nextUpgrade(request, socket, head);
  else socket.destroy();
});

server.listen(port, hostname, () => {
  console.log(`Shattered Oath ready at http://${hostname}:${port}`);
  console.log(`Shared WebSocket room ready at ws://${hostname}:${port}/ws`);
});

setInterval(() => advanceTimedOutTurn(), 500);
