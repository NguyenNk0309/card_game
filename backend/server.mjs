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
    'Cache-Control': target.endsWith('.html') ? 'no-cache' : 'public, max-age=31536000, immutable'
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

function publicState() {
  return {
    players: room.players,
    phase: room.phase,
    game: room.game,
    revision: room.revision
  };
}

function send(socket, payload) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(payload));
}

function broadcast() {
  room.revision += 1;
  const message = JSON.stringify({ type: 'state', state: publicState() });
  for (const socket of peers.keys()) {
    if (socket.readyState === socket.OPEN) socket.send(message);
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

function applyWorldEvent(game, turn, now) {
  const level = Math.ceil(turn / 5);
  const team = Math.random() < 0.5 ? 'veil' : 'ember';
  const living = (filterTeam) => room.players.filter((player) => (!filterTeam || player.hero.team === filterTeam) && (game.playerStates[player.id]?.hp || 0) > 0);
  const kind = Math.floor(Math.random() * 5);
  let title = 'Battlefield Quake';
  let description = '';
  if (kind === 0) {
    for (const player of living()) { const reduction = living(player.hero.team).some((ally) => ally.hero.classId === 'oracle') ? 1 : 0; game.playerStates[player.id].hp = Math.max(0, game.playerStates[player.id].hp - Math.max(0, level - reduction)); }
    description = `Every living player takes ${level} damage; a team with an Oracle reduces this by 1.`;
  } else if (kind === 1) {
    title = 'Emergency Supplies'; for (const player of living(team)) game.playerStates[player.id].hp = Math.min(game.playerStates[player.id].maxHp, game.playerStates[player.id].hp + level); description = `${teamLabel(team)} restores ${level} HP to every living member.`;
  } else if (kind === 2) {
    title = 'Armor-Shattering Wave'; for (const state of Object.values(game.playerStates)) state.shield = Math.max(0, (state.shield || 0) - level * 2); description = `Every player loses up to ${level * 2} shield.`;
  } else if (kind === 3) {
    title = 'Furious Momentum'; for (const player of living(team)) game.playerStates[player.id].attackBuff = (game.playerStates[player.id].attackBuff || 0) + level; description = `${teamLabel(team)} gains +${level} damage on each member's next attack.`;
  } else {
    title = 'Unclaimed Arrow Storm'; const reduction = living(team).some((ally) => ally.hero.classId === 'oracle') ? 1 : 0; for (const player of living(team)) game.playerStates[player.id].hp = Math.max(0, game.playerStates[player.id].hp - Math.max(0, level + 1 - reduction)); description = `${teamLabel(team)} takes ${level + 1} surprise damage; an Oracle reduces this by 1.`;
  }
  const event = { id: `world-${turn}-${now}`, turn, level, title, description, affectedTeam: kind === 0 || kind === 2 ? undefined : team };
  game.worldEvent = event;
  game.history.push({ id: `${event.id}-history`, turn, kind: 'world', actorName: 'World Event', message: `${title}: ${description}`, success: true, createdAt: now });
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
        room.game.turnDeadline = now + (room.game.turnSeconds || 30) * 1000;
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

function advanceTimedOutTurn(now = Date.now()) {
  const game = room.game;
  if (room.phase !== 'game' || !game || game.ended || !game.turnDeadline || now < game.turnDeadline || !room.players.length) return false;
  const order = normalizeServerTurnOrder(game);
  const expiredPlayer = room.players.find((player) => player.id === order[0]) || room.players[game.activePlayerIndex];
  const completedTurns = game.completedTurns + 1;
  if (expiredPlayer && game.playerStates[expiredPlayer.id]) {
    game.playerStates[expiredPlayer.id].diceBuff = 0;
    game.playerStates[expiredPlayer.id].dicePenalty = 0;
  }
  game.completedTurns = completedTurns;
  game.adventure = { ...game.adventure, chapter: Math.min(30, completedTurns + 1) };
  game.outcome = { kind: 'timeout', success: false, total: 0, target: game.adventure.target, label: `${expiredPlayer?.displayName || 'Player'} ran out of time`, detail: 'The turn was automatically passed.', actorName: expiredPlayer?.displayName || 'Player' };
  game.history = [...(game.history || []), { id: `timeout-${completedTurns}-${now}`, turn: completedTurns, kind: 'timeout', actorName: expiredPlayer?.displayName || 'Player', actorTeam: expiredPlayer?.hero.team, message: `${expiredPlayer?.displayName || 'Player'} ran out of time after 30 seconds and passed the turn.`, success: false, createdAt: now }];
  game.worldEvent = null;
  if (completedTurns % 5 === 0) applyWorldEvent(game, completedTurns, now);
  game.history = game.history.slice(-80);
  game.roll = null;
  const winner = decideWinner(game, expiredPlayer?.hero.team || 'veil', completedTurns >= 30);
  game.ended = Boolean(winner);
  game.winnerTeam = winner;
  const veil = teamTotals(game, 'veil'); const ember = teamTotals(game, 'ember');
  game.endReason = winner ? `${teamLabel(winner)} wins. Total HP: Veilbound ${veil.hp} — Embercourt ${ember.hp}.` : null;
  if (!winner && expiredPlayer) rotateServerTurn(game, expiredPlayer.id);
  game.turnStartedAt = now;
  game.turnDeadline = winner ? 0 : now + (game.turnSeconds || 30) * 1000;
  broadcast();
  return true;
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
    send(socket, { type: 'state', state: publicState() });
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
      send(socket, { type: 'state', state: publicState() });
      return;
    }
    if (room.players.length >= 10) return reject(socket, 'This lobby already has 10 players.');
    if (room.players.some((current) => current.displayName.toLowerCase() === player.displayName.toLowerCase())) {
      return reject(socket, 'That player name is already joined.');
    }
    if (room.players.some((current) => current.hero.name === player.hero.name)) {
      return reject(socket, 'That character has already been chosen.');
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
    room.game = message.game;
    normalizeServerTurnOrder(room.game);
    broadcast();
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
      room.game.turnDeadline = room.game.ended ? 0 : now + (room.game.turnSeconds || 30) * 1000;
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
    response.end(JSON.stringify({ state: publicState() }));
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
  response.writeHead(error ? 400 : 200).end(JSON.stringify({ state: publicState(), error }));
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
