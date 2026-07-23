"use client";

import { Check, Crown, Heart, Shield, Swords } from "lucide-react";
import type { PlayerSession, SyncedGameState, TeamId } from "@/shared/types";

const teamMeta: Record<TeamId, { name: string; icon: typeof Shield }> = {
  veil: { name: "Veilbound", icon: Shield },
  ember: { name: "Embercourt", icon: Swords }
};

export function PartyRail({
  players,
  activePlayerId,
  game
}: {
  players: PlayerSession[];
  activePlayerId: string;
  game?: SyncedGameState | null;
}) {
  return (
    <aside className="party-rail">
      <div className="rail-heading">
        <div>
          <span className="eyebrow">COMPANY</span>
          <strong>{players.length}/10 joined</strong>
        </div>
        <span className="all-ready-mark"><Check size={13} /> All ready</span>
      </div>

      {(["veil", "ember"] as TeamId[]).map((team) => {
        const Icon = teamMeta[team].icon;
        const members = players.filter((player) => player.hero.team === team);
        return (
          <section className={`team-block ${team}`} key={team}>
            <div className="team-title">
              <span><Icon size={14} /> {teamMeta[team].name}</span>
              <span>{members.length}</span>
            </div>
            {members.map((player, index) => {
              const hero = player.hero;
              const runState = game?.playerStates[player.id];
              const hp = runState?.hp ?? hero.hp;
              const maxHp = runState?.maxHp ?? hero.maxHp;
              const active = player.id === activePlayerId;
              return (
                <article className={`hero-row ${active ? "is-active" : ""}`} key={player.id}>
                  <div className="portrait" style={{ "--hero-color": hero.color } as React.CSSProperties}>
                    {hero.initials}
                    {index === 0 && <Crown size={11} className="leader-mark" />}
                  </div>
                  <div className="hero-copy">
                    <div className="hero-name">
                      <strong>{player.displayName}</strong>
                      {active && <em>TURN</em>}
                    </div>
                    <span>{hero.name} · {hero.role}</span>
                    <div className="hp-line">
                      <Heart size={10} fill="currentColor" />
                      <i><b style={{ width: `${(hp / maxHp) * 100}%` }} /></i>
                      <small>{hp}{runState?.shield ? ` +${runState.shield}` : ""}</small>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        );
      })}
    </aside>
  );
}
