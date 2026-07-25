"use client";

import { Check, Crown, Heart, Shield, Swords, UserMinus } from "lucide-react";
import type { PlayerSession, SyncedGameState, TeamId } from "@/shared/types";

const teamMeta: Record<TeamId, { name: string; icon: typeof Shield }> = {
  veil: { name: "Veilbound", icon: Shield },
  ember: { name: "Embercourt", icon: Swords }
};

export function PartyRail({ players, activePlayerId, game, localSessionId, onRemovePlayer, onInspectPlayer }: {
  players: PlayerSession[];
  activePlayerId: string;
  game?: SyncedGameState | null;
  localSessionId?: string;
  onRemovePlayer?: (id: string) => void;
  onInspectPlayer?: (id: string) => void;
}) {
  return <aside className="party-rail">
    <div className="rail-heading"><div><span className="eyebrow">WARRIORS</span><strong>{players.length}/10 players</strong></div><span className="all-ready-mark"><Check size={13}/> Battle active</span></div>
    {(["veil", "ember"] as TeamId[]).map((team) => {
      const Icon = teamMeta[team].icon;
      const members = players.filter((player) => player.hero.team === team);
      return <section className={`team-block ${team}`} key={team}>
        <div className="team-title"><span><Icon size={14}/> {teamMeta[team].name}</span><span>{members.length}</span></div>
        {members.map((player, index) => {
          const hero = player.hero;
          const state = game?.playerStates[player.id];
          const hp = state?.hp ?? hero.hp;
          const maxHp = state?.maxHp ?? hero.maxHp;
          const dead = hp <= 0;
          const active = !dead && player.id === activePlayerId;
          const hasBuff = Boolean(state && (state.attackBuff || state.diceBuff || state.dicePenalty));
          return <article className={`hero-row ${active ? "is-active" : ""} ${dead ? "is-dead" : ""} ${player.id === localSessionId ? "is-you" : ""}`} key={player.id}>
            <button className="portrait-button" onClick={() => onInspectPlayer?.(player.id)} aria-label={`View ${player.displayName}'s character`}><div className="portrait" style={{ "--hero-color": hero.color } as React.CSSProperties}>{hero.initials}{index === 0 && <Crown size={11} className="leader-mark"/>}</div></button>
            <div className="hero-copy">
              <div className="hero-name"><strong>{player.displayName}</strong><span className="hero-name-actions">{dead ? <em>DEFEATED</em> : active ? <em>TURN</em> : null}{localSessionId && player.id !== localSessionId && onRemovePlayer && <button className="rail-remove-player" onClick={() => onRemovePlayer(player.id)} aria-label={`Remove ${player.displayName}`}><UserMinus size={12}/></button>}</span></div>
              <span>{hero.name} · {hero.className}</span>
              <div className="hp-line"><Heart size={10} fill="currentColor"/><i><b style={{ width: `${Math.max(0, hp / maxHp) * 100}%` }}/></i><small>{hp} HP{state?.shield ? ` + ${state.shield} shield` : ""}</small></div>
              {hasBuff && state && <div className="buff-line">{state.attackBuff ? `Attack +${state.attackBuff}` : ""} {state.diceBuff ? `d20 +${state.diceBuff}` : ""} {state.dicePenalty ? <em className="negative-buff">d20 -{state.dicePenalty}</em> : ""}</div>}
            </div>
          </article>;
        })}
      </section>;
    })}
  </aside>;
}
