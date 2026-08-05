"use client";

import type { PlayerSession } from "@/shared/types";

function relationClass(player?: PlayerSession, localPlayer?: PlayerSession) {
  if (!player || !localPlayer) return "neutral";
  return player.hero.team === localPlayer.hero.team ? "ally" : "enemy";
}

export function HighlightPlayerNames({ text = "", players, localPlayer, onInspect }: {
  text?: string;
  players: PlayerSession[];
  localPlayer?: PlayerSession;
  onInspect?: (id: string) => void;
  useActualNames?: boolean;
}) {
  const playerByName = new Map(players.map((player) => [player.displayName.toLocaleLowerCase(), player]));
  const names = [...playerByName.keys()].sort((left, right) => right.length - left.length);
  if (!text || !names.length) return <>{text}</>;
  const escapedNames = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`((?:${escapedNames.join("|")})(?:'s)?)`, "gi"));
  return <>{parts.map((part, index) => {
    const possessive = /'s$/i.test(part);
    const rawName = possessive ? part.slice(0, -2) : part;
    const player = playerByName.get(rawName.toLocaleLowerCase());
    if (!player) return part;
    const className = `inline-player-name ${relationClass(player, localPlayer)}`;
    return onInspect
      ? <button type="button" className={`${className} history-player-link`} title={player.hero.name} aria-label={`View ${part}, ${player.hero.name}`} onClick={() => onInspect(player.id)} key={`${part}-${index}`}>{part}</button>
      : <span className={className} key={`${part}-${index}`}>{part}</span>;
  })}</>;
}
