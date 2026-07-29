"use client";

import { Archive, AudioLines, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Crown, Dices, Eye, Flame, Hand, Heart, History, Hourglass, Layers, ListOrdered, LogOut, Octagon, RefreshCw, Shield, Skull, Sparkles, Target, Users, Volume2, X, Zap } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createAdventure, createInitialGame, createPlayerSession, getCharacterOptions, getPassiveDiceBonus, randomD20Roll, resolveCardTurn } from "@/backend/game/engine";
import { describeCardFailure, describeCardSuccess, getEffectiveCardPityCost, getCardTargetLabel, hasFavorableOmen } from "@/shared/cardRules";
import { visibleDiceModifier } from "@/shared/diceVisibility";
import { getWorldEventScheduleEntry, getWorldEventsForPhase, isWorldEventPhase } from "@/shared/worldEvents.mjs";
import type { ActionCard, GameHistoryEntry, GameNotice, GameOutcome, PlayerLifeEvent, PlayerSession, SyncedGameState, TeamId, WorldEventOutcome } from "@/shared/types";
import { DiceRoller } from "./components/DiceRoller";
import { EffectText } from "./components/EffectText";
import { Lobby } from "./components/Lobby";
import { PartyRail } from "./components/PartyRail";
import { CardEffectIcon } from "./components/CardEffectIcon";
import { PityCostBadge, PityIcon } from "./components/PityCost";
import { ResolvedWorldEventPanel, ShatteredTributeChoicePanel, WorldEventLibrary } from "./components/WorldEventPanels";
import { useGameAudio } from "./hooks/useGameAudio";
import { useRoomSocket } from "./hooks/useRoomSocket";

const teamName: Record<TeamId, string> = { veil: "Veilbound", ember: "Embercourt" };
const PLAYER_NAME_STORAGE_KEY = "shattered-oath-player-name";
type PresentationQueueItem =
  | { id: string; kind: "world"; event: WorldEventOutcome }
  | { id: string; kind: "life"; lifeEvent: PlayerLifeEvent }
  | { id: string; kind: "battle"; battleKey: string };
const teamRelationClass = (team?: TeamId, localTeam?: TeamId) => team && localTeam ? (team === localTeam ? "ally" : "enemy") : "neutral";
const playerRelationClass = (player?: PlayerSession, localPlayer?: PlayerSession) => teamRelationClass(player?.hero.team, localPlayer?.hero.team);
function CardOutcomeLines({ card }: { card: ActionCard }) {
  return <div className="card-outcome-lines"><p className="card-success-line"><Check size={13}/><span><b>SUCCESS</b><EffectText text={describeCardSuccess(card)} card={card}/></span></p><p className="card-failure-line"><X size={13}/><span><b>FAILURE</b><EffectText text={describeCardFailure(card)} card={card}/></span></p></div>;
}

function AutomaticSuccessNotice({ roll }: { roll?: number }) {
  return <div className="automatic-success-notice"><Check size={22}/><span><small>ZERO-PITY CARD</small><strong>Automatic success</strong><b>d20 {roll ?? 0} was ignored</b></span></div>;
}

function GameNoticeIcon({ kind }: { kind: GameNotice["kind"] }) {
  if (kind === "pity-gained" || kind === "pity-spent") return <PityIcon size={19}/>;
  if (kind === "graveyard") return <Archive size={19}/>;
  if (kind === "deck-reshuffle") return <RefreshCw size={19}/>;
  return <Sparkles size={19}/>;
}

function HandCardContents({ card, player, pityCostOverride }: { card: ActionCard; player: PlayerSession; pityCostOverride?: number }) {
  return <><PityCostBadge card={card} costOverride={pityCostOverride}/>{card.unique && <span className="special-skill-banner"><Crown size={12}/> {player.hero.className.toUpperCase()} SKILL</span>}<div className={`card-sigil effect-${card.effect}`}><CardEffectIcon card={card}/></div><span>{card.unique ? "Special card" : card.effect === "none" ? "No-effect card" : "Common action"}</span><strong>{card.name}</strong><p><EffectText text={card.description} card={card}/></p><CardOutcomeLines card={card}/></>;
}

function PublicDeck({ player, localPlayer }: { player: PlayerSession; localPlayer?: PlayerSession }) {
  return <div className="public-character-deck"><div className="public-deck-heading"><div><span className="eyebrow">PUBLIC CHARACTER DECK · <b className={`player-name-highlight ${playerRelationClass(player, localPlayer)}`}>{player.displayName}</b></span><strong>{player.hero.name} · 10 cards</strong></div></div><div>{player.skillDeck.map((card) => <article key={card.id} className={`public-deck-card effect-${card.effect} ${card.unique ? "public-special-card" : ""}`} style={{ "--hero-color": player.hero.color } as React.CSSProperties}><PityCostBadge card={card}/>{card.unique && <span className="unique-card-banner"><Crown size={13}/> SPECIAL · {player.hero.name}</span>}<div className={`card-sigil effect-${card.effect}`}><CardEffectIcon card={card}/></div><div><span>{card.unique ? "Special" : "Common"}</span><strong>{card.name}</strong><p><EffectText text={card.description} card={card}/></p><CardOutcomeLines card={card}/></div></article>)}</div></div>;
}

function DetailedGuide({ onClose }: { onClose: () => void }) {
  return <div className="guide-update-backdrop" onClick={onClose}>
    <section className="guide-update-panel" onClick={(event) => event.stopPropagation()}>
      <button className="modal-close icon-button" onClick={onClose} aria-label="Close"><X size={18}/></button>
      <span className="eyebrow">QUICK GUIDE</span>
      <h2>How to play Shattered Oath</h2>
      <div className="guide-update-grid">
        <article><strong>1 · Choose your character</strong><p>Choose and review a character, or join without one to receive a random character when battle starts.</p></article>
        <article><strong>2 · Understand HP and Speed</strong><p>HP shows how much damage you can survive, while Speed determines when you act.</p></article>
        <article><strong>3 · Take your turn</strong><p>Select a card to Roll or Discard it, or choose Skip to pass without changing your cards.</p></article>
        <article><strong>4 · Dice, success, and failure</strong><p>Your modified d20 succeeds when it meets or beats the target; otherwise it fails with the card's listed result.</p></article>
        <article><strong>5 · Use pity</strong><p>Each failed normal roll earns 1 pity point that you can spend at a card's shown cost to guarantee success.</p></article>
        <article><strong>6 · World Event system</strong><p>World Events resolve before phases 3, 7, 12, 17, 22, and 27. Shattered Tribute is the fixed phase-3 choice; later events are randomly selected and increasingly severe.</p></article>
        <article><strong>7 · Win the battle</strong><p>Eliminate the opposing team, or have more total HP after phase 30, to win.</p></article>
      </div>
      <WorldEventLibrary className="guide-world-event-library"/>
    </section>
  </div>;
}

function ConfirmedTopAction({ className, icon, label, title, detail, onConfirm }: { className: string; icon: React.ReactNode; label: string; title: string; detail: string; onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const controlRef = useRef<HTMLDivElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const placeConfirmation = () => {
    const rect = controlRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 210;
    setPopoverPosition({
      top: rect.bottom + 9,
      left: Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8),
    });
  };
  useLayoutEffect(() => {
    if (!open) return;
    placeConfirmation();
    window.addEventListener("resize", placeConfirmation);
    return () => window.removeEventListener("resize", placeConfirmation);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!controlRef.current?.contains(target) && !confirmationRef.current?.contains(target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);
  return <div className="top-action-confirm-control" ref={controlRef}>
    <button className={`text-button ${className}`} onClick={() => { placeConfirmation(); setOpen(true); }}>{icon} {label}</button>
    {open && createPortal(<div className="turn-action-confirm top-action-confirm-popover" ref={confirmationRef} role="dialog" aria-label={title} style={popoverPosition}>
      <strong>{title}</strong>
      <span>{detail}</span>
      <div>
        <button onClick={() => { setOpen(false); onConfirm(); }}><Check size={13}/> Confirm</button>
        <button onClick={() => setOpen(false)}><X size={13}/> Cancel</button>
      </div>
    </div>, document.body)}
  </div>;
}

function HighlightPlayerNames({ text = "", players, localPlayer, onInspect }: { text?: string; players: PlayerSession[]; localPlayer?: PlayerSession; onInspect?: (id: string) => void }) {
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
    const className = `inline-player-name ${playerRelationClass(player, localPlayer)}`;
    const label = player.id === localPlayer?.id ? possessive ? "YOUR" : "YOU" : part;
    return onInspect
      ? <button type="button" className={`${className} history-player-link`} title={player.hero.name} aria-label={`View ${label}, ${player.hero.name}`} onClick={() => onInspect(player.id)} key={`${part}-${index}`}>{label}</button>
      : <span className={className} key={`${part}-${index}`}>{label}</span>;
  })}</>;
}

function LocalTurnActionPanel({ outcome, players, localPlayer, onContinue }: { outcome: GameOutcome; players: PlayerSession[]; localPlayer?: PlayerSession; onContinue: () => void }) {
  const discarded = outcome.kind === "discard";
  return <div className={`resolution-content local-turn-action-content ${discarded ? "discard" : "skip"}`}><div className="resolution-hero world">{discarded ? <Archive size={34}/> : <Hourglass size={34}/>}</div><span className="eyebrow">YOUR ACTION</span><h2><HighlightPlayerNames text={outcome.label} players={players} localPlayer={localPlayer}/></h2>{outcome.detail && <p className="modal-lead"><HighlightPlayerNames text={outcome.detail} players={players} localPlayer={localPlayer}/></p>}<button className="primary-button continue-button" onClick={onContinue}>Continue <ChevronRight size={17}/></button></div>;
}

function HistoryMessage({ entry, players, localPlayer, onInspectPlayer, onInspectCard }: { entry: GameHistoryEntry; players: PlayerSession[]; localPlayer?: PlayerSession; onInspectPlayer: (id: string) => void; onInspectCard: (name: string) => void }) {
  if (!entry.cardName) return <HighlightPlayerNames text={entry.message} players={players} localPlayer={localPlayer} onInspect={onInspectPlayer}/>;
  const escapedCardName = entry.cardName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = entry.message.split(new RegExp(`(${escapedCardName})`, "gi"));
  return <>{parts.map((part, index) => part.toLocaleLowerCase() === entry.cardName!.toLocaleLowerCase()
    ? <button type="button" className="history-card-link" title={`View ${entry.cardName}`} onClick={() => onInspectCard(entry.cardName!)} key={`${part}-${index}`}>{part}</button>
    : <HighlightPlayerNames text={part} players={players} localPlayer={localPlayer} onInspect={onInspectPlayer} key={`${part}-${index}`}/>)}</>;
}

function HistoryEntries({ entries, players, localPlayer, expanded = false, onInspectPlayer, onInspectCard }: { entries: GameHistoryEntry[]; players: PlayerSession[]; localPlayer?: PlayerSession; expanded?: boolean; onInspectPlayer: (id: string) => void; onInspectCard: (name: string) => void }) {
  const visibleEntries = expanded ? entries : entries.slice(-2);
  const renderEntry = (entry: GameHistoryEntry) => {
    const visibleDiceBonus = visibleDiceModifier(entry.diceBonus, entry.actorName, localPlayer?.displayName);
    const visibleDicePenalty = visibleDiceModifier(entry.dicePenalty, entry.actorName, localPlayer?.displayName);
    return <article className={`history-entry ${entry.kind} ${entry.success ? "success" : "failure"}`} key={entry.id}><span className={entry.kind === "world" ? "history-event-label" : ""}>{entry.kind === "world" && <Zap size={12}/>} {entry.kind === "world" ? expanded ? "WORLD EVENT" : `WORLD EVENT · PHASE ${entry.phase ?? entry.turn}` : `Turn ${entry.turn}`}</span><p><HistoryMessage entry={entry} players={players} localPlayer={localPlayer} onInspectPlayer={onInspectPlayer} onInspectCard={onInspectCard}/></p>{entry.diceRoll != null && (entry.resolution === "roll" && entry.pityCost === 0 ? <div className="history-dice automatic"><span>d20: {entry.diceRoll} · ignored</span><strong>Automatic success · zero-pity card</strong></div> : <div className="history-dice"><span>d20: {entry.diceRoll}</span><span>Active/passive bonus: +{visibleDiceBonus}</span>{Boolean(entry.dicePenalty) && <span>Penalty: -{visibleDicePenalty}</span>}<strong>Total {entry.diceTotal} / target {entry.diceTarget}</strong></div>)}{entry.resolution === "pity" && <div className="history-pity"><PityIcon size={13}/><span>Guaranteed success · spent {entry.pityCost ?? 0}</span><strong>{entry.pityBefore ?? 0} → {entry.pityAfter ?? 0} pity</strong></div>}</article>;
  };
  if (!expanded) return <div className="history-list">{!visibleEntries.length && <p className="empty-history">No actions yet.</p>}{[...visibleEntries].reverse().map(renderEntry)}</div>;
  const phaseGroups = [...visibleEntries].reverse().reduce<Array<{ phase: number | string; entries: GameHistoryEntry[] }>>((groups, entry) => {
    const phase = entry.phase ?? "—";
    const current = groups.at(-1);
    if (current?.phase === phase) current.entries.push(entry);
    else groups.push({ phase, entries: [entry] });
    return groups;
  }, []);
  return <div className="history-list expanded-history-list">{!phaseGroups.length && <p className="empty-history">No actions yet.</p>}{phaseGroups.map((group, index) => <section className="history-phase-group" key={`phase-${group.phase}-${index}`}><h3>Phase {group.phase}</h3><div>{group.entries.map(renderEntry)}</div></section>)}</div>;
}

function TurnOrderList({ players, game, order, localPlayer, expanded = false, onInspect }: { players: PlayerSession[]; game: SyncedGameState | null; order: PlayerSession[]; localPlayer?: PlayerSession; expanded?: boolean; onInspect: (id: string) => void }) {
  const activeId = order[0]?.id;
  const acted = new Set(game?.actedThisRound ?? []);
  const branchPlayers = expanded ? (game?.roundOrder ?? order.map((player) => player.id)).map((id) => players.find((player) => player.id === id)).filter((player): player is PlayerSession => Boolean(player)) : order.slice(0, 2);
  return <div className={`turn-queue-list ${expanded ? "expanded-turn-list turn-branch" : ""}`}>{branchPlayers.map((player) => { const status = player.id === activeId ? "current" : acted.has(player.id) ? "passed" : "future"; return <article className={`turn-queue-item ${status}`} aria-label={`${status}: ${player.displayName}`} key={player.id}><button className="portrait-button" onClick={() => onInspect(player.id)} aria-label={`View ${player.displayName}'s character`}><div className="portrait mini" style={{ "--hero-color": player.hero.color } as React.CSSProperties}>{player.hero.initials}</div></button><div className="turn-player-copy"><strong className={`player-name-highlight ${playerRelationClass(player, localPlayer)}`}>{player.displayName}</strong><span className="turn-player-meta">{player.hero.name} · Speed {player.hero.speed} · {teamName[player.hero.team]} · {game?.playerStates[player.id]?.hp ?? player.hero.hp} HP</span></div>{expanded && <i className="turn-branch-node" aria-hidden="true"/>}</article>; })}</div>;
}

function RunStatus({ completedPhases, secondsLeft, worldEvents, pendingPhase }: { completedPhases: number; secondsLeft: number; worldEvents: SyncedGameState["worldEventHistory"]; pendingPhase?: number }) {
  const currentPhase = Math.min(30, completedPhases + 1);
  return <nav className="run-status" aria-label="Battle status"><div><span className="eyebrow">PHASE</span><strong>{currentPhase} <i>/ 30</i></strong></div><div className="chapter-pips" aria-label="Thirty-phase timeline">{Array.from({ length: 30 }).map((_, index) => {
    const phase = index + 1;
    const phaseClass = index < completedPhases ? "complete" : index === completedPhases ? "current" : "future";
    const eventPhase = isWorldEventPhase(phase);
    const schedule = eventPhase ? getWorldEventScheduleEntry(phase) : null;
    const possibleEvents = eventPhase ? getWorldEventsForPhase(phase) : [];
    const resolvedEvent = eventPhase ? worldEvents.find((entry) => entry.phase === phase) : undefined;
    const waiting = pendingPhase === phase;
    const possibleEventDetails = possibleEvents.map((event) => `${event.title}: ${schedule?.selection === "fixed" ? event.fullDescription : event.shortDescription}`).join(" ");
    const eventDetail = resolvedEvent
      ? `${resolvedEvent.title}: ${resolvedEvent.fullDescription || resolvedEvent.description}`
      : `${schedule?.intensity} Level ${schedule?.level}. ${possibleEventDetails} Resolves before phase ${phase}.`;
    return <i key={phase} data-turn={phase} title={eventPhase ? undefined : `Phase ${phase}`} tabIndex={eventPhase ? 0 : undefined} aria-label={eventPhase ? `Phase ${phase}, World Event${waiting ? ", waiting for choices" : ""}. ${eventDetail}` : `Phase ${phase}`} className={`${phaseClass} ${eventPhase ? "world-event-turn" : ""} ${resolvedEvent ? "event-triggered" : ""} ${waiting ? "event-pending" : ""}`}>{eventPhase && <span className="phase-event-tooltip" role="tooltip"><b><Zap size={13}/> Phase {phase} World Event{waiting ? " · Waiting for choices" : ""}</b><small>{eventDetail}</small></span>}</i>;
  })}</div><div className={`turn-clock ${pendingPhase ? "event-paused" : secondsLeft <= 10 ? "urgent" : ""}`}><Clock3 size={14}/> {pendingPhase ? "Event choice" : `${secondsLeft} seconds`}</div></nav>;
}

function TargetPlayerPicker({ options, selectedId, game, localPlayer, onChange }: { options: PlayerSession[]; selectedId: string; game: SyncedGameState | null; localPlayer?: PlayerSession; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((player) => player.id === selectedId) ?? options[0];
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!pickerRef.current?.contains(event.target as Node)) setOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);
  const playerMeta = (player: PlayerSession) => {
    const state = game?.playerStates[player.id];
    return `${player.hero.name} · ${state?.hp ?? player.hero.hp} HP · ${state?.shield ?? 0} shield${(state?.skipTurns ?? 0) > 0 ? " · NEXT TURN CANCELLED" : ""}${(state?.reviveIn ?? 0) > 0 ? " · REVIVING" : ""}`;
  };
  return <div className={`target-player-dropdown ${open ? "open" : ""}`} ref={pickerRef}>
    <button type="button" className="target-dropdown-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      {selected ? <span className="target-option-copy"><strong className={`player-name-highlight ${playerRelationClass(selected, localPlayer)}`}>{selected.displayName}</strong><small>{playerMeta(selected)}</small></span> : <span>No target available</span>}
      <ChevronDown size={17}/>
    </button>
    {open && <div className="target-dropdown-options" role="listbox" aria-label="Choose target player">{options.map((player) => {
      const isSelected = player.id === selected?.id;
      return <button type="button" role="option" aria-selected={isSelected} className={`target-dropdown-option ${isSelected ? "selected" : ""}`} onClick={() => { onChange(player.id); setOpen(false); }} key={player.id}><span className="target-option-copy"><strong className={`player-name-highlight ${playerRelationClass(player, localPlayer)}`}>{player.displayName}</strong><small>{playerMeta(player)}</small></span>{isSelected && <Check size={16}/>}</button>;
    })}</div>}
  </div>;
}

type CardSlotRect = { top: number; left: number; width: number; height: number };
type CardZoneMotion = {
  id: number;
  slotIndex: number;
  mode: "replace" | "compact" | "refill";
  previousHand: string[];
  slotRect?: CardSlotRect;
  drawn?: ActionCard;
  discarded?: ActionCard;
};

function CardZoneVfx({ motion, player, playable }: { motion: CardZoneMotion; player: PlayerSession; playable: boolean }) {
  const [slotStyle, setSlotStyle] = useState<React.CSSProperties | null>(motion.slotRect ?? null);
  useLayoutEffect(() => {
    const slots = [...document.querySelectorAll<HTMLElement>(".action-hand [data-hand-slot]")];
    const slot = document.querySelector<HTMLElement>(`.action-hand [data-hand-slot="${motion.slotIndex}"]`) ?? slots.at(-1);
    if (motion.mode === "replace" && slot) slot.classList.add("zone-vfx-slot-hidden");
    if (motion.slotRect) setSlotStyle(motion.slotRect);
    if (!slot) return;
    const placeOverSlot = () => {
      const rect = slot.getBoundingClientRect();
      setSlotStyle({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    };
    if (!motion.slotRect) placeOverSlot();
    window.addEventListener("resize", placeOverSlot);
    return () => {
      if (motion.mode === "replace") slot.classList.remove("zone-vfx-slot-hidden");
      window.removeEventListener("resize", placeOverSlot);
    };
  }, [motion.id, motion.mode, motion.slotIndex, motion.slotRect]);
  if (!slotStyle) return null;
  const cardStyle = { ...slotStyle, "--hero-color": player.hero.color, "--settled-card-opacity": playable ? 1 : 0.48 } as React.CSSProperties;
  return <div className={`card-zone-vfx ${motion.mode}-motion ${motion.discarded && motion.drawn ? "replacement-motion" : "single-zone-motion"} ${playable ? "playable-motion" : "inactive-motion"}`} aria-hidden="true">{motion.discarded && <article className={`action-card selected card-motion hand-from-zone effect-${motion.discarded.effect} ${motion.discarded.unique ? "hero-special-card" : "common-action-card"} ${motion.discarded.effect === "none" ? "no-effect-card" : ""}`} style={cardStyle}><HandCardContents card={motion.discarded} player={player}/></article>}{motion.drawn && <article className={`action-card card-motion hand-to-zone effect-${motion.drawn.effect} ${motion.drawn.unique ? "hero-special-card" : "common-action-card"} ${motion.drawn.effect === "none" ? "no-effect-card" : ""}`} style={cardStyle}><HandCardContents card={motion.drawn} player={player}/></article>}</div>;
}

export default function GameApp() {
  const { room, status, error: roomError, sessionId, serverTimeOffsetMs, send, clearError } = useRoomSocket();
  const { musicOn, volume, setVolume, toggleMusic, playEffect, playBattleResult, stopBattleResult } = useGameAudio();
  const characterOptions = useMemo(() => getCharacterOptions(), []);
  const [playerName, setPlayerName] = useState("");
  const [selectedHeroName, setSelectedHeroName] = useState("");
  const [lobbyError, setLobbyError] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [lobbyAdventure] = useState(() => createAdventure("ARENA"));
  const [selectedCard, setSelectedCard] = useState("");
  const [targetPlayerId, setTargetPlayerId] = useState("");
  const [animatedRoll, setAnimatedRoll] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [dismissedOutcomeKey, setDismissedOutcomeKey] = useState("");
  const [dismissedSummaryKey, setDismissedSummaryKey] = useState("");
  const [dismissedVfxKey, setDismissedVfxKey] = useState("");
  const [presentationQueue, setPresentationQueue] = useState<PresentationQueueItem[]>([]);
  const [deckReview, setDeckReview] = useState<"draw" | "discard" | "graveyard" | null>(null);
  const [expandedPanel, setExpandedPanel] = useState<"history" | "turns" | null>(null);
  const [inspectedPlayerId, setInspectedPlayerId] = useState<string | null>(null);
  const [inspectedCardName, setInspectedCardName] = useState<string | null>(null);
  const [inspectedView, setInspectedView] = useState<"status" | "deck">("status");
  const [mobileParty, setMobileParty] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [cardZoneMotion, setCardZoneMotion] = useState<CardZoneMotion | null>(null);
  const [visibleNotices, setVisibleNotices] = useState<GameNotice[]>([]);
  const expirySentRef = useRef(0);
  const previousLocalZonesRef = useRef<{ playerId: string; hand: string[]; drawPile: string[]; discardPile: string[] } | null>(null);
  const pendingCardMotionRef = useRef<{ completedTurns: number; slotIndex: number; slotRect?: CardSlotRect; discarded: ActionCard } | null>(null);
  const outcomeSoundReadyRef = useRef(false);
  const lastOutcomeSoundKeyRef = useRef("");
  const lastBattleResultKeyRef = useRef("");
  const seenNoticeIdsRef = useRef(new Set<string>());
  const seenPresentationIdsRef = useRef(new Set<string>());
  const noticeTimersRef = useRef(new Map<string, number>());

  const { players, phase, game } = room;
  const adventure = game?.adventure ?? lobbyAdventure;
  const queuedActiveId = game?.turnOrder?.[0];
  const activePlayerIndex = queuedActiveId ? Math.max(0, players.findIndex((player) => player.id === queuedActiveId)) : game?.activePlayerIndex ?? 0;
  const activePlayer = players[activePlayerIndex];
  const activeState = activePlayer ? game?.playerStates[activePlayer.id] : undefined;
  const localPlayer = players.find((player) => player.id === sessionId);
  const localState = localPlayer ? game?.playerStates[localPlayer.id] : undefined;
  const cardCatalog = useMemo(() => players.flatMap((player) => player.skillDeck), [players]);
  const previewCardCatalog = useMemo(() => characterOptions.flatMap((option) => option.skillDeck), [characterOptions]);
  const localHand = localState?.hand.map((id) => cardCatalog.find((card) => card.id === id)).filter((card): card is ActionCard => Boolean(card)) ?? [];
  const runComplete = phase === "game" && Boolean(game?.ended);
  const pendingWorldEvent = game?.pendingWorldEvent ?? null;
  const worldEventBlocking = Boolean(pendingWorldEvent);
  const isLocalActiveTurn = phase === "game" && !runComplete && !worldEventBlocking && activePlayer?.id === sessionId && (localState?.hp ?? 0) > 0;
  const activeCard = useMemo(() => isLocalActiveTurn ? localHand.find((card) => card.id === selectedCard) : undefined, [isLocalActiveTurn, localHand, selectedCard]);
  const favorableOmenActive = hasFavorableOmen(localState);
  const activePityCost = activeCard ? getEffectiveCardPityCost(activeCard, localState) : 0;
  const battleResultKey = runComplete ? `${game?.turnStartedAt ?? 0}-${game?.winnerTeam ?? "none"}-${game?.endReason ?? "ended"}` : "";
  const localBattleVerdict = game?.winnerTeam && localPlayer ? (game.winnerTeam === localPlayer.hero.team ? "victory" : "defeat") : "complete";
  const secondsLeft = game?.turnDeadline ? Math.max(0, Math.ceil((game.turnDeadline - (now + serverTimeOffsetMs)) / 1000)) : 0;
  const passiveDiceBonus = localPlayer && activeCard && localState ? getPassiveDiceBonus(localPlayer, activeCard, localState) : 0;
  const outcome = game?.outcome ?? null;
  const outcomeKey = outcome ? `${game?.turnStartedAt ?? 0}-${outcome.label}` : "";
  const queuedPresentation = presentationQueue[0];
  const queuedWorldEvent = queuedPresentation?.kind === "world" ? queuedPresentation.event : undefined;
  const activeLifeEvent = queuedPresentation?.kind === "life" ? queuedPresentation.lifeEvent : undefined;
  const showRunComplete = queuedPresentation?.kind === "battle";
  const showNonWorldLifeEvent = Boolean(activeLifeEvent && activeLifeEvent.source !== "world-event");
  const showWorldLifeEvent = Boolean(activeLifeEvent?.source === "world-event");
  const showLifeEvent = showNonWorldLifeEvent || showWorldLifeEvent;
  const isLocalActionOutcome = Boolean(outcome && outcome.actorName === localPlayer?.displayName && (outcome.kind === "card" || outcome.kind === "discard" || outcome.kind === "skip"));
  const showOutcome = Boolean(isLocalActionOutcome && outcomeKey !== dismissedOutcomeKey);
  const showTurnSummary = Boolean(outcome?.actorName && !isLocalActionOutcome && outcomeKey !== dismissedSummaryKey);
  const vfxCard = outcome?.kind === "card"
    ? [...cardCatalog, ...previewCardCatalog].find((card) => card.id === outcome.cardId && card.name === outcome.cardName)
      ?? previewCardCatalog.find((card) => card.name === outcome.cardName)
      ?? cardCatalog.find((card) => card.id === outcome.cardId || card.name === outcome.cardName)
    : undefined;
  const showBattleVfx = Boolean(vfxCard && outcomeKey !== dismissedVfxKey && !runComplete);
  const showWorldEvent = Boolean(queuedWorldEvent && queuedWorldEvent.phase !== 3 && !worldEventBlocking);
  const inspectedPlayer = players.find((player) => player.id === inspectedPlayerId);
  const inspectedCard = [...cardCatalog, ...previewCardCatalog].find((card) => card.name === inspectedCardName);
  const reviewedCardIds = deckReview === "draw" ? localState?.drawPile ?? [] : deckReview === "discard" ? localState?.discardPile ?? [] : deckReview === "graveyard" ? localState?.graveyard ?? [] : [];
  const reviewedCards = reviewedCardIds.map((id) => cardCatalog.find((card) => card.id === id)).filter((card): card is ActionCard => Boolean(card));
  const manualPanelOpen = Boolean(deckReview) || Boolean(expandedPanel) || Boolean(inspectedPlayer) || Boolean(inspectedCard);
  const showPendingWorldEventChoice = Boolean(pendingWorldEvent && !manualPanelOpen && !showOutcome && !showTurnSummary && !showNonWorldLifeEvent);
  const activeAutoPanel = manualPanelOpen ? null : showOutcome ? "outcome" : showTurnSummary ? "summary" : showNonWorldLifeEvent ? "life" : worldEventBlocking ? null : showWorldEvent ? "world" : showWorldLifeEvent ? "life" : showRunComplete ? "battle" : null;
  const modalOpen = manualPanelOpen || Boolean(activeAutoPanel);
  const panelOverlayOpen = modalOpen || worldEventBlocking || showGuide || mobileParty;
  const visibleTurnOrder = useMemo(() => {
    if (!game) return [];
    const living = players.filter((player) => (game.playerStates[player.id]?.hp ?? 0) > 0);
    const ids = game.turnOrder?.length
      ? game.turnOrder
      : [...players.slice(activePlayerIndex), ...players.slice(0, activePlayerIndex)].map((player) => player.id);
    return [...new Set([...ids, ...living.map((player) => player.id)])]
      .map((id) => players.find((player) => player.id === id))
      .filter((player): player is NonNullable<typeof player> => Boolean(player && (game.playerStates[player.id]?.hp ?? 0) > 0));
  }, [game, players, activePlayerIndex]);

  const targetOptions = activeCard && localPlayer ? players.filter((player) => {
    const hp = game?.playerStates[player.id]?.hp ?? player.hero.hp;
    if (activeCard.target === "defeated-ally") return player.hero.team === localPlayer.hero.team && hp <= 0 && !(game?.playerStates[player.id]?.reviveIn ?? 0);
    if (hp <= 0) return false;
    if (activeCard.target === "player") return true;
    if (activeCard.target === "enemy") return player.hero.team !== localPlayer.hero.team;
    if (activeCard.target === "ally") return player.hero.team === localPlayer.hero.team && (activeCard.supportType !== "advance-ally" || player.id !== localPlayer.id);
    return false;
  }) : [];
  const targetOptionKey = targetOptions.map((player) => player.id).join("|");

  const teamTotals = (team: TeamId) => {
    const members = players.filter((player) => player.hero.team === team);
    return {
      hp: members.reduce((sum, player) => sum + (game?.playerStates[player.id]?.hp ?? player.hero.hp), 0),
      maxHp: members.reduce((sum, player) => sum + (game?.playerStates[player.id]?.maxHp ?? player.hero.maxHp), 0),
      shield: members.reduce((sum, player) => sum + (game?.playerStates[player.id]?.shield ?? 0), 0),
      alive: members.filter((player) => (game?.playerStates[player.id]?.hp ?? player.hero.hp) > 0).length,
      total: members.length
    };
  };
  const veil = teamTotals("veil");
  const ember = teamTotals("ember");

  useEffect(() => {
    setSelectedCard("");
    setTargetPlayerId("");
  }, [localPlayer?.id, game?.turnStartedAt]);
  useEffect(() => {
    const savedName = window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY);
    if (savedName) setPlayerName(savedName);
  }, []);
  useEffect(() => {
    if (!activeCard || !localPlayer) {
      setTargetPlayerId("");
      return;
    }
    if (activeCard.target === "self" || activeCard.target === "all-allies" || activeCard.target === "all-enemies") setTargetPlayerId(localPlayer.id);
    else setTargetPlayerId(targetOptions[0]?.id ?? "");
  }, [activeCard?.id, localPlayer?.id, game?.completedTurns, targetOptionKey]);
  useEffect(() => { if (phase !== "game" || game?.ended) return; const timer = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(timer); }, [phase, game?.ended]);
  useEffect(() => {
    if (phase !== "game" || game?.ended || worldEventBlocking || !game?.turnDeadline || secondsLeft > 0 || expirySentRef.current === game.turnDeadline) return;
    expirySentRef.current = game.turnDeadline;
    send({ type: "expire-turn" });
  }, [phase, game?.ended, game?.turnDeadline, secondsLeft, send, worldEventBlocking]);
  useEffect(() => {
    if (!players.length || !localPlayer) return setSelectedPlayerId(null);
    if (!players.some((player) => player.id === selectedPlayerId)) setSelectedPlayerId(localPlayer.id);
  }, [players, selectedPlayerId, localPlayer]);
  useEffect(() => {
    if (phase !== "lobby" || !localPlayer) return;
    setSelectedHeroName(localPlayer.randomHero ? "" : localPlayer.hero.name);
  }, [phase, localPlayer?.id, localPlayer?.hero.name, localPlayer?.randomHero]);
  useEffect(() => {
    if (phase !== "game" || !game) return;
    const freshPresentations: PresentationQueueItem[] = [];
    const enqueueOnce = (item: PresentationQueueItem) => {
      if (seenPresentationIdsRef.current.has(item.id)) return;
      seenPresentationIdsRef.current.add(item.id);
      freshPresentations.push(item);
    };
    const lifeEvents = outcome?.lifeEvents ?? [];
    for (const lifeEvent of lifeEvents.filter((event) => event.source !== "world-event")) {
      enqueueOnce({ id: `life:${lifeEvent.id}`, kind: "life", lifeEvent });
    }
    if (game.worldEvent && game.worldEvent.phase !== 3) enqueueOnce({ id: `world:${game.worldEvent.id}`, kind: "world", event: game.worldEvent });
    for (const lifeEvent of lifeEvents.filter((event) => event.source === "world-event")) {
      enqueueOnce({ id: `life:${lifeEvent.id}`, kind: "life", lifeEvent });
    }
    if (runComplete && battleResultKey) enqueueOnce({ id: `battle:${battleResultKey}`, kind: "battle", battleKey: battleResultKey });
    if (freshPresentations.length) setPresentationQueue((current) => [...current, ...freshPresentations]);
  }, [phase, game, game?.worldEvent, outcome?.lifeEvents, runComplete, battleResultKey]);
  useEffect(() => {
    if (phase !== "lobby") return;
    setPresentationQueue([]);
    seenPresentationIdsRef.current.clear();
  }, [phase]);
  useEffect(() => {
    if (!activeAutoPanel) return;
    const timer = window.setTimeout(() => {
      if (activeAutoPanel === "outcome") setDismissedOutcomeKey(outcomeKey);
      else if (activeAutoPanel === "summary") setDismissedSummaryKey(outcomeKey);
      else if ((activeAutoPanel === "life" || activeAutoPanel === "world") && queuedPresentation) {
        setPresentationQueue((current) => current.filter((item) => item.id !== queuedPresentation.id));
      }
    }, 10000);
    return () => window.clearTimeout(timer);
  }, [activeAutoPanel, queuedPresentation?.id, outcomeKey]);
  useEffect(() => {
    const freshNotices = (outcome?.notices ?? []).filter((notice) => !seenNoticeIdsRef.current.has(notice.id));
    if (!freshNotices.length) return;
    freshNotices.forEach((notice) => seenNoticeIdsRef.current.add(notice.id));
    setVisibleNotices((current) => [...current, ...freshNotices]);
    freshNotices.forEach((notice) => {
      const timer = window.setTimeout(() => {
        setVisibleNotices((current) => current.filter((item) => item.id !== notice.id));
        noticeTimersRef.current.delete(notice.id);
      }, 5000);
      noticeTimersRef.current.set(notice.id, timer);
    });
  }, [outcome?.notices]);
  useEffect(() => () => {
    noticeTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    noticeTimersRef.current.clear();
  }, []);
  useEffect(() => {
    if (!showBattleVfx || !outcomeKey) return;
    const timer = window.setTimeout(() => setDismissedVfxKey(outcomeKey), 1400);
    return () => window.clearTimeout(timer);
  }, [showBattleVfx, outcomeKey]);
  useEffect(() => {
    if (!localPlayer || !localState) {
      previousLocalZonesRef.current = null;
      return;
    }
    const previous = previousLocalZonesRef.current;
    if (previous?.playerId === localPlayer.id) {
      const pending = pendingCardMotionRef.current && (game?.completedTurns ?? 0) > pendingCardMotionRef.current.completedTurns ? pendingCardMotionRef.current : null;
      const outgoingId = previous.hand.find((id) => !localState.hand.includes(id));
      const incomingId = localState.hand.find((id) => !previous.hand.includes(id));
      const slotIndex = pending?.slotIndex ?? (outgoingId ? Math.max(0, previous.hand.indexOf(outgoingId)) : Math.max(0, localState.hand.indexOf(incomingId ?? "")));
      const discarded = pending?.discarded ?? (outgoingId ? cardCatalog.find((card) => card.id === outgoingId) : undefined);
      const recycledPlayedCard = Boolean(pending && previous.hand.length === 1 && previous.drawPile.length === 0 && localState.discardPile.length === 0 && localState.hand.includes(pending.discarded.id));
      const refill = previous.hand.length > 0 && previous.drawPile.length === 0 && localState.discardPile.length === 0 && (localState.hand.length > previous.hand.length || recycledPlayedCard);
      const compact = !refill && previous.drawPile.length === 0 && localState.hand.length < previous.hand.length;
      const mode: CardZoneMotion["mode"] = refill ? "refill" : compact ? "compact" : "replace";
      const replacementId = mode === "replace" ? incomingId : undefined;
      const drawn = replacementId ? cardCatalog.find((card) => card.id === replacementId) : undefined;
      if (discarded || drawn || refill || compact) setCardZoneMotion({ id: Date.now(), slotIndex, slotRect: pending?.slotRect, mode, previousHand: [...previous.hand], discarded, drawn });
      if (pending) pendingCardMotionRef.current = null;
    }
    previousLocalZonesRef.current = { playerId: localPlayer.id, hand: [...localState.hand], drawPile: [...localState.drawPile], discardPile: [...localState.discardPile] };
  }, [localPlayer, localState, cardCatalog, game?.completedTurns]);
  useEffect(() => {
    if (!cardZoneMotion || panelOverlayOpen) return;
    const timer = window.setTimeout(() => setCardZoneMotion(null), 2450);
    return () => window.clearTimeout(timer);
  }, [cardZoneMotion, panelOverlayOpen]);
  useEffect(() => {
    if (phase === "game" && !runComplete) return;
    pendingCardMotionRef.current = null;
    setCardZoneMotion(null);
  }, [phase, runComplete]);
  useEffect(() => {
    if (!outcomeSoundReadyRef.current) {
      outcomeSoundReadyRef.current = true;
      lastOutcomeSoundKeyRef.current = outcomeKey;
      return;
    }
    if (!outcomeKey || lastOutcomeSoundKeyRef.current === outcomeKey) return;
    lastOutcomeSoundKeyRef.current = outcomeKey;
    if (outcome?.kind === "card") playEffect(outcome.success ? "roll-success" : "roll-fail");
  }, [outcomeKey, outcome?.kind, outcome?.success, playEffect]);
  useEffect(() => {
    if (!runComplete || !localPlayer) {
      if (lastBattleResultKeyRef.current) stopBattleResult();
      lastBattleResultKeyRef.current = "";
      return;
    }
    const resultKey = `${game?.turnStartedAt ?? 0}-${game?.winnerTeam ?? "none"}-${game?.endReason ?? "ended"}`;
    if (lastBattleResultKeyRef.current === resultKey) return;
    lastBattleResultKeyRef.current = resultKey;
    playBattleResult(game?.winnerTeam === localPlayer.hero.team ? "win" : "lose");
  }, [runComplete, localPlayer, game?.turnStartedAt, game?.winnerTeam, game?.endReason, playBattleResult, stopBattleResult]);

  const joinPlayer = (team: TeamId) => {
    const name = playerName.trim();
    if (status !== "connected" || !sessionId) return setLobbyError("The shared room is still connecting. Please try again shortly.");
    if (localPlayer) return setLobbyError("This browser already controls one player.");
    if (players.length >= 10) return setLobbyError("The room already has 10 players.");
    if (!name) return setLobbyError("Enter a name before choosing a team slot.");
    if (players.some((player) => player.displayName.toLowerCase() === name.toLowerCase())) return setLobbyError("That name is already in use. Choose another name.");
    if (players.filter((player) => player.hero.team === team).length >= 5) return setLobbyError(`${team === "veil" ? "Veilbound" : "Embercourt"} already has five players.`);
    const pendingRandomHero = !selectedHeroName;
    const placeholderHeroName = pendingRandomHero ? characterOptions[0]?.hero.name : selectedHeroName;
    if (!placeholderHeroName) return setLobbyError("No character is available. Please try again.");
    const session = { ...createPlayerSession(name, team === "veil" ? 0 : 1, placeholderHeroName, sessionId), randomHero: pendingRandomHero };
    if (send({ type: "join", player: session })) {
      window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, name);
      setSelectedPlayerId(session.id);
      setLobbyError("");
    }
  };
  const toggleReady = (id: string) => send({ type: "ready", sessionId: id, ready: !players.find((player) => player.id === id)?.ready });
  const selectLobbyHero = (heroName: string) => {
    if (!localPlayer) {
      setSelectedHeroName(heroName);
      setLobbyError("");
      return;
    }
    if (localPlayer.ready) return setLobbyError("Cancel Ready before changing characters.");
    const randomHero = !heroName;
    const resolvedHeroName = randomHero ? characterOptions[0]?.hero.name : heroName;
    if (!resolvedHeroName) return setLobbyError("No character is available. Please try again.");
    const selection = { ...createPlayerSession(localPlayer.displayName, localPlayer.hero.team === "veil" ? 0 : 1, resolvedHeroName, localPlayer.id), randomHero };
    if (send({ type: "character", sessionId, player: selection })) {
      setSelectedHeroName(heroName);
      setSelectedPlayerId(localPlayer.id);
      setLobbyError("");
    }
  };
  const selectLobbySlot = (team: TeamId) => {
    if (!localPlayer) return joinPlayer(team);
    if (localPlayer.ready) return setLobbyError("Cancel Ready before switching teams.");
    if (localPlayer.hero.team === team) return;
    if (players.filter((player) => player.hero.team === team).length >= 5) return setLobbyError(`${team === "veil" ? "Veilbound" : "Embercourt"} already has five players.`);
    if (send({ type: "team", sessionId, team })) setLobbyError("");
  };
  const leaveLobby = (id: string) => { send({ type: "leave", sessionId: id }); setSelectedPlayerId(null); setSelectedHeroName(""); setLobbyError(""); };
  const enterGame = () => {
    if (players.length < 2 || !players.every((player) => player.ready)) return setLobbyError("Every joined player must be ready before the battle starts.");
    if (!players.some((player) => player.hero.team === "veil") || !players.some((player) => player.hero.team === "ember")) return setLobbyError("At least one player must join each team before the battle starts.");
    const battlePlayers = players.map((player) => {
      if (!player.randomHero) return player;
      const randomOption = characterOptions[Math.floor(Math.random() * characterOptions.length)];
      const assigned = createPlayerSession(player.displayName, player.hero.team === "veil" ? 0 : 1, randomOption.hero.name, player.id);
      return { ...assigned, ready: player.ready, joinedAt: player.joinedAt, randomHero: false, hero: { ...assigned.hero, team: player.hero.team } };
    });
    send({ type: "start", players: battlePlayers, game: createInitialGame(battlePlayers, createAdventure(), 30) });
  };
  const captureCardSlot = (slotIndex: number): CardSlotRect | undefined => {
    const slot = document.querySelector<HTMLElement>(`.action-hand [data-hand-slot="${slotIndex}"]`);
    if (!slot) return undefined;
    const rect = slot.getBoundingClientRect();
    return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
  };
  const castDie = () => {
    if (rolling || !game || !activePlayer || activePlayer.id !== sessionId || !activeCard || runComplete || worldEventBlocking || status !== "connected" || (activeState?.hp ?? 0) <= 0) return;
    playEffect("roll");
    setRolling(true); let ticks = 0;
    const timer = window.setInterval(() => { setAnimatedRoll(randomD20Roll()); ticks += 1; if (ticks >= 9) { window.clearInterval(timer); const finalRoll = randomD20Roll(); const slotIndex = Math.max(0, localState?.hand.indexOf(activeCard.id) ?? 0); pendingCardMotionRef.current = { completedTurns: game.completedTurns, slotIndex, slotRect: captureCardSlot(slotIndex), discarded: activeCard }; if (send({ type: "game:update", game: resolveCardTurn(game, players, activeCard.id, targetPlayerId, finalRoll) })) playEffect("play"); else pendingCardMotionRef.current = null; setAnimatedRoll(finalRoll); setRolling(false); } }, 85);
  };
  const usePityRoll = () => {
    if (!game || !activePlayer || activePlayer.id !== sessionId || !activeCard || runComplete || worldEventBlocking || status !== "connected" || rolling || (activeState?.hp ?? 0) <= 0 || (localState?.pityPoints ?? 0) < activePityCost) return;
    const slotIndex = Math.max(0, localState?.hand.indexOf(activeCard.id) ?? 0);
    pendingCardMotionRef.current = { completedTurns: game.completedTurns, slotIndex, slotRect: captureCardSlot(slotIndex), discarded: activeCard };
    if (send({ type: "game:update", game: resolveCardTurn(game, players, activeCard.id, targetPlayerId, 0, true) })) playEffect("play");
    else pendingCardMotionRef.current = null;
  };
  const skipTurn = () => {
    if (!game || !activePlayer || activePlayer.id !== sessionId || runComplete || worldEventBlocking || status !== "connected" || (activeState?.hp ?? 0) <= 0) return;
    if (send({ type: "skip-turn", sessionId })) playEffect("skip");
  };
  const discardCard = () => {
    if (!game || !activePlayer || activePlayer.id !== sessionId || !activeCard || runComplete || worldEventBlocking || status !== "connected" || rolling || (activeState?.hp ?? 0) <= 0) return;
    const slotIndex = Math.max(0, localState?.hand.indexOf(activeCard.id) ?? 0);
    pendingCardMotionRef.current = { completedTurns: game.completedTurns, slotIndex, slotRect: captureCardSlot(slotIndex), discarded: activeCard };
    if (send({ type: "discard-card", sessionId, cardId: activeCard.id })) playEffect("discard");
    else pendingCardMotionRef.current = null;
  };
  const submitWorldEventChoice = (eventId: string, cardIds: string[]) => send({ type: "world-event:choose", eventId, cardIds });
  const removePlayer = (targetSessionId: string) => {
    const target = players.find((player) => player.id === targetSessionId);
    if (!localPlayer || !target || targetSessionId === sessionId || !window.confirm(`Remove ${target.displayName} from the battle?`)) return;
    send({ type: "remove-player", sessionId, targetSessionId });
  };
  const inspectPlayer = (playerId: string) => {
    setDeckReview(null);
    setExpandedPanel(null);
    setMobileParty(false);
    setInspectedCardName(null);
    setInspectedView("status");
    setInspectedPlayerId(playerId);
  };
  const inspectCard = (cardName: string) => {
    setDeckReview(null);
    setExpandedPanel(null);
    setMobileParty(false);
    setInspectedPlayerId(null);
    setInspectedCardName(cardName);
  };
  const dismissPresentation = (presentationId = queuedPresentation?.id) => {
    if (!presentationId) return;
    setPresentationQueue((current) => current.filter((item) => item.id !== presentationId));
  };
  const closeModal = () => {
    if (deckReview) return setDeckReview(null);
    if (expandedPanel) return setExpandedPanel(null);
    if (inspectedPlayer) { setInspectedView("status"); return setInspectedPlayerId(null); }
    if (inspectedCard) return setInspectedCardName(null);
    if (showOutcome) return setDismissedOutcomeKey(outcomeKey);
    if (showTurnSummary) return setDismissedSummaryKey(outcomeKey);
    if (showWorldEvent || showLifeEvent) return dismissPresentation();
    if (showRunComplete) send({ type: "return:lobby" });
  };

  return <main className="game-shell arena-focus"><div className="grain"/>{visibleNotices.length > 0 && <section className="game-notice-stack" aria-live="polite" aria-label="Battle notices">{visibleNotices.map((notice) => <article className={`outcome-toast game-notice ${notice.kind}`} key={notice.id}><GameNoticeIcon kind={notice.kind}/><div><strong>{notice.title}</strong><span><HighlightPlayerNames text={notice.detail} players={players} localPlayer={localPlayer}/></span></div></article>)}</section>}{showBattleVfx && vfxCard && <div className={`battle-card-vfx effect-${vfxCard.effect} ${outcome?.success ? "success" : "failure"}`} aria-hidden="true"><i/><i/><i/><div><CardEffectIcon card={vfxCard}/><strong>{vfxCard.name}</strong></div></div>}{cardZoneMotion && localPlayer && !panelOverlayOpen && <CardZoneVfx key={cardZoneMotion.id} motion={cardZoneMotion} player={localPlayer} playable={activePlayer?.id === sessionId && !runComplete && (localState?.hp ?? 0) > 0}/>} {showGuide && <DetailedGuide onClose={() => setShowGuide(false)}/>} {showPendingWorldEventChoice && pendingWorldEvent && <ShatteredTributeChoicePanel pendingEvent={pendingWorldEvent} players={players} localPlayer={localPlayer} localState={localState} handCards={localHand} serverTimeOffsetMs={serverTimeOffsetMs} connectionError={roomError} onSubmit={submitWorldEventChoice}/>}
    <header className="topbar"><div className="brand"><div className="brand-mark"><Crown size={20}/></div><div><strong>SHATTERED OATH</strong><span>Two teams. One victor.</span></div></div>
      {phase === "game" ? <RunStatus completedPhases={game?.completedPhases ?? Math.max(0, (game?.roundNumber ?? 1) - 1)} secondsLeft={secondsLeft} worldEvents={game?.worldEventHistory ?? []} pendingPhase={pendingWorldEvent?.phase}/> : <div className="lobby-top-status"><Users size={16}/> {players.length}/10 players · {players.filter((player) => player.ready).length} ready</div>}
      <div className="top-actions"><div className="audio-controls"><button className={`icon-button music-toggle ${musicOn ? "playing" : ""}`} onClick={() => void toggleMusic()} aria-label={musicOn ? "Pause medieval music" : "Play medieval music"} title={musicOn ? "Pause medieval music" : "Play medieval music"}>{musicOn ? <Volume2 size={18}/> : <AudioLines size={18}/>}</button><label className="volume-control" title={`Audio volume ${volume}%`}><input type="range" min="0" max="100" value={volume} style={{ "--audio-volume": `${volume}%` } as React.CSSProperties} onChange={(event) => setVolume(Number(event.target.value))} aria-label="Game audio volume"/><output>{volume}%</output></label></div><button className="text-button" onClick={() => setShowGuide(true)}><CircleHelp size={16}/> How to play</button>{phase === "game" && localPlayer && <ConfirmedTopAction className="leave-game-control" icon={<LogOut size={16}/>} label="Leave battle" title="Leave this battle?" detail="Your player will be removed from the current battle." onConfirm={() => send({ type: "leave-game", sessionId })}/>} {phase === "game" && localPlayer && !runComplete && <ConfirmedTopAction className="end-game-control" icon={<Octagon size={16}/>} label="End battle" title="End this battle?" detail="The current team totals will decide victory and defeat." onConfirm={() => send({ type: "end-game", sessionId })}/>} {runComplete && !presentationQueue.some((item) => item.kind === "battle") && <button className="text-button" onClick={() => { if (battleResultKey) setPresentationQueue((current) => [...current, { id: `battle:reopen:${battleResultKey}`, kind: "battle", battleKey: battleResultKey }]); }}><Crown size={16}/> Battle result</button>}{phase === "game" && <button className="icon-button mobile-party-button" onClick={() => setMobileParty(true)} aria-label="Open player list"><Users size={18}/></button>}</div>
    </header>
    {phase === "lobby" ? <Lobby players={players} playerName={playerName} error={lobbyError || roomError} selectedPlayerId={selectedPlayerId} localSessionId={sessionId} connectionStatus={status} characterOptions={characterOptions} selectedHeroName={selectedHeroName} onNameChange={(name) => { setPlayerName(name); window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, name); setLobbyError(""); clearError(); }} onSlotSelect={selectLobbySlot} onSelectPlayer={setSelectedPlayerId} onToggleReady={toggleReady} onLeave={leaveLobby} onRemovePlayer={removePlayer} onEnterGame={enterGame} onHeroSelect={selectLobbyHero}/> :
      <div className="game-layout">{mobileParty && <button className="mobile-rail-backdrop" onClick={() => setMobileParty(false)} aria-label="Close player list"/>}<div className={mobileParty ? "mobile-rail open" : "mobile-rail"}><button className="mobile-close icon-button" onClick={() => setMobileParty(false)}><X size={17}/></button><PartyRail players={players} game={game} localSessionId={localPlayer ? sessionId : ""} onRemovePlayer={removePlayer} onInspectPlayer={inspectPlayer}/></div><PartyRail players={players} game={game} localSessionId={localPlayer ? sessionId : ""} onRemovePlayer={removePlayer} onInspectPlayer={inspectPlayer}/>
        <section className="world-stage combat-stage"><div className="realm-meta"><div><span className="eyebrow">TEAM BATTLE ARENA · 30-PHASE MATCH</span><h1>Eliminate the opposing team</h1></div></div>
          <div className="encounter-row"><section className={`objective-card turn-status-banner ${isLocalActiveTurn ? "active" : "waiting"}`}><div className="objective-icon">{isLocalActiveTurn ? <Target size={22}/> : worldEventBlocking ? <Zap size={22}/> : <Hourglass className="waiting-hourglass" size={22}/>}</div><div><strong>{worldEventBlocking ? <>Resolving <span className="active-turn-word">{pendingWorldEvent?.title}</span>&hellip;</> : isLocalActiveTurn ? <>Here is <b className="active-turn-word">your</b> turn</> : activePlayer ? <>Waiting for <span className={`player-name-highlight ${playerRelationClass(activePlayer, localPlayer)}`}>{activePlayer.displayName}</span>&apos;s decision&hellip;</> : "Waiting for a player…"}</strong><p>{worldEventBlocking ? "Normal turns are paused until every required choice is submitted or the event deadline expires." : "Defeat every opponent to win immediately. After phase 30, the team with more total HP wins."}</p></div></section><DiceRoller roll={rolling ? animatedRoll : game?.roll ?? null} rolling={rolling} target={adventure.target} passiveBonus={visibleDiceModifier(passiveDiceBonus, activePlayer?.id, sessionId)} diceBuff={visibleDiceModifier(activeState?.diceBuff, activePlayer?.id, sessionId)} dicePenalty={visibleDiceModifier(activeState?.dicePenalty, activePlayer?.id, sessionId)} pityPoints={localState?.pityPoints ?? 0} pityCost={activePityCost} hasSelectedCard={Boolean(activeCard)} onRoll={castDie} onPity={usePityRoll} onSkip={skipTurn} onDiscard={discardCard} disabled={worldEventBlocking || activePlayer?.id !== sessionId || status !== "connected" || runComplete || (localState?.hp ?? 1) <= 0}/></div>
          <div className="battle-interaction-space">{activePlayer?.id === sessionId && activeCard && ["enemy", "ally", "defeated-ally", "player"].includes(activeCard.target) ? <section className="interaction-selector" aria-label="Choose interaction target"><div className="target-picker"><Target size={16}/><span>Choose {getCardTargetLabel(activeCard).toLowerCase()}</span>{targetOptions.length ? <TargetPlayerPicker options={targetOptions} selectedId={targetPlayerId} game={game} localPlayer={localPlayer} onChange={setTargetPlayerId}/> : <span className="no-valid-target">No valid target is available. A successful roll will have no effect.</span>}</div></section> : null}</div>
          <section className="hand-zone private-hand-zone"><div className="hand-heading"><div><span className="eyebrow">{localPlayer ? "YOUR PRIVATE HAND" : "PRIVATE HAND"}</span><strong>{activePlayer?.id === sessionId ? "Choose a card, select a target when required, then roll the die" : "Plan your next move while the current player acts"}</strong></div>{localPlayer && <div className="pile-review-actions"><span><Hand size={16}/> Hand ({localState?.hand.length ?? 0})</span><button onClick={() => setDeckReview("draw")}><Layers size={16}/> Draw pile ({localState?.drawPile.length ?? 0})</button><button onClick={() => setDeckReview("discard")}><Archive size={16}/> Discard ({localState?.discardPile.length ?? 0})</button><button onClick={() => setDeckReview("graveyard")}><Skull size={16}/> Graveyard ({localState?.graveyard?.length ?? 0})</button></div>}</div>
            {localState && <div className="active-effects-strip"><b>ACTIVE EFFECTS</b>{localState.attackBuff > 0 && <span className="effect-attack">Next attack +{localState.attackBuff}</span>}{localState.diceBuff > 0 && <span className="effect-bonus">Next d20 +{localState.diceBuff}</span>}{localState.dicePenalty > 0 && <span className="effect-penalty">Next d20 -{localState.dicePenalty}</span>}{favorableOmenActive && <span className="effect-support">Next card costs 0 pity</span>}{localState.skipTurns > 0 && <span className="effect-penalty">Next turn cancelled</span>}{localState.reviveIn > 0 && <span className="effect-heal">Revives in {localState.reviveIn} turns</span>}{(localState.borrowedCards?.length ?? 0) > 0 && <span className="effect-support">{(localState.borrowedCards?.length ?? 0)} borrowed card</span>}{!localState.attackBuff && !localState.diceBuff && !localState.dicePenalty && !favorableOmenActive && !localState.skipTurns && !localState.reviveIn && !(localState.borrowedCards?.length ?? 0) && <span>No active effects</span>}</div>}
            {localPlayer ? <div className="action-hand four-cards">{localHand.map((card, index) => {
              const activeMotion = !panelOverlayOpen ? cardZoneMotion : null;
              const previousIndex = activeMotion?.previousHand.indexOf(card.id) ?? -1;
              const shiftSlots = previousIndex >= 0 ? previousIndex - index : 0;
              const motionClass = activeMotion?.mode === "refill" ? "hand-card-refilling" : activeMotion?.mode === "compact" && shiftSlots > 0 ? "hand-card-compacting" : "";
              const playable = isLocalActiveTurn && status === "connected" && !rolling;
              const isSelected = isLocalActiveTurn && selectedCard === card.id;
              return <button className={`action-card effect-${card.effect} ${card.unique ? "hero-special-card" : "common-action-card"} ${card.effect === "none" ? "no-effect-card" : ""} ${isSelected ? "selected" : ""} ${motionClass}`} aria-pressed={isSelected} data-hand-slot={index} style={{ "--hero-color": localPlayer.hero.color, "--hand-shift-slots": shiftSlots, "--settled-card-opacity": isLocalActiveTurn ? 1 : 0.48 } as React.CSSProperties} key={card.id} onClick={() => setSelectedCard((current) => current === card.id ? "" : card.id)} disabled={!playable}><HandCardContents card={card} player={localPlayer} pityCostOverride={favorableOmenActive ? 0 : undefined}/></button>;
            })}</div> : <div className="private-hand-empty"><Eye size={20}/><strong>Join the battle to receive a private hand.</strong></div>}
          </section>
        </section>
        <aside className="rival-panel"><section className="turn-queue-card"><div className="panel-heading"><div><span className="eyebrow">TURN ORDER</span><strong>Current and upcoming turns</strong></div><button className="panel-expand-button" onClick={() => setExpandedPanel("turns")} aria-label="Expand turn order"><ListOrdered size={17}/></button></div><TurnOrderList players={players} game={game} order={visibleTurnOrder} localPlayer={localPlayer} onInspect={inspectPlayer}/></section>
          <section className="rivalry"><div className="panel-heading"><div><span className="eyebrow">TEAM STATUS</span><strong>Only one team can win</strong></div><Shield size={17}/></div>{(["veil", "ember"] as TeamId[]).map((team) => { const data = team === "veil" ? veil : ember; return <article className={`faction-card ${team}`} key={team}><div className="faction-title"><div className="faction-seal">{team === "veil" ? <Eye size={18}/> : <Flame size={18}/>}</div><div><span>{teamName[team]}</span><strong>{data.hp}/{data.maxHp} total HP</strong></div></div><p>{data.alive}/{data.total} alive · {data.shield} total shield</p><div className="influence-track"><i style={{ width: `${data.maxHp ? data.hp / data.maxHp * 100 : 0}%` }}/></div></article>; })}</section>
          <section className="history-panel"><div className="panel-heading"><div><span className="eyebrow">BATTLE HISTORY</span><strong>Actions, rolls, and world events</strong></div><button className="panel-expand-button" onClick={() => setExpandedPanel("history")} aria-label="Expand battle history"><History size={17}/></button></div><HistoryEntries entries={game?.history ?? []} players={players} localPlayer={localPlayer} onInspectPlayer={inspectPlayer} onInspectCard={inspectCard}/></section>
        </aside>
      </div>}
    {modalOpen && <div className="modal-backdrop" role={showWorldEvent ? undefined : "dialog"} aria-modal={showWorldEvent ? undefined : true} onClick={closeModal}><section className={`modal-card ${showGuide ? "tutorial-modal" : ""} ${deckReview || expandedPanel || inspectedPlayer ? "wide-modal" : ""} ${(showOutcome || showTurnSummary || showLifeEvent || showWorldEvent) && !showGuide && !deckReview && !expandedPanel && !inspectedPlayer && !inspectedCard ? "resolution-card" : ""}`} onClick={(event) => event.stopPropagation()}>{!showWorldEvent && <button className="modal-close icon-button" onClick={closeModal} aria-label="Close"><X size={18}/></button>}
      {showGuide ? <div className="tutorial-scroll"><span className="eyebrow">COMPLETE TUTORIAL</span><h2>How to win Shattered Oath</h2><p className="modal-lead">Two teams alternate cards and d20 rolls. Eliminate the opposing team, or hold more total HP after phase 30.</p><section className="tutorial-section"><h3><Users size={20}/> Setup</h3><div className="tutorial-steps"><article><b>1</b><div><strong>Choose a class</strong><p>Every 10-card deck contains 3 class specials, 2 common attacks, 1 common shield, 1 common heal, and 3 no-effect cards that upgrade separately when phase 5 ends. Special cards cause their printed failure penalty; common-card failures do nothing.</p></div></article><article><b>2</b><div><strong>Your cards are private</strong><p>The server sends each browser only its own hand, draw pile, discard pile, and graveyard. Click any avatar to inspect public character details without revealing private card zones.</p></div></article></div></section><section className="tutorial-section"><h3><Dices size={20}/> Playing a turn</h3><div className="tutorial-steps"><article><b>1</b><div><strong>Choose a highlighted card</strong><p>The played card enters discard. A random replacement is drawn while draw has cards. Once hand and draw are both empty, discard moves to draw, shuffles, and deals up to four cards; graveyard cards never return.</p></div></article><article><b>2</b><div><strong>Beat the random target</strong><p>The server reveals a fresh target from 8 to 16 every turn. It is independent of every previous roll. Only Focus Order, Gravity Hex, Dark Omen, and Commanding Voice modify the d20.</p></div></article><article><b>3</b><div><strong>Skip without changing cards</strong><p>Manual Skip and automatic timeout preserve the exact hand, draw pile, discard pile, and graveyard. Playing or manually discarding a card advances its normal cycle.</p></div></article></div></section><section className="tutorial-section"><h3><Zap size={20}/> Failure and World Events</h3><p>Special-card failures cause the listed backlash; common-card failures have no effect. Server-authoritative World Events resolve before phases 3, 7, 12, 17, 22, and 27. Phase 3 pauses the battle for private Shattered Tribute choices; later events grow progressively more severe. The phase-5 common-card upgrade is a separate mechanic.</p></section><section className="tutorial-section warning-section"><h3><Clock3 size={20}/> Synchronized turns</h3><p>Every client uses the server clock for the same 60-second deadline. At zero, the server immediately passes the turn without changing cards. Eliminating a team wins immediately; after phase 30, total HP decides the winner.</p></section><WorldEventLibrary className="tutorial-world-event-library"/></div> :
      deckReview ? <div className="expanded-panel-content"><span className="eyebrow">YOUR PRIVATE DECK</span><h2>{deckReview === "draw" ? "Draw pile" : deckReview === "discard" ? "Discard pile" : "Graveyard"}</h2><p className="modal-lead">{deckReview === "draw" ? "These cards remain available for random replacement draws. Their order is shown only to you." : deckReview === "discard" ? "Cycled cards remain here until both hand and draw are empty. Then this whole pile moves to draw, shuffles, and deals up to four cards." : "These cards are permanently out of circulation and cannot return to hand, draw pile, or discard pile during this battle."}</p>{reviewedCards.length ? <div className="pile-card-grid">{reviewedCards.map((card, index) => <article className={`pile-review-card effect-${card.effect} ${card.unique ? "special" : ""}`} key={`${card.id}-${index}`}><PityCostBadge card={card}/><span>{index + 1} · {card.unique ? "Special" : "Common"}</span><div className={`card-sigil effect-${card.effect}`}><CardEffectIcon card={card}/></div><strong>{card.name}</strong><p><EffectText text={card.description} card={card}/></p><CardOutcomeLines card={card}/></article>)}</div> : <div className="private-hand-empty"><Archive size={24}/><strong>This pile is empty.</strong></div>}</div> :
      expandedPanel === "history" ? <div className="expanded-panel-content"><span className="eyebrow">EXPANDED BATTLE HISTORY</span><h2>Every action and World Event</h2><HistoryEntries entries={game?.history ?? []} players={players} localPlayer={localPlayer} expanded onInspectPlayer={inspectPlayer} onInspectCard={inspectCard}/></div> :
      expandedPanel === "turns" ? <div className="expanded-panel-content"><span className="eyebrow">EXPANDED TURN ORDER</span><h2>Current and upcoming players</h2><TurnOrderList players={players} game={game} order={visibleTurnOrder} localPlayer={localPlayer} expanded onInspect={inspectPlayer}/></div> :
      inspectedPlayer ? inspectedView === "deck" ? <div className="character-deck-panel"><button className="deck-back-button" onClick={() => setInspectedView("status")}><ChevronLeft size={17}/> Back to character status</button><PublicDeck player={inspectedPlayer} localPlayer={localPlayer}/></div> : <div className="character-detail-modal"><div className="large-portrait" style={{ "--hero-color": inspectedPlayer.hero.color } as React.CSSProperties}>{inspectedPlayer.hero.initials}</div><span className="eyebrow"><b className={`player-name-highlight ${playerRelationClass(inspectedPlayer, localPlayer)}`}>{inspectedPlayer.displayName}</b> · {teamName[inspectedPlayer.hero.team]}</span><h2>{inspectedPlayer.hero.name}</h2><p className="modal-lead">{inspectedPlayer.hero.title} · {inspectedPlayer.hero.className}</p><p>{inspectedPlayer.hero.summary}</p><div className="character-detail-stats"><div><span>HP</span><strong>{game?.playerStates[inspectedPlayer.id]?.hp ?? inspectedPlayer.hero.hp}/{game?.playerStates[inspectedPlayer.id]?.maxHp ?? inspectedPlayer.hero.maxHp}</strong></div><div><span>Shield</span><strong>{game?.playerStates[inspectedPlayer.id]?.shield ?? 0}</strong></div><div><span>Speed</span><strong>{inspectedPlayer.hero.speed}</strong></div><div><span>Status</span><strong>{(game?.playerStates[inspectedPlayer.id]?.hp ?? inspectedPlayer.hero.hp) > 0 ? "Living" : "Defeated"}</strong></div></div><div className="passive-callout"><Crown size={18}/><div><span>PASSIVE · {inspectedPlayer.hero.passiveName}</span><strong>{inspectedPlayer.hero.passiveText}</strong></div></div><div className="character-impact-grid"><div className="character-trait strength"><span>Strength</span><strong>{inspectedPlayer.hero.strength}</strong></div><div className="character-trait weakness"><span>Weakness</span><strong>{inspectedPlayer.hero.weakness}</strong></div></div><div className="impact-note"><Sparkles size={18}/><div><span>Battle impact</span><p>{inspectedPlayer.hero.impact}</p></div></div><button className="primary-button preview-character-deck-button" onClick={() => setInspectedView("deck")}><Layers size={17}/> Preview full 10-card deck</button></div> :
      inspectedCard ? <div className={`history-card-detail effect-${inspectedCard.effect}`}><span className="eyebrow">{inspectedCard.unique ? "SPECIAL CARD" : inspectedCard.effect === "none" ? "NO-EFFECT CARD" : "COMMON ACTION"}</span><div className={`card-sigil effect-${inspectedCard.effect}`}><CardEffectIcon card={inspectedCard}/></div><PityCostBadge card={inspectedCard}/><h2>{inspectedCard.name}</h2><p className="modal-lead"><EffectText text={inspectedCard.description} card={inspectedCard}/></p><CardOutcomeLines card={inspectedCard}/></div> :
      showOutcome && outcome ? outcome.kind === "discard" || outcome.kind === "skip" ? <LocalTurnActionPanel outcome={outcome} players={players} localPlayer={localPlayer} onContinue={() => setDismissedOutcomeKey(outcomeKey)}/> : <div className="resolution-content"><div className={`resolution-hero ${outcome.success ? "success" : "failure"}`}>{outcome.success ? <Check size={34}/> : <Skull size={34}/>}</div><span className="eyebrow">YOUR ACTION</span><h2><HighlightPlayerNames text={`${outcome.actorName ?? "Player"} used ${outcome.cardName ?? "a card"}`} players={players} localPlayer={localPlayer}/></h2><div className="resolution-chips">{outcome.effect && <span>{outcome.effect}</span>}{outcome.targetName && <span>Target: <HighlightPlayerNames text={outcome.targetName} players={players} localPlayer={localPlayer}/></span>}</div>{outcome.resolution === "pity" ? <div className="resolution-pity"><PityIcon size={24}/><span><small>Guaranteed pity success</small><strong>{outcome.pityBefore ?? 0} − {outcome.pityCost ?? 0} = {outcome.pityAfter ?? 0} pity</strong></span></div> : outcome.pityCost === 0 ? <AutomaticSuccessNotice roll={outcome.roll}/> : <div className="resolution-equation"><span><small>d20 roll</small><strong>{outcome.roll ?? 0}</strong></span><i>+</i><span><small>total bonus</small><strong>{outcome.bonus ?? 0}</strong></span>{Boolean(outcome.dicePenalty) && <><i>−</i><span className="failure"><small>enemy penalty</small><strong>{outcome.dicePenalty}</strong></span></>}<i>=</i><span className={outcome.success ? "success" : "failure"}><small>your total</small><strong>{outcome.total}</strong></span><i className="compare-word">vs</i><span className="dice-target-result"><small>dice target</small><strong>{outcome.target}</strong></span></div>}<strong className={`resolution-verdict ${outcome.success ? "success" : "failure"}`}>{outcome.success ? "SUCCESS" : "FAILURE"}</strong><p className="modal-lead"><HighlightPlayerNames text={outcome.detail} players={players} localPlayer={localPlayer}/></p>{outcome.failureDetail && <p className="negative-card-effect"><Skull size={16}/> <HighlightPlayerNames text={outcome.failureDetail} players={players} localPlayer={localPlayer}/></p>}<div className="resolution-metrics single-metric"><div><span>Next random target</span><strong>{outcome.nextTarget ?? adventure.target}</strong></div></div><button className="primary-button continue-button" onClick={() => setDismissedOutcomeKey(outcomeKey)}>Continue <ChevronRight size={17}/></button></div> :
      showTurnSummary && outcome ? outcome.kind === "discard" ? <div className="resolution-content discard-summary-content"><h2><HighlightPlayerNames text={`${outcome.actorName ?? "Player"} discarded a card`} players={players} localPlayer={localPlayer}/></h2></div> : <div className="resolution-content"><div className={`resolution-hero ${outcome.success ? "success" : "failure"}`}>{outcome.success ? <Check size={34}/> : <Skull size={34}/>}</div><span className="eyebrow">TURN SUMMARY</span><h2><HighlightPlayerNames text={outcome.label} players={players} localPlayer={localPlayer}/></h2>{outcome.resolution === "roll" && outcome.pityCost === 0 && <AutomaticSuccessNotice roll={outcome.roll}/>}<p className="modal-lead"><HighlightPlayerNames text={outcome.detail} players={players} localPlayer={localPlayer}/></p></div> :
      showWorldEvent && queuedWorldEvent ? <ResolvedWorldEventPanel event={queuedWorldEvent} localPlayerId={localPlayer?.id} onClose={() => dismissPresentation()} onContinue={() => dismissPresentation()} onViewHistory={() => { dismissPresentation(); setExpandedPanel("history"); }}/> :
      showLifeEvent && activeLifeEvent ? <div className={`resolution-content life-event-content ${activeLifeEvent.kind}`}><div className={`resolution-hero ${activeLifeEvent.kind === "revive" ? "success" : "failure"}`}>{activeLifeEvent.kind === "revive" ? <Heart size={34}/> : <Skull size={34}/>}</div><span className="eyebrow">PLAYER {activeLifeEvent.kind === "revive" ? "REVIVED" : "DEFEATED"}</span><h2><HighlightPlayerNames text={activeLifeEvent.playerName} players={players} localPlayer={localPlayer}/></h2><p className="modal-lead"><HighlightPlayerNames text={activeLifeEvent.reason} players={players} localPlayer={localPlayer}/></p><button className="primary-button continue-button" onClick={() => dismissPresentation()}>Continue <ChevronRight size={17}/></button></div> :
      showRunComplete ? <div className={`resolution-content battle-result-content ${localBattleVerdict}`}><div className={`resolution-hero ${localBattleVerdict === "victory" ? "success" : localBattleVerdict === "defeat" ? "failure" : "world"}`}>{localBattleVerdict === "defeat" ? <Skull size={34}/> : <Crown size={34}/>}</div><span className="eyebrow">BATTLE COMPLETE</span><h2>{localBattleVerdict === "victory" ? "Victory" : localBattleVerdict === "defeat" ? "Defeat" : game?.winnerTeam ? `${teamName[game.winnerTeam]} wins!` : "The battle was ended."}</h2><p className="modal-lead"><HighlightPlayerNames text={localBattleVerdict === "victory" && localPlayer ? `${teamName[localPlayer.hero.team]} won the battle. ${game?.endReason ?? ""}` : localBattleVerdict === "defeat" && localPlayer && game?.winnerTeam ? `${teamName[game.winnerTeam]} defeated ${teamName[localPlayer.hero.team]}. ${game?.endReason ?? ""}` : game?.endReason ?? undefined} players={players} localPlayer={localPlayer}/></p><div className="resolution-metrics"><div><span>Veilbound</span><strong>{veil.hp} HP</strong></div><div><span>Embercourt</span><strong>{ember.hp} HP</strong></div></div><button className="primary-button" onClick={() => send({ type: "return:lobby" })}><RefreshCw size={17}/> Return to lobby</button></div> : null}
    </section></div>}
  </main>;
}
