export const ROOM_ID_LENGTH = 8;
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

const ROOM_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_ID_PATTERN = new RegExp(`^[${ROOM_ID_ALPHABET}]{${ROOM_ID_LENGTH}}$`);

export function normalizeRoomId(value) {
  return String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "");
}

export function isValidRoomId(value) {
  return ROOM_ID_PATTERN.test(normalizeRoomId(value));
}

export function createRoomId() {
  const values = new Uint32Array(ROOM_ID_LENGTH);
  globalThis.crypto.getRandomValues(values);
  return Array.from(values, (value) => ROOM_ID_ALPHABET[value % ROOM_ID_ALPHABET.length]).join("");
}

export function roomExpiresAt(createdAt) {
  return Number(createdAt) + ROOM_TTL_MS;
}

export function roomIsExpired(expiresAt, now = Date.now()) {
  return Number(expiresAt) > 0 && now >= Number(expiresAt);
}
