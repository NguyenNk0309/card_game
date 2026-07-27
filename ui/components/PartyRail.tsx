"use client";

import { Check, Heart, Shield, Sparkles, Swords, UserMinus } from "lucide-react";
import { visibleDiceModifier } from "@/shared/diceVisibility";
import type { PlayerSession, SyncedGameState, TeamId } from "@/shared/types";

const teamMeta: Record<TeamId, { name: string; icon: typeof Shield }> = {
  veil: { name: "Veilbound", icon: Shield },
  ember: { name: "Embercourt", icon: Swords }
};

export function PartyRail({ players, game, localSessionId, onRemovePlayer, onInspectPlayer }: {
  players: PlayerSession[];
  game?: SyncedGameState | null;
  localSessionId?: string;
  onRemovePlayer?: (id: string) => void;
  onInspectPlayer?: (id: string) => void;
}) {
  const localPlayer = players.find((player) => player.id === localSessionId);
  const relationClass = (player: PlayerSession) => localPlayer ? (player.hero.team === localPlayer.hero.team ? "ally" : "enemy") : "neutral";
  return <aside className="party-rail">
    <div className="rail-heading"><div><span className="eyebrow">WARRIORS</span><strong>{players.length}/10 players</strong></div><span className="all-ready-mark"><Check size={13}/> Battle active</span></div>
    {(["veil", "ember"] as TeamId[]).map((team) => {
      const Icon = teamMeta[team].icon;
      const members = players.filter((player) => player.hero.team === team);
      return <section className={`team-block ${team}`} key={team}>
        <div className="team-title"><span><Icon size={14}/> {teamMeta[team].name}</span><span>{members.length}</span></div>
        {members.map((player) => {
          const hero = player.hero;
          const state = game?.playerStates[player.id];
          const hp = state?.hp ?? hero.hp;
          const maxHp = state?.maxHp ?? hero.maxHp;
          const dead = hp <= 0;
          const buffs: Array<{ label: string; value: string; negative?: boolean; shield?: boolean }> = [];
          if (state?.shield) buffs.push({ label: "Shield", value: `${state.shield}`, shield: true });
          if (state?.attackBuff) buffs.push({ label: "Next attack", value: `+${state.attackBuff} damage` });
          if (state?.diceBuff) buffs.push({ label: "Next d20", value: `+${visibleDiceModifier(state.diceBuff, player.id, localSessionId)}` });
          if (state?.dicePenalty) buffs.push({ label: "Next d20", value: `-${visibleDiceModifier(state.dicePenalty, player.id, localSessionId)}`, negative: true });
          if (state?.skipTurns) buffs.push({ label: "Cancelled turns", value: String(state.skipTurns), negative: true });
          if (state?.reviveIn) buffs.push({ label: "Revives in", value: `${state.reviveIn} turns` });
          if (state?.borrowedCards?.length) buffs.push({ label: "Borrowed cards", value: String(state.borrowedCards.length) });
          return <article className={`hero-row ${dead ? "is-dead" : ""} ${player.id === localSessionId ? "is-you" : ""}`} key={player.id}>
            <button className="portrait-button" onClick={() => onInspectPlayer?.(player.id)} aria-label={`View ${player.displayName}'s character`}><div className="portrait" style={{ "--hero-color": hero.color } as React.CSSProperties}>{hero.initials}</div></button>
            <div className="hero-copy">
              <div className="hero-name"><strong className={`player-name-highlight ${relationClass(player)}`}>{player.displayName}</strong><span className="hero-name-actions">{dead ? <em>DEFEATED</em> : null}{localSessionId && player.id !== localSessionId && onRemovePlayer && <button className="rail-remove-player" onClick={() => onRemovePlayer(player.id)} aria-label={`Remove ${player.displayName}`}><UserMinus size={12}/></button>}</span></div>
              <span>{hero.name} · {hero.className}</span>
              <div className="hp-line"><Heart size={11} fill="currentColor"/><div className="hp-meter" role="progressbar" aria-label={`${player.displayName} health`} aria-valuemin={0} aria-valuemax={maxHp} aria-valuenow={hp}><i style={{ width: `${Math.max(0, hp / maxHp) * 100}%` }}/><strong>{hp} / {maxHp} HP</strong></div></div>
              {buffs.length > 0 && <div className="roster-buff-row" aria-label={`${player.displayName} active effects`}>{buffs.map((buff, index) => <span className={`roster-buff-indicator ${buff.negative ? "negative" : ""} ${buff.shield ? "shield" : ""}`} tabIndex={0} aria-label={`${buff.label}: ${buff.value}`} key={`${buff.label}-${index}`}>{buff.shield ? <><Shield size={11}/><b>{buff.value}</b></> : <Sparkles size={12}/>}<span className="roster-buff-tooltip" role="tooltip"><strong>{buff.label}</strong><span className={buff.negative ? "negative" : ""}><em>{buff.value}</em></span></span></span>)}</div>}
            </div>
          </article>;
        })}
      </section>;
    })}
  </aside>;
}
