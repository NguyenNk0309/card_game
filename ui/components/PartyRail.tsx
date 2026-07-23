"use client";

import { Bot, Crown, Heart, Plus, Shield, Swords } from "lucide-react";
import type { Hero, TeamId } from "@/shared/types";

const teamMeta: Record<TeamId, { name: string; icon: typeof Shield }> = {
  veil: { name: "Veilbound", icon: Shield },
  ember: { name: "Embercourt", icon: Swords }
};

export function PartyRail({
  heroes,
  onAdd
}: {
  heroes: Hero[];
  onAdd: () => void;
}) {
  return (
    <aside className="party-rail">
      <div className="rail-heading">
        <div>
          <span className="eyebrow">COMPANY</span>
          <strong>{heroes.length}/10 bound</strong>
        </div>
        <button className="icon-button" onClick={onAdd} disabled={heroes.length >= 10} aria-label="Add another player" title="Add another player">
          <Plus size={17} />
        </button>
      </div>

      {(["veil", "ember"] as TeamId[]).map((team) => {
        const Icon = teamMeta[team].icon;
        const members = heroes.filter((hero) => hero.team === team);
        return (
          <section className={`team-block ${team}`} key={team}>
            <div className="team-title">
              <span><Icon size={14} /> {teamMeta[team].name}</span>
              <span>{members.length}</span>
            </div>
            {members.map((hero, index) => (
              <article className={`hero-row ${hero.isYou ? "is-you" : ""}`} key={hero.id}>
                <div className="portrait" style={{ "--hero-color": hero.color } as React.CSSProperties}>
                  {hero.initials}
                  {index === 0 && <Crown size={11} className="leader-mark" />}
                </div>
                <div className="hero-copy">
                  <div className="hero-name">
                    <strong>{hero.name}</strong>
                    {hero.isYou && <em>YOU</em>}
                  </div>
                  <span>{hero.role} · {hero.skill}</span>
                  <div className="hp-line">
                    <Heart size={10} fill="currentColor" />
                    <i><b style={{ width: `${(hero.hp / hero.maxHp) * 100}%` }} /></i>
                    <small>{hero.hp}</small>
                  </div>
                </div>
              </article>
            ))}
          </section>
        );
      })}

      {heroes.length < 10 && (
        <button className="add-player" onClick={onAdd}>
          <Bot size={15} />
          Add wanderer
        </button>
      )}
    </aside>
  );
}
