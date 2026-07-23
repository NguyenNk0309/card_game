import type { Adventure, Hero } from "@/shared/types";

export type GameRoom = {
  id: string;
  adventure: Adventure;
  players: Hero[];
  updatedAt: number;
};

/**
 * Development repository. The interface is intentionally storage-agnostic so a
 * durable Postgres/Redis adapter can replace this map without touching game code.
 */
export class GameRoomRepository {
  private rooms = new Map<string, GameRoom>();

  get(id: string) {
    return this.rooms.get(id);
  }

  save(room: GameRoom) {
    this.rooms.set(room.id, { ...room, updatedAt: Date.now() });
    return this.rooms.get(room.id)!;
  }
}

export const gameRooms = new GameRoomRepository();
