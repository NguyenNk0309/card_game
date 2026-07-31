export const ROOM_ID_LENGTH: number;
export const ROOM_TTL_MS: number;
export function normalizeRoomId(value: unknown): string;
export function isValidRoomId(value: unknown): boolean;
export function createRoomId(): string;
export function roomExpiresAt(createdAt: number): number;
export function roomIsExpired(expiresAt: number, now?: number): boolean;
