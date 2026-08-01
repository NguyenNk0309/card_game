"use client";

import { Archive, Check, Clover, Dices, Hand, Heart, Hourglass, Shield, Swords } from "lucide-react";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PlayerSession, SyncedGameState, TeamId } from "@/shared/types";
import { getStatusPresentations } from "@/shared/viewpoint.mjs";
import { fitTooltipToViewport } from "./tooltipPosition";

const teamMeta: Record<TeamId, { name: string; icon: typeof Shield }> = {
  veil: { name: "Veilbound", icon: Shield },
  ember: { name: "Embercourt", icon: Swords }
};

type StatusPresentation = ReturnType<typeof getStatusPresentations>[number];

function RosterEffect({ buff, icon }: { buff: StatusPresentation; icon: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState({ arrowLeft: 12, arrowTop: 12, left: 12, placement: "right" as "left" | "right", ready: false, top: 12 });
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();

  useLayoutEffect(() => {
    setPortalRoot(document.querySelector<HTMLElement>(".game-shell"));
  }, []);

  useLayoutEffect(() => {
    if (!open || !portalRoot) return;
    const placeTooltip = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const tooltip = tooltipRef.current?.getBoundingClientRect();
      if (!anchor || !tooltip) return;
      const next = fitTooltipToViewport(anchor, tooltip, { width: window.innerWidth, height: window.innerHeight });
      const arrowTop = Math.min(Math.max(next.top + 10, anchor.top + anchor.height / 2), next.top + tooltip.height - 10);
      setPosition({
        ...next,
        arrowLeft: next.placement === "right" ? next.left : next.left + tooltip.width,
        arrowTop,
        ready: true
      });
    };
    placeTooltip();
    window.addEventListener("resize", placeTooltip);
    window.addEventListener("scroll", placeTooltip, true);
    return () => {
      window.removeEventListener("resize", placeTooltip);
      window.removeEventListener("scroll", placeTooltip, true);
    };
  }, [open, portalRoot]);

  return <>
    <span
      ref={anchorRef}
      className={`roster-buff-indicator ${buff.negative ? "negative" : ""} ${buff.shield ? "shield" : ""}`}
      tabIndex={0}
      aria-label={`${buff.label}: ${buff.tooltipValue ?? buff.value}${buff.durationLabel ? ` - ${buff.durationLabel}` : ""}. ${buff.tooltip}`}
      aria-describedby={open ? tooltipId : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {icon}<b>{buff.displayValue}</b>
    </span>
    {open && portalRoot && createPortal(<>
      <span
        ref={tooltipRef}
        id={tooltipId}
        className="roster-buff-tooltip is-visible"
        role="tooltip"
        style={{ left: position.left, top: position.top, visibility: position.ready ? "visible" : "hidden" }}
      >
        <strong>{buff.label}</strong>
        <span className={buff.negative ? "negative" : ""}><em>{buff.tooltipValue ?? buff.value}</em>{buff.durationLabel && <><i aria-hidden="true">-</i><b>{buff.durationLabel}</b></>}</span>
        <p>{buff.tooltip}</p>
      </span>
      <span className={`tooltip-arrow roster-tooltip-arrow placement-${position.placement}`} aria-hidden="true" style={{ left: position.arrowLeft, top: position.arrowTop, visibility: position.ready ? "visible" : "hidden" }}/>
      </>,
      portalRoot
    )}
  </>;
}

export function PartyRail({ players, game, localSessionId, onInspectPlayer }: {
  players: PlayerSession[];
  game?: SyncedGameState | null;
  localSessionId?: string;
  onInspectPlayer?: (id: string) => void;
}) {
  const localPlayer = players.find((player) => player.id === localSessionId);
  const relationClass = (player: PlayerSession) => localPlayer ? (player.hero.team === localPlayer.hero.team ? "ally" : "enemy") : "neutral";
  const currentPhase = Math.min(30, (game?.completedPhases ?? 0) + 1);
  const statusIcon = (kind: ReturnType<typeof getStatusPresentations>[number]["kind"]) => kind === "shield" ? <Shield size={11}/>
    : kind === "attackBuff" ? <Swords size={11}/>
      : kind === "diceBuff" || kind === "dicePenalty" ? <Dices size={11}/>
        : kind === "zeroPity" ? <Clover size={11}/>
          : kind === "skipTurns" ? <Hourglass size={11}/>
            : kind === "revive" ? <Heart size={11}/>
              : kind === "purgedCards" ? <Archive size={11}/>
                : <Hand size={11}/>;
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
          const buffs = state ? getStatusPresentations(player, state, players, localSessionId, currentPhase) : [];
          return <article className={`hero-row ${dead ? "is-dead" : ""} ${player.id === localSessionId ? "is-you" : ""}`} key={player.id}>
            <button className="portrait-button" onClick={() => onInspectPlayer?.(player.id)} aria-label={`View ${player.displayName}'s character`}><div className="portrait" style={{ "--hero-color": hero.color } as React.CSSProperties}>{hero.initials}</div></button>
            <div className="hero-copy">
              <div className="hero-name"><strong className={`player-name-highlight ${relationClass(player)}`}>{player.displayName}</strong>{dead ? <em>DEFEATED</em> : null}</div>
              <span>{hero.name}</span>
              <div className="hp-line"><Heart size={11} fill="currentColor"/><div className="hp-meter" role="progressbar" aria-label={`${player.displayName} health`} aria-valuemin={0} aria-valuemax={maxHp} aria-valuenow={hp}><i style={{ width: `${Math.max(0, hp / maxHp) * 100}%` }}/><strong>{hp} / {maxHp} HP</strong></div></div>
              {buffs.length > 0 && <div className="roster-buff-row" aria-label={`${player.displayName} active effects`}>{buffs.map((buff, index) => <RosterEffect buff={buff} icon={statusIcon(buff.kind)} key={`${buff.kind}-${index}`}/>)}</div>}
            </div>
          </article>;
        })}
      </section>;
    })}
  </aside>;
}
