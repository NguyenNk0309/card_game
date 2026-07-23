const emptyRoom = () => ({ players: [], phase: 'lobby', game: null, revision: 0 });
let room = emptyRoom();
const peers = new Map();
const roomCacheKey = new Request('https://shattered-oath-room.internal/shared-state-v3');

function publicState() {
  return { players: room.players, phase: room.phase, game: room.game, revision: room.revision };
}

async function hydrateRoom() {
  try {
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
    await caches.default.put(roomCacheKey, new Response(JSON.stringify(publicState()), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' }
    }));
  } catch {
    // Continue with in-isolate state; clients will retry on the next poll.
  }
}

function send(socket, payload) {
  if (socket.readyState === 1) socket.send(JSON.stringify(payload));
}

function broadcast() {
  const message = JSON.stringify({ type: 'state', state: publicState() });
  for (const socket of peers.keys()) {
    if (socket.readyState === 1) socket.send(message);
  }
}

async function commitRoom() {
  room.revision += 1;
  await persistRoom();
  broadcast();
}

async function advanceTimedOutTurn(now = Date.now()) {
  const game = room.game;
  if (room.phase !== 'game' || !game || game.ended || !game.turnDeadline || now < game.turnDeadline || !room.players.length) return false;
  const expiredPlayer = room.players[game.activePlayerIndex];
  const completedTurns = game.completedTurns + 1;
  const completesChapter = completedTurns % room.players.length === 0;
  const ended = completedTurns >= game.maxTurns || game.adventure.worldDoom + 3 >= 100;
  game.completedTurns = completedTurns;
  game.adventure = { ...game.adventure, chapter: completesChapter ? Math.min(game.adventure.maxChapters, game.adventure.chapter + 1) : game.adventure.chapter, worldDoom: Math.min(100, game.adventure.worldDoom + 3) };
  game.outcome = { success: false, total: 0, target: game.adventure.target, label: `${expiredPlayer?.displayName || 'A player'} ran out of time`, detail: 'The turn was passed and World Doom rose by 3.' };
  game.roll = null;
  game.ended = ended;
  game.endReason = ended ? (game.adventure.worldDoom >= 100 ? 'World Doom consumed the realm.' : 'The final turn has passed.') : null;
  if (!ended) game.activePlayerIndex = (game.activePlayerIndex + 1) % room.players.length;
  game.turnStartedAt = now;
  game.turnDeadline = ended ? 0 : now + (game.turnSeconds || 30) * 1000;
  await commitRoom();
  return true;
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
    if (room.players.some((current) => current.hero.name === player.hero.name)) return 'That character has already been chosen.';
    const veilCount = room.players.filter((current) => current.hero.team === 'veil').length;
    player.hero.team = veilCount <= room.players.length - veilCount ? 'veil' : 'ember';
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

  if (message.type === 'leave') {
    if (room.phase !== 'lobby') return 'Players cannot leave during an active adventure.';
    if (!ownerId || ownerId !== message.sessionId) return 'You can only remove your own player.';
    room.players = room.players.filter((current) => current.id !== message.sessionId);
    await commitRoom();
    return null;
  }

  if (message.type === 'start') {
    if (room.phase !== 'lobby') return null;
    if (room.players.length < 2) return 'At least two players must join.';
    if (!room.players.every((player) => player.ready)) return 'Every joined player must be ready.';
    if (!message.game?.adventure) return 'The adventure state is missing.';
    room.phase = 'game';
    room.game = message.game;
    await commitRoom();
    return null;
  }

  if (message.type === 'game:update') {
    await advanceTimedOutTurn();
    if (room.phase !== 'game' || !room.game) return 'There is no active adventure.';
    const activePlayer = room.players[room.game.activePlayerIndex];
    if (!activePlayer || ownerId !== activePlayer.id) return 'Only the current player can resolve this turn.';
    if (!message.game?.adventure) return 'The turn update is incomplete.';
    room.game = message.game;
    await commitRoom();
    return null;
  }

  if (message.type === 'end-game') {
    if (room.phase !== 'game' || !room.game) return 'There is no active adventure.';
    if (!ownerId || ownerId !== message.sessionId || !room.players.some((player) => player.id === ownerId)) return 'Only a joined player can end the game.';
    const player = room.players.find((current) => current.id === ownerId);
    room.game.ended = true;
    room.game.endReason = `The adventure was ended by ${player?.displayName || 'a player'}.`;
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
        room.game.endReason = 'The adventure ended because fewer than two players remain.';
        room.game.turnDeadline = 0;
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
    send(socket, { type: 'state', state: publicState() });
    return;
  }
  await hydrateRoom();
  await advanceTimedOutTurn();
  const error = await applyCommand(peers.get(socket), message);
  if (error) send(socket, { type: 'error', message: error });
  else send(socket, { type: 'state', state: publicState() });
}

async function connectWebSocket() {
  await hydrateRoom();
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  server.accept();
  peers.set(server, '');
  send(server, { type: 'state', state: publicState() });
  server.addEventListener('message', (event) => handleSocketMessage(server, event.data));
  server.addEventListener('close', () => peers.delete(server));
  server.addEventListener('error', () => peers.delete(server));
  return new Response(null, { status: 101, webSocket: client });
}

function json(payload, status = 200) {
  return Response.json(payload, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function handleRoomApi(request) {
  await hydrateRoom();
  await advanceTimedOutTurn();
  if (request.method === 'GET') return json({ state: publicState() });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  let message;
  try {
    message = await request.json();
  } catch {
    return json({ error: 'The room received an invalid message.', state: publicState() }, 400);
  }
  const error = await applyCommand(String(message.sessionId || ''), message);
  return json({ state: publicState(), error: error || null }, error ? 400 : 200);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/room') return handleRoomApi(request);
    if (url.pathname === '/ws' && request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      return connectWebSocket();
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) return response;
    if (!url.pathname.includes('.')) {
      url.pathname = '/index.html';
      return env.ASSETS.fetch(new Request(url, request));
    }
    return response;
  }
};
