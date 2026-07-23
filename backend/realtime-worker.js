const room = { players: [], phase: 'lobby', game: null, revision: 0 };
const peers = new Map();

function publicState() {
  return { players: room.players, phase: room.phase, game: room.game, revision: room.revision };
}

function send(socket, payload) {
  if (socket.readyState === 1) socket.send(JSON.stringify(payload));
}

function broadcast() {
  room.revision += 1;
  const message = JSON.stringify({ type: 'state', state: publicState() });
  for (const socket of peers.keys()) {
    if (socket.readyState === 1) socket.send(message);
  }
}

function reject(socket, message) {
  send(socket, { type: 'error', message });
}

function owns(socket, id) {
  return Boolean(id && peers.get(socket) === id);
}

function handleMessage(socket, text) {
  let message;
  try {
    message = JSON.parse(text);
  } catch {
    return reject(socket, 'The room received an invalid message.');
  }

  if (message.type === 'hello') {
    peers.set(socket, String(message.sessionId || ''));
    return send(socket, { type: 'state', state: publicState() });
  }

  if (message.type === 'join') {
    const player = message.player;
    if (room.phase !== 'lobby') return reject(socket, 'The adventure has already started.');
    if (!player?.id || !player?.displayName || !player?.hero || !Array.isArray(player.skillDeck)) return reject(socket, 'The player session is incomplete.');
    if (!owns(socket, player.id)) return reject(socket, 'This browser cannot create another browser session.');
    if (room.players.some((current) => current.id === player.id)) return send(socket, { type: 'state', state: publicState() });
    if (room.players.length >= 10) return reject(socket, 'This lobby already has 10 players.');
    if (room.players.some((current) => current.displayName.toLowerCase() === player.displayName.toLowerCase())) return reject(socket, 'That player name is already joined.');
    const veilCount = room.players.filter((current) => current.hero.team === 'veil').length;
    player.hero.team = veilCount <= room.players.length - veilCount ? 'veil' : 'ember';
    room.players.push({ ...player, ready: false });
    return broadcast();
  }

  if (message.type === 'ready') {
    if (room.phase !== 'lobby') return reject(socket, 'Readiness can only change in the lobby.');
    if (!owns(socket, message.sessionId)) return reject(socket, 'You can only ready your own player.');
    const player = room.players.find((current) => current.id === message.sessionId);
    if (!player) return reject(socket, 'Join the lobby before pressing Ready.');
    player.ready = !player.ready;
    return broadcast();
  }

  if (message.type === 'leave') {
    if (room.phase !== 'lobby') return reject(socket, 'Players cannot leave during an active adventure.');
    if (!owns(socket, message.sessionId)) return reject(socket, 'You can only remove your own player.');
    room.players = room.players.filter((current) => current.id !== message.sessionId);
    return broadcast();
  }

  if (message.type === 'start') {
    if (room.phase !== 'lobby') return;
    if (room.players.length < 2) return reject(socket, 'At least two players must join.');
    if (!room.players.every((player) => player.ready)) return reject(socket, 'Every joined player must be ready.');
    if (!message.game?.adventure) return reject(socket, 'The adventure state is missing.');
    room.phase = 'game';
    room.game = message.game;
    return broadcast();
  }

  if (message.type === 'game:update') {
    if (room.phase !== 'game' || !room.game) return reject(socket, 'There is no active adventure.');
    const activePlayer = room.players[room.game.activePlayerIndex];
    if (!activePlayer || !owns(socket, activePlayer.id)) return reject(socket, 'Only the current player can resolve this turn.');
    if (!message.game?.adventure) return reject(socket, 'The turn update is incomplete.');
    room.game = message.game;
    return broadcast();
  }

  if (message.type === 'return:lobby') {
    room.phase = 'lobby';
    room.game = null;
    room.players = room.players.map((player) => ({ ...player, ready: false }));
    return broadcast();
  }
}

function connectWebSocket() {
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  server.accept();
  peers.set(server, '');
  send(server, { type: 'state', state: publicState() });
  server.addEventListener('message', (event) => handleMessage(server, event.data));
  server.addEventListener('close', () => peers.delete(server));
  server.addEventListener('error', () => peers.delete(server));
  return new Response(null, { status: 101, webSocket: client });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
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
