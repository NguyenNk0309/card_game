"use client";

import { Archive, Check, Clover, Dices, Hand, Heart, Hourglass, Shield, Swords } from "lucide-react";
import { AnimatePresence, LayoutGroup } from "motion/react";
import * as m from "motion/react-m";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PlayerSession, SyncedGameState, TeamId } from "@/shared/types";
import { getStatusPresentations } from "@/shared/viewpoint.mjs";
import { getCurrentBattlePhase } from "@/shared/battlePhases.mjs";
import { CharacterAvatar } from "./CharacterAvatar";
import { HighlightPlayerNames } from "./HighlightPlayerNames";
import { fitTooltipToViewport } from "./tooltipPosition";
import { fadePresence, motionTransition, popPresence } from "../motion/presets";

const teamMeta: Record<TeamId, { name: string; icon: typeof Shield }> = {
  veil: { name: "Veilbound", icon: Shield },
  ember: { name: "Embercourt", icon: Swords }
};

type StatusPresentation = ReturnType<typeof getStatusPresentations>[number];

function RosterAvatar({ hero, playerName, onInspect }: {
  hero: PlayerSession["hero"];
  playerName: string;
  onInspect?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState({ arrowLeft: 12, arrowTop: 12, left: 12, placement: "right" as "left" | "right", ready: false, top: 12 });
  const anchorRef = useRef<HTMLButtonElement>(null);
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

  const showTooltip = () => {
    setPosition((current) => ({ ...current, ready: false }));
    setOpen(true);
  };

  return <>
    <button
      ref={anchorRef}
      className="portrait-button"
      onClick={onInspect}
      aria-label={`View ${playerName}'s character`}
      aria-describedby={open ? tooltipId : undefined}
      onMouseEnter={showTooltip}
      onMouseLeave={() => setOpen(false)}
      onFocus={showTooltip}
      onBlur={() => setOpen(false)}
    >
      <CharacterAvatar hero={hero} sizes="38px"/>
    </button>
    {portalRoot && createPortal(<AnimatePresence>{open && <>
      <m.span
        key="avatar-tooltip"
        ref={tooltipRef}
        id={tooltipId}
        className="battle-avatar-tooltip"
        role="tooltip"
        aria-label={`Enlarged avatar of ${hero.name}`}
        style={{ left: position.left, top: position.top, visibility: position.ready ? "visible" : "hidden" }}
        variants={popPresence}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={motionTransition.quick}
      >
        <CharacterAvatar hero={hero} className="large-portrait battle-avatar-tooltip-image" sizes="180px"/>
      </m.span>
      <m.span key="avatar-arrow" className={`tooltip-arrow roster-tooltip-arrow placement-${position.placement}`} aria-hidden="true" style={{ left: position.arrowLeft, top: position.arrowTop, visibility: position.ready ? "visible" : "hidden" }} variants={fadePresence} initial="hidden" animate="visible" exit="exit"/>
    </>}</AnimatePresence>, portalRoot)}
  </>;
}

function RosterEffect({ buff, icon, players, localPlayer }: { buff: StatusPresentation; icon: React.ReactNode; players: PlayerSession[]; localPlayer?: PlayerSession }) {
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

  const tone = buff.kind === "shield" || buff.kind === "goldenShield" ? "shield"
    : buff.kind === "attackBuff" || buff.kind === "shopAttack" || buff.kind === "piercingAttack" ? "attack"
      : buff.kind === "markedTarget" ? "marked"
        : buff.kind === "diceBuff" || buff.kind === "dicePenalty" || buff.kind === "shopDice" || buff.kind === "additionalDie" || buff.kind === "luckyDie" ? "dice"
          : buff.kind === "zeroPity" || buff.kind === "shopFreePity" ? "pity"
            : buff.kind === "skipTurns" ? "speed"
              : buff.kind === "revive" ? "heal"
                : buff.kind === "borrowedCards" || buff.kind === "purgedCards" ? "cards"
                  : "support";

  return <>
    <span
      ref={anchorRef}
      className={`roster-buff-indicator effect-${tone} ${buff.negative ? "negative" : ""} ${buff.shield ? "shield" : ""} ${buff.golden ? "golden" : ""} ${buff.kind === "attackBuff" ? "attack" : ""}`}
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
    {portalRoot && createPortal(<AnimatePresence>{open && <>
      <m.span
        key="effect-tooltip"
        ref={tooltipRef}
        id={tooltipId}
        className={`roster-buff-tooltip is-visible effect-${tone} ${buff.golden ? "golden" : ""} ${buff.kind === "attackBuff" ? "attack" : ""}`}
        role="tooltip"
        style={{ left: position.left, top: position.top, visibility: position.ready ? "visible" : "hidden" }}
        variants={popPresence}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={motionTransition.quick}
      >
        <strong><HighlightPlayerNames text={buff.label} players={players} localPlayer={localPlayer} useActualNames/></strong>
        <span className={`effect-${tone} ${buff.negative ? "negative" : buff.kind === "attackBuff" ? "attack" : ""}`}><em>{buff.tooltipValue ?? buff.value}</em>{buff.durationLabel && <><i aria-hidden="true">-</i><b>{buff.durationLabel}</b></>}</span>
        <p>{buff.tooltip}</p>
      </m.span>
      <m.span key="effect-arrow" className={`tooltip-arrow roster-tooltip-arrow placement-${position.placement}`} aria-hidden="true" style={{ left: position.arrowLeft, top: position.arrowTop, visibility: position.ready ? "visible" : "hidden" }} variants={fadePresence} initial="hidden" animate="visible" exit="exit"/>
      </>}</AnimatePresence>,
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
  const currentPhase = getCurrentBattlePhase(game?.completedPhases ?? 0);
  const statusIcon = (kind: ReturnType<typeof getStatusPresentations>[number]["kind"]) => kind === "shield" || kind === "goldenShield" ? <Shield size={11}/>
    : kind === "attackBuff" || kind === "shopAttack" || kind === "piercingAttack" ? <Swords size={11}/>
      : kind === "diceBuff" || kind === "dicePenalty" || kind === "shopDice" || kind === "additionalDie" || kind === "luckyDie" || kind === "markedTarget" ? <Dices size={11}/>
        : kind === "zeroPity" || kind === "shopFreePity" ? <Clover size={11}/>
          : kind === "skipTurns" ? <Hourglass size={11}/>
            : kind === "revive" ? <Heart size={11}/>
              : kind === "purgedCards" ? <Archive size={11}/>
                : <Hand size={11}/>;
  return <m.aside className="party-rail" variants={fadePresence} initial="hidden" animate="visible" transition={motionTransition.standard}>
    <div className="rail-heading"><div><span className="eyebrow">WARRIORS</span><strong>{players.length}/10 players</strong></div><span className="all-ready-mark"><Check size={13}/> Battle active</span></div>
    {(["veil", "ember"] as TeamId[]).map((team) => {
      const Icon = teamMeta[team].icon;
      const members = players.filter((player) => player.hero.team === team);
      return <LayoutGroup id={`party-${team}`} key={team}><section className={`team-block ${team}`}>
        <div className="team-title"><span><Icon size={14}/> {teamMeta[team].name}</span><span>{members.length}</span></div>
        <AnimatePresence initial={false} mode="popLayout">{members.map((player) => {
          const hero = player.hero;
          const state = game?.playerStates[player.id];
          const hp = state?.hp ?? hero.hp;
          const maxHp = state?.maxHp ?? hero.maxHp;
          const dead = hp <= 0;
          const buffs = state ? getStatusPresentations(player, state, players, localSessionId, currentPhase) : [];
          return <m.article layout className={`hero-row ${dead ? "is-dead" : ""} ${player.id === localSessionId ? "is-you" : ""}`} variants={popPresence} initial="hidden" animate={{ opacity: dead ? 0.48 : 1, filter: dead ? "grayscale(.82) contrast(1.1)" : "grayscale(0) contrast(1)" }} exit="exit" transition={motionTransition.layout} key={player.id}>
            <RosterAvatar hero={hero} playerName={player.displayName} onInspect={() => onInspectPlayer?.(player.id)}/>
            <div className="hero-copy">
              <div className="hero-name"><strong className={`player-name-highlight ${relationClass(player)}`}>{player.displayName}</strong><AnimatePresence>{dead ? <m.em variants={popPresence} initial="hidden" animate="visible" exit="exit">DEFEATED</m.em> : null}</AnimatePresence></div>
              <span>{hero.name}</span>
              <div className="hp-line"><Heart size={11} fill="currentColor"/><div className="hp-meter" role="progressbar" aria-label={`${player.displayName} health`} aria-valuemin={0} aria-valuemax={maxHp} aria-valuenow={hp}><m.i initial={false} animate={{ scaleX: Math.max(0, hp / maxHp) }} transition={motionTransition.standard} style={{ transformOrigin: "left center" }}/><AnimatePresence initial={false} mode="popLayout"><m.strong key={`${hp}:${maxHp}`} variants={popPresence} initial="hidden" animate="visible" exit="exit">{hp} / {maxHp} HP</m.strong></AnimatePresence></div></div>
              <AnimatePresence initial={false}>{buffs.length > 0 && <m.div layout className="roster-buff-row" aria-label={`${player.displayName} active effects`} variants={fadePresence} initial="hidden" animate="visible" exit="exit">{buffs.map((buff, index) => <m.span layout className="roster-effect-motion" variants={popPresence} initial="hidden" animate="visible" exit="exit" key={`${buff.kind}-${index}`}><RosterEffect buff={buff} icon={statusIcon(buff.kind)} players={players} localPlayer={localPlayer}/></m.span>)}</m.div>}</AnimatePresence>
            </div>
          </m.article>;
        })}</AnimatePresence>
      </section></LayoutGroup>;
    })}
  </m.aside>;
}
