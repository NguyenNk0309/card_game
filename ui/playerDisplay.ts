import type { PlayerSession } from "@/shared/types";

export function playerDisplayName(player: PlayerSession | undefined, localSessionId?: string) {
  if (!player) return "";
  return player.id === localSessionId ? "YOU" : player.displayName;
}

export function playerPossessiveName(player: PlayerSession | undefined, localSessionId?: string) {
  if (!player) return "A PLAYER'S";
  return player.id === localSessionId ? "YOUR" : `${player.displayName}'s`;
}
