import assert from "node:assert/strict";
import WebSocket from "ws";
import { createRoomId, isValidRoomId, ROOM_TTL_MS, roomIsExpired } from "../shared/roomId.mjs";

const origin = process.env.ROOMS_ORIGIN || "http://127.0.0.1:3105";
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

async function readJson(response) {
  const payload = await response.json();
  return { response, payload };
}

async function createRoom() {
  const { response, payload } = await readJson(await fetch(`${origin}/api/rooms`, { method: "POST" }));
  assert.equal(response.status, 201, payload.error || "room creation must return 201");
  assert(payload.room, "room creation must return metadata");
  return payload.room;
}

async function roomState(roomId, sessionId = "") {
  const query = new URLSearchParams({ roomId, sessionId });
  const { response, payload } = await readJson(await fetch(`${origin}/api/room?${query}`, { cache: "no-store" }));
  assert.equal(response.status, 200, payload.error || "created room must be readable");
  return payload.state;
}

function websocketState(roomId, sessionId) {
  const socketUrl = new URL(origin);
  socketUrl.protocol = socketUrl.protocol === "https:" ? "wss:" : "ws:";
  socketUrl.pathname = "/ws";
  socketUrl.search = new URLSearchParams({ roomId }).toString();
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(socketUrl);
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`Timed out reading WebSocket room ${roomId}.`));
    }, 5000);
    socket.once("open", () => socket.send(JSON.stringify({ type: "hello", sessionId })));
    socket.on("message", (raw) => {
      const message = JSON.parse(String(raw));
      if (message.type !== "state") return;
      clearTimeout(timer);
      socket.close();
      resolve(message.state);
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

const first = await createRoom();
const second = await createRoom();

assert(isValidRoomId(first.roomId), "created rooms must use valid human-readable IDs");
assert(isValidRoomId(second.roomId), "every created room must use a valid ID");
assert.notEqual(first.roomId, second.roomId, "created rooms must be isolated by unique IDs");
assert.equal(first.expiresAt - first.createdAt, ROOM_TTL_MS, "room lifetime must be exactly 24 hours");
assert.equal(roomIsExpired(first.expiresAt, first.expiresAt - 1), false, "room must remain valid before its expiry instant");
assert.equal(roomIsExpired(first.expiresAt, first.expiresAt), true, "room must expire at its 24-hour deadline");

const metadataResponse = await readJson(await fetch(`${origin}/api/rooms/${first.roomId}`, { cache: "no-store" }));
assert.equal(metadataResponse.response.status, 200);
assert.deepEqual(metadataResponse.payload.room, first, "room lookup must return stable creation and expiry metadata");

const invalidResponse = await fetch(`${origin}/api/rooms/invalid`, { cache: "no-store" });
assert.equal(invalidResponse.status, 400, "malformed room IDs must be rejected");

let missingId = createRoomId();
while (missingId === first.roomId || missingId === second.roomId) missingId = createRoomId();
const missingResponse = await fetch(`${origin}/api/rooms/${missingId}`, { cache: "no-store" });
assert.equal(missingResponse.status, 404, "unknown valid room IDs must not create rooms implicitly");

const playerId = `room-player-${runId}`;
const player = {
  id: playerId,
  displayName: `Room Player ${runId}`,
  ready: false,
  joinedAt: Date.now(),
  hero: { id: `hero-${playerId}`, name: "Room Test Hero", team: "veil" },
  skillDeck: []
};
const joinQuery = new URLSearchParams({ roomId: first.roomId });
const joinResponse = await readJson(await fetch(`${origin}/api/room?${joinQuery}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ type: "join", sessionId: playerId, player })
}));
assert.equal(joinResponse.response.status, 200, joinResponse.payload.error || "player must be able to join a created room");
assert.equal(joinResponse.payload.state.players.length, 1);

const firstState = await roomState(first.roomId, playerId);
const secondState = await roomState(second.roomId, playerId);
assert.equal(firstState.roomId, first.roomId);
assert.equal(secondState.roomId, second.roomId);
assert(firstState.players.some((entry) => entry.id === playerId), "joined player must remain in the selected room");
assert.equal(secondState.players.length, 0, "another room must keep its own empty lobby");

const firstSocketState = await websocketState(first.roomId, playerId);
const secondSocketState = await websocketState(second.roomId, playerId);
assert(firstSocketState.players.some((entry) => entry.id === playerId), "room-scoped WebSocket must open the selected populated lobby");
assert.equal(secondSocketState.players.length, 0, "room-scoped WebSocket must not leak players from another lobby");

console.log("Room lifecycle test passed: creation, lookup, 24-hour expiry contract, validation, and isolated HTTP/WebSocket lobbies.");
