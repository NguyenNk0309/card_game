const emptyRoom = () => ({ players: [], phase: 'lobby', game: null, revision: 0 });
let room = emptyRoom();
const peers = new Map();
const roomCacheKey = new Request('https://shattered-oath-room.internal/shared-state-v3');
let durableStorage = null;
let roomQueue = Promise.resolve();

function publicState() {
  return { players: room.players, phase: room.phase, game: room.game, revision: room.revision, serverNow: Date.now() };
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
      await durableStorage.put('shared-room', publicState());
      if (room.phase === 'game' && room.game?.turnDeadline && !room.game.ended) {
        await durableStorage.setAlarm(room.game.turnDeadline);
      } else {
        await durableStorage.deleteAlarm();
      }
      return;
    }
    await caches.default.put(roomCacheKey, new Response(JSON.stringify(publicState()), {
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

const teamLabel = (team) => team === 'veil' ? 'Veilbound' : 'Embercourt';
const randomDiceTarget = () => 8 + Math.floor(Math.random() * 9);
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
  const validIds = new Set(room.players.map((player) => player.id));
  const currentId = room.players[game.activePlayerIndex]?.id;
  const fallback = currentId ? [...room.players.slice(game.activePlayerIndex), ...room.players.slice(0, game.activePlayerIndex)].map((player) => player.id) : room.players.map((player) => player.id);
  const source = Array.isArray(game.turnOrder) && game.turnOrder.length ? game.turnOrder : fallback;
  const order = [...new Set([...source.filter((id) => validIds.has(id)), ...fallback])].filter((id) => (game.playerStates[id]?.hp || 0) > 0);
  game.turnOrder = order;
  if (order.length) { const index = room.players.findIndex((player) => player.id === order[0]); if (index >= 0) game.activePlayerIndex = index; }
  return order;
}
function rotateServerTurn(game, actorId) {
  const order = normalizeServerTurnOrder(game).filter((id) => id !== actorId);
  if ((game.playerStates[actorId]?.hp || 0) > 0 && room.players.some((player) => player.id === actorId)) order.push(actorId);
  game.turnOrder = order;
  normalizeServerTurnOrder(game);
}
function applyWorldEvent(game, turn, now) {
  const level = Math.ceil(turn / 5); const team = Math.random() < 0.5 ? 'veil' : 'ember'; const living = (filterTeam) => room.players.filter((player) => (!filterTeam || player.hero.team === filterTeam) && (game.playerStates[player.id]?.hp || 0) > 0); const kind = Math.floor(Math.random() * 5); let title = 'Battlefield Quake'; let description = '';
  if (kind === 0) { for (const player of living()) { const reduction = living(player.hero.team).some((ally) => ally.hero.classId === 'oracle') ? 1 : 0; game.playerStates[player.id].hp = Math.max(0, game.playerStates[player.id].hp - Math.max(0, level - reduction)); } description = `Every living player takes ${level} damage; a team with an Oracle reduces this by 1.`; }
  else if (kind === 1) { title = 'Emergency Supplies'; for (const player of living(team)) game.playerStates[player.id].hp = Math.min(game.playerStates[player.id].maxHp, game.playerStates[player.id].hp + level); description = `${teamLabel(team)} restores ${level} HP to every living member.`; }
  else if (kind === 2) { title = 'Armor-Shattering Wave'; for (const state of Object.values(game.playerStates)) state.shield = Math.max(0, (state.shield || 0) - level * 2); description = `Every player loses up to ${level * 2} shield.`; }
  else if (kind === 3) { title = 'Furious Momentum'; for (const player of living(team)) game.playerStates[player.id].attackBuff = (game.playerStates[player.id].attackBuff || 0) + level; description = `${teamLabel(team)} gains +${level} damage on each member's next attack.`; }
  else { title = 'Unclaimed Arrow Storm'; const reduction = living(team).some((ally) => ally.hero.classId === 'oracle') ? 1 : 0; for (const player of living(team)) game.playerStates[player.id].hp = Math.max(0, game.playerStates[player.id].hp - Math.max(0, level + 1 - reduction)); description = `${teamLabel(team)} takes ${level + 1} surprise damage; an Oracle reduces this by 1.`; }
  const event = { id: `world-${turn}-${now}`, turn, level, title, description, affectedTeam: kind === 0 || kind === 2 ? undefined : team }; game.worldEvent = event; game.history.push({ id: `${event.id}-history`, turn, kind: 'world', actorName: 'World Event', message: `World Event · Level ${level} — ${title}: ${description}`, success: true, createdAt: now });
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

async function passCurrentTurn(kind, now = Date.now()) {
  const game = room.game;
  if (room.phase !== 'game' || !game || game.ended || !room.players.length) return false;
  const order = normalizeServerTurnOrder(game);
  const passingPlayer = room.players.find((player) => player.id === order[0]) || room.players[game.activePlayerIndex];
  const completedTurns = game.completedTurns + 1;
  if (passingPlayer && game.playerStates[passingPlayer.id]) { game.playerStates[passingPlayer.id].diceBuff = 0; game.playerStates[passingPlayer.id].dicePenalty = 0; }
  const playerName = passingPlayer?.displayName || 'Player';
  const timedOut = kind === 'timeout';
  game.completedTurns = completedTurns;
  game.adventure = { ...game.adventure, chapter: Math.min(30, completedTurns + 1), target: randomDiceTarget() };
  game.outcome = { kind, success: false, total: 0, target: game.adventure.target, label: timedOut ? `${playerName} ran out of time` : `${playerName} skipped the turn`, detail: timedOut ? 'The turn was automatically passed. No cards were discarded or shuffled.' : 'The turn was skipped. No cards were discarded or shuffled.', actorName: playerName };
  game.history = [...(game.history || []), { id: `${kind}-${completedTurns}-${now}`, turn: completedTurns, kind, actorName: playerName, actorTeam: passingPlayer?.hero.team, message: timedOut ? `${playerName} ran out of time and automatically passed. Their hand was preserved.` : `${playerName} manually skipped the turn. Their hand was preserved.`, success: false, createdAt: now }];
  game.worldEvent = null;
  if (completedTurns % 5 === 0) applyWorldEvent(game, completedTurns, now);
  game.history = game.history.slice(-80);
  game.roll = null;
  const winner = decideWinner(game, passingPlayer?.hero.team || 'veil', completedTurns >= 30);
  game.ended = Boolean(winner); game.winnerTeam = winner;
  const veil = teamTotals(game, 'veil'); const ember = teamTotals(game, 'ember');
  game.endReason = winner ? `${teamLabel(winner)} wins. Total HP: Veilbound ${veil.hp} — Embercourt ${ember.hp}.` : null;
  if (!winner && passingPlayer) rotateServerTurn(game, passingPlayer.id);
  game.turnStartedAt = now;
  game.turnDeadline = winner ? 0 : now + (game.turnSeconds || 30) * 1000;
  await commitRoom();
  return true;
}

async function advanceTimedOutTurn(now = Date.now()) {
  const game = room.game;
  if (room.phase !== 'game' || !game || game.ended || !game.turnDeadline || now < game.turnDeadline || !room.players.length) return false;
  return passCurrentTurn('timeout', now);
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
    if (!room.players.every((player) => player.ready)) return 'Every joined player must be ready.';
    if (!message.game?.adventure) return 'The adventure state is missing.';
    room.phase = 'game';
    room.game = message.game;
    room.game.adventure.target = randomDiceTarget();
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
    message.game.adventure.target = randomDiceTarget();
    if (message.game.outcome?.kind === 'card') message.game.outcome.nextTarget = message.game.adventure.target;
    room.game = message.game;
    normalizeServerTurnOrder(room.game);
    await commitRoom();
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

  if (message.type === 'expire-turn') {
    await advanceTimedOutTurn();
    return null;
  }

  if (message.type === 'end-game') {
    if (room.phase !== 'game' || !room.game) return 'There is no active adventure.';
    if (!ownerId || ownerId !== message.sessionId || !room.players.some((player) => player.id === ownerId)) return 'Only a joined player can end the game.';
    const player = room.players.find((current) => current.id === ownerId);
    room.game.ended = true;
    room.game.winnerTeam = null;
    room.game.endReason = `The battle was ended by ${player?.displayName || 'a player'}.`;
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

async function handleRoomRequest(request) {
  const url = new URL(request.url);
  if (url.pathname === '/api/room') return serialized(() => handleRoomApi(request));
  if (url.pathname === '/ws' && request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
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
