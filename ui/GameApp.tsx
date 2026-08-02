"use client";

import { Archive, AudioLines, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Coins, Crown, Dices, Eye, Flame, Hand, Heart, History, Hourglass, Layers, ListOrdered, LogOut, Octagon, RefreshCw, Shield, ShoppingBag, Skull, Sparkles, Target, Users, Volume2, X, Zap } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createAdventure, createInitialGame, createPlayerSession, getCharacterOptions, getPassiveDiceBonus, randomD20Roll, resolveCardTurn } from "@/backend/game/engine";
import { getEffectiveCardPityCost, getCardRarityLabel, getCardTargetLabel, hasFavorableOmen } from "@/shared/cardRules";
import { canPayLioraVennHealthCost, LIORA_VENN_MINIMUM_HP } from "@/shared/lioraVenn.mjs";
import { getCurrentBattlePhase, getPhaseCountDenominator, getVisualizedCompletedPhases, PHASE_TIMELINE_LENGTH } from "@/shared/battlePhases.mjs";
import { visibleDiceModifier } from "@/shared/diceVisibility";
import { isValidRoomId, normalizeRoomId } from "@/shared/roomId.mjs";
import { getWorldEventDefinition, getWorldEventScheduleEntry, isWorldEventPhase } from "@/shared/worldEvents.mjs";
import { formatGoldUnits, getShopOffer, SHOP_CATALOG } from "@/shared/shop.mjs";
import { formatHistoryPresentation, formatLifeEventPresentation, formatOutcomePresentation, formatViewpointText, getStatusPresentations, playerReference, viewerRelation } from "@/shared/viewpoint.mjs";
import type { ActionCard, GameHistoryEntry, GameNotice, GameOutcome, PlayerLifeEvent, PlayerSession, SyncedGameState, TeamId, WorldEventOutcome } from "@/shared/types";
import { DiceRoller } from "./components/DiceRoller";
import { CardFace } from "./components/CardFace";
import { CharacterAvatar } from "./components/CharacterAvatar";
import { HighlightCardNames } from "./components/HighlightCardNames";
import { HomeScreen } from "./components/HomeScreen";
import { Lobby } from "./components/Lobby";
import { PartyRail } from "./components/PartyRail";
import { AutoPanelVfx, type AutoPanelVfxVariant } from "./components/AutoPanelVfx";
import { PityIcon } from "./components/PityCost";
import { ShopPanel } from "./components/ShopPanel";
import { ResolvedWorldEventPanel, ShatteredTributeChoicePanel, WorldEventLibrary } from "./components/WorldEventPanels";
import { useGameAudio } from "./hooks/useGameAudio";
import { useRoomSocket } from "./hooks/useRoomSocket";

const teamName: Record<TeamId, string> = { veil: "Veilbound", ember: "Embercourt" };
const PLAYER_NAME_STORAGE_KEY = "shattered-oath-player-name";
const GAME_NOTICE_DURATION_MS = 10_000;
type OutcomeVfxTone = "success" | "failure" | "skip" | "discard" | "neutral";
type PresentationQueueItem =
  | { id: string; kind: "world"; event: WorldEventOutcome }
  | { id: string; kind: "life"; lifeEvent: PlayerLifeEvent }
  | { id: string; kind: "battle"; battleKey: string };
const teamRelationClass = (team?: TeamId, localTeam?: TeamId) => team && localTeam ? (team === localTeam ? "ally" : "enemy") : "neutral";
const playerRelationClass = (player?: PlayerSession, localPlayer?: PlayerSession) => teamRelationClass(player?.hero.team, localPlayer?.hero.team);
function getOutcomeVfxTone(outcome?: GameOutcome | null): OutcomeVfxTone {
  if (outcome?.kind === "card") return outcome.success ? "success" : "failure";
  if (outcome?.kind === "discard") return "discard";
  if (outcome?.kind === "skip" || outcome?.kind === "timeout" || outcome?.kind === "forced-skip") return "skip";
  return "neutral";
}
function AutomaticSuccessNotice({ roll }: { roll?: number }) {
  return <div className="automatic-success-notice"><Check size={22}/><span><small>ZERO-PITY CARD</small><strong>Automatic success</strong><b>d20 {roll ?? 0} was ignored</b></span></div>;
}

function GameNoticeIcon({ kind }: { kind: GameNotice["kind"] }) {
  if (kind === "phase-start") return <Zap size={19}/>;
  if (kind === "shop-use") return <ShoppingBag size={19}/>;
  return <Sparkles size={19}/>;
}

function HandCardContents({ card, pityCostOverride }: { card: ActionCard; pityCostOverride?: number }) {
  return <CardFace card={card} pityCostOverride={pityCostOverride} previewTrigger="hover"/>;
}

function PublicDeck({ player, localPlayer }: { player: PlayerSession; localPlayer?: PlayerSession }) {
  return <div className="public-character-deck"><div className="public-deck-heading"><div><span className="eyebrow">PUBLIC CHARACTER DECK · <b className={`player-name-highlight ${playerRelationClass(player, localPlayer)}`}>{player.displayName}</b></span><strong>{player.hero.name} · {player.skillDeck.length} cards</strong></div></div><div>{player.skillDeck.map((card) => <article key={card.id} className={`public-deck-card gothic-card effect-${card.effect} ${card.unique ? "public-special-card" : ""}`} style={{ "--hero-color": player.hero.color } as React.CSSProperties}><CardFace card={card}/></article>)}</div></div>;
}

function DetailedGuide({ onClose }: { onClose: () => void }) {
  return <div className="guide-update-backdrop" onClick={onClose}>
    <section className="guide-update-panel" onClick={(event) => event.stopPropagation()}>
      <button className="modal-close icon-button" onClick={onClose} aria-label="Close"><X size={18}/></button>
      <span className="eyebrow">QUICK GUIDE</span>
      <h2>How to play Shattered Oath</h2>
      <div className="guide-update-grid">
        <article><strong>1 · Choose a character, or start with a random one.</strong></article>
        <article><strong>2 · HP keeps you alive; Speed sets turn order.</strong></article>
        <article><strong>3 · Choose a card to roll or discard, or skip.</strong></article>
        <article><strong>4 · Meet the target with your modified d20 to succeed.</strong></article>
        <article><strong>5 · Failed rolls grant pity; spend the shown cost for guaranteed success.</strong></article>
        <article><strong>6 · World Events occur before phases 3, 7, 12, 17, 22, and 27.</strong></article>
        <article><strong>7 · Rolled actions earn Gold. Open Shop below Battle History to buy Potions, Items, and External Cards.</strong></article>
        <article><strong>8 · Defeat the enemy team, or press End battle to settle the current result.</strong></article>
      </div>
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
    const width = confirmationRef.current?.getBoundingClientRect().width ?? Math.min(210, window.innerWidth - 16);
    setPopoverPosition({
      top: rect.bottom + 9,
      left: Math.min(Math.max(8, rect.right - width), Math.max(8, window.innerWidth - width - 8)),
    });
  };
  useLayoutEffect(() => {
    if (!open) return;
    placeConfirmation();
    window.addEventListener("resize", placeConfirmation);
    window.addEventListener("scroll", placeConfirmation, true);
    return () => {
      window.removeEventListener("resize", placeConfirmation);
      window.removeEventListener("scroll", placeConfirmation, true);
    };
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

function HighlightPlayerNames({ text = "", players, localPlayer, onInspect, useActualNames = false }: { text?: string; players: PlayerSession[]; localPlayer?: PlayerSession; onInspect?: (id: string) => void; useActualNames?: boolean }) {
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
    const label = useActualNames || player.id !== localPlayer?.id ? part : possessive ? "YOUR" : "YOU";
    return onInspect
      ? <button type="button" className={`${className} history-player-link`} title={player.hero.name} aria-label={`View ${label}, ${player.hero.name}`} onClick={() => onInspect(player.id)} key={`${part}-${index}`}>{label}</button>
      : <span className={className} key={`${part}-${index}`}>{label}</span>;
  })}</>;
}

function GameNoticeTitle({ notice, players, localPlayer }: { notice: GameNotice; players: PlayerSession[]; localPlayer?: PlayerSession }) {
  const actor = notice.actorId ? players.find((player) => player.id === notice.actorId) : undefined;
  const offer = notice.shopOfferId ? getShopOffer(notice.shopOfferId) : undefined;
  if (notice.kind !== "shop-use" || !actor || !offer) return <HighlightPlayerNames text={notice.title} players={players} localPlayer={localPlayer} useActualNames/>;
  return <><b className={`inline-player-name ${playerRelationClass(actor, localPlayer)}`}>{actor.displayName}</b> used <b className={`shop-notice-offer ${offer.category}`}>{offer.name}</b></>;
}

function HighlightInteractiveNames({ text = "", cardNames, players, localPlayer, onInspectCard, onInspectPlayer, useActualNames = false }: { text?: string; cardNames: readonly string[]; players: PlayerSession[]; localPlayer?: PlayerSession; onInspectCard?: (name: string) => void; onInspectPlayer?: (id: string) => void; useActualNames?: boolean }) {
  return <HighlightCardNames
    text={text}
    cardNames={cardNames}
    onInspectCard={onInspectCard}
    renderRemainder={(remainder) => <HighlightPlayerNames text={remainder} players={players} localPlayer={localPlayer} onInspect={onInspectPlayer} useActualNames={useActualNames}/>}
  />;
}

function ViewpointPlayerText({ text = "", players, localPlayer, involvedPlayerIds = [], emphasizedPlayerIds = [], onInspect, cardNames = [], onInspectCard }: { text?: string; players: PlayerSession[]; localPlayer?: PlayerSession; involvedPlayerIds?: string[]; emphasizedPlayerIds?: string[]; onInspect?: (id: string) => void; cardNames?: readonly string[]; onInspectCard?: (name: string) => void }) {
  const formatted = formatViewpointText(text, players, localPlayer?.id, { involvedPlayerIds, emphasizedPlayerIds });
  return <HighlightInteractiveNames text={formatted} cardNames={cardNames} players={players} localPlayer={localPlayer} onInspectPlayer={onInspect} onInspectCard={onInspectCard}/>;
}

function LocalTurnActionPanel({ outcome, players, localPlayer, cardNames, onInspectCard, onContinue }: { outcome: GameOutcome; players: PlayerSession[]; localPlayer?: PlayerSession; cardNames: readonly string[]; onInspectCard: (name: string) => void; onContinue: () => void }) {
  const discarded = outcome.kind === "discard";
  const presentation = formatOutcomePresentation(outcome, players, localPlayer?.id);
  return <div className={`resolution-content local-turn-action-content ${discarded ? "discard" : "skip"}`}><div className="resolution-hero world">{discarded ? <Archive size={34}/> : <Hourglass size={34}/>}</div><span className="eyebrow">{presentation.category}</span><h2><HighlightInteractiveNames text={presentation.title} cardNames={cardNames} players={players} localPlayer={localPlayer} onInspectCard={onInspectCard}/></h2><p className="modal-lead"><HighlightInteractiveNames text={presentation.detail} cardNames={cardNames} players={players} localPlayer={localPlayer} onInspectCard={onInspectCard}/></p><button className="primary-button continue-button" onClick={onContinue}>Continue <ChevronRight size={17}/></button></div>;
}

function HistoryMessage({ entry, text, players, localPlayer, onInspectPlayer, onInspectCard }: { entry: GameHistoryEntry; text: string; players: PlayerSession[]; localPlayer?: PlayerSession; onInspectPlayer: (id: string) => void; onInspectCard: (name: string) => void }) {
  return <HighlightInteractiveNames text={text} cardNames={entry.cardName ? [entry.cardName] : []} players={players} localPlayer={localPlayer} onInspectPlayer={onInspectPlayer} onInspectCard={onInspectCard} useActualNames/>;
}

type HistoryFilter = "all" | "mine" | "affecting" | "allies" | "enemies" | "attacks" | "healing" | "buffs" | "debuffs" | "discards" | "passes" | "forced-skips" | "life" | "successes" | "failures" | "world" | "card-movement";
const historyFilters: Array<{ value: HistoryFilter; label: string }> = [
  { value: "all", label: "All events" },
  { value: "mine", label: "My actions" },
  { value: "affecting", label: "Events affecting me" },
  { value: "allies", label: "Allies" },
  { value: "enemies", label: "Enemies" },
  { value: "attacks", label: "Attacks" },
  { value: "healing", label: "Healing" },
  { value: "buffs", label: "Buffs" },
  { value: "debuffs", label: "Debuffs" },
  { value: "discards", label: "Voluntary discards" },
  { value: "passes", label: "Passed turns" },
  { value: "forced-skips", label: "Forced skipped turns" },
  { value: "life", label: "Defeats and revivals" },
  { value: "successes", label: "Successes" },
  { value: "failures", label: "Failures" },
  { value: "world", label: "World events" },
  { value: "card-movement", label: "Card movement" }
];

function matchesHistoryFilter(entry: GameHistoryEntry, filter: HistoryFilter, players: PlayerSession[], localPlayer?: PlayerSession) {
  if (filter === "all") return true;
  const actor = players.find((player) => player.displayName === entry.actorName);
  const targetsLocalPlayer = Boolean(localPlayer && String(entry.targetName || "").split(",").map((name) => name.trim()).includes(localPlayer.displayName));
  const relation = viewerRelation(actor, localPlayer);
  const card = players.flatMap((player) => player.skillDeck).find((candidate) => candidate.name === entry.cardName);
  if (filter === "mine") return actor?.id === localPlayer?.id;
  if (filter === "affecting") return targetsLocalPlayer || actor?.id === localPlayer?.id;
  if (filter === "allies") return relation === "ally";
  if (filter === "enemies") return relation === "enemy";
  if (filter === "attacks") return entry.kind === "damage" || entry.kind === "aoe";
  if (filter === "healing") return entry.kind === "heal";
  if (filter === "buffs") return entry.kind === "guard" || (entry.kind === "support" && !["enemy-dice", "dispel-enemy", "skip-enemy", "delay-enemy", "purge-card", "steal-card"].includes(card?.supportType ?? ""));
  if (filter === "debuffs") return entry.kind === "support" && ["enemy-dice", "dispel-enemy", "skip-enemy", "delay-enemy", "purge-card", "steal-card"].includes(card?.supportType ?? "");
  if (filter === "discards") return entry.kind === "discard";
  if (filter === "passes") return entry.kind === "skip" || entry.kind === "timeout";
  if (filter === "forced-skips") return entry.kind === "forced-skip";
  if (filter === "life") return /defeat|reviv|second sight|returning light/i.test(entry.message);
  if (filter === "successes") return entry.success && !["world", "system"].includes(entry.kind);
  if (filter === "failures") return !entry.success && !["discard", "skip", "timeout", "forced-skip", "system"].includes(entry.kind);
  if (filter === "world") return entry.kind === "world";
  return entry.kind === "discard" || ["purge-card", "steal-card"].includes(card?.supportType ?? "") || entry.kind === "world" && /card/i.test(entry.message);
}

function HistoryEntries({ entries, players, localPlayer, expanded = false, onInspectPlayer, onInspectCard }: { entries: GameHistoryEntry[]; players: PlayerSession[]; localPlayer?: PlayerSession; expanded?: boolean; onInspectPlayer: (id: string) => void; onInspectCard: (name: string) => void }) {
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const filteredEntries = expanded ? entries.filter((entry) => matchesHistoryFilter(entry, filter, players, localPlayer)) : entries.slice(-1);
  const renderEntry = (entry: GameHistoryEntry) => {
    const presentation = formatHistoryPresentation(entry, players);
    const visibleDiceBonus = visibleDiceModifier(entry.diceBonus, entry.actorName, localPlayer?.displayName);
    const visibleDicePenalty = visibleDiceModifier(entry.dicePenalty, entry.actorName, localPlayer?.displayName);
    return <article className={`history-entry ${entry.kind} ${entry.success ? "success" : "failure"}`} key={entry.id}><span className={entry.kind === "world" ? "history-event-label" : ""}>{entry.kind === "world" && <Zap size={12}/>} {entry.kind === "world" ? `WORLD EVENT · PHASE ${entry.phase ?? entry.turn}` : `Turn ${entry.turn} · ${presentation.type}`}</span><p><HistoryMessage entry={entry} text={presentation.details} players={players} localPlayer={localPlayer} onInspectPlayer={onInspectPlayer} onInspectCard={onInspectCard}/></p>{entry.diceRoll != null && (entry.resolution === "roll" && entry.pityCost === 0 ? <div className="history-dice automatic"><span>d20: {entry.diceRoll} · ignored</span><strong>Automatic success · zero-pity card</strong></div> : <div className="history-dice"><span>d20: {entry.diceRoll}</span><span>Active/passive bonus: +{visibleDiceBonus}</span>{Boolean(entry.dicePenalty) && <span>Penalty: -{visibleDicePenalty}</span>}<strong>Total {entry.diceTotal} / target {entry.diceTarget}</strong></div>)}{entry.resolution === "pity" && <div className="history-pity"><PityIcon size={13}/><span>Guaranteed success · spent {entry.pityCost ?? 0}</span><strong>{entry.pityBefore ?? 0} → {entry.pityAfter ?? 0} pity</strong></div>}</article>;
  };
  if (!expanded) return <div className="history-list">{!filteredEntries.length && <p className="empty-history">No actions yet.</p>}{[...filteredEntries].reverse().map(renderEntry)}</div>;
  const rows = [...filteredEntries].reverse();
  const phaseGroups: Array<{ phase: number | string; entries: GameHistoryEntry[] }> = [];
  for (const entry of rows) {
    const phase = entry.phase ?? "—";
    const group = phaseGroups.find((candidate) => candidate.phase === phase);
    if (group) group.entries.push(entry);
    else phaseGroups.push({ phase, entries: [entry] });
  }
  const renderTableRow = (entry: GameHistoryEntry, phase: number | string, phaseRowSpan: number, firstInPhase: boolean) => {
    const presentation = formatHistoryPresentation(entry, players);
    const roll = entry.resolution === "pity" ? (
      <span className="history-roll-summary">
        <span>result: guaranteed</span>
        <span>target: —</span>
      </span>
    ) : entry.diceRoll != null ? (
      <span className="history-roll-summary">
        <span>result: {entry.diceTotal ?? entry.diceRoll}</span>
        <span>target: {entry.diceTarget ?? "—"}</span>
      </span>
    ) : (
      <span className="history-roll-summary">
        <span>result: —</span>
        <span>target: —</span>
      </span>
    );
    return <tr className={`${entry.kind} ${entry.success ? "success" : "failure"}`} key={entry.id}>{firstInPhase && <th className="history-phase-cell" scope="rowgroup" rowSpan={phaseRowSpan} aria-label={`Phase ${phase}`}>{phase}</th>}<td>{entry.turn}</td><td>{presentation.type}</td><td><HighlightPlayerNames text={presentation.actor} players={players} localPlayer={localPlayer} onInspect={onInspectPlayer} useActualNames/></td><td><HighlightPlayerNames text={presentation.target} players={players} localPlayer={localPlayer} onInspect={onInspectPlayer} useActualNames/></td><td>{entry.cardName ? <button type="button" className="history-card-link" onClick={() => onInspectCard(entry.cardName!)}>{presentation.card}</button> : presentation.card}</td><td><b className={`history-result ${presentation.result.toLocaleLowerCase().replace(/\s+/g, "-")}`}>{presentation.result}</b></td><td>{presentation.changes}</td><td className="history-penalty-cell"><HighlightPlayerNames text={presentation.penalty || "—"} players={players} localPlayer={localPlayer} onInspect={onInspectPlayer} useActualNames/></td><td>{presentation.duration}</td><td>{roll}</td><td><HistoryMessage entry={entry} text={presentation.details} players={players} localPlayer={localPlayer} onInspectPlayer={onInspectPlayer} onInspectCard={onInspectCard}/></td></tr>;
  };
  return <div className="viewpoint-history"><label className="history-filter-control"><span>VIEW</span><select value={filter} onChange={(event) => setFilter(event.target.value as HistoryFilter)}>{historyFilters.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label><div className="history-table-scroll"><table className="history-table"><thead><tr><th>Phase</th><th>Turn</th><th>Type</th><th>Actor</th><th>Target</th><th>Card or event</th><th>Result</th><th>Changes</th><th>Penalty</th><th>Duration</th><th>Roll</th><th>Details</th></tr></thead><tbody>{phaseGroups.flatMap((group) => group.entries.map((entry, index) => renderTableRow(entry, group.phase, group.entries.length, index === 0)))}</tbody></table>{!rows.length && <p className="empty-history">No events match this view.</p>}</div></div>;
}

function TurnOrderList({ players, game, order, localPlayer, expanded = false, onInspect }: { players: PlayerSession[]; game: SyncedGameState | null; order: PlayerSession[]; localPlayer?: PlayerSession; expanded?: boolean; onInspect: (id: string) => void }) {
  const activeId = order[0]?.id;
  const acted = new Set(game?.actedThisRound ?? []);
  const branchPlayers = expanded ? (game?.roundOrder ?? order.map((player) => player.id)).map((id) => players.find((player) => player.id === id)).filter((player): player is PlayerSession => Boolean(player)) : order.slice(0, 2);
  return <div className={`turn-queue-list ${expanded ? "expanded-turn-list turn-branch" : ""}`}>{branchPlayers.map((player) => { const status = player.id === activeId ? "current" : acted.has(player.id) ? "passed" : "future"; return <article className={`turn-queue-item ${status}`} aria-label={`${status}: ${player.displayName}`} key={player.id}><button className="portrait-button" onClick={() => onInspect(player.id)} aria-label={`View ${player.displayName}'s character`}><CharacterAvatar hero={player.hero} className="portrait mini" sizes="28px"/></button><div className="turn-player-copy"><strong className={`player-name-highlight ${playerRelationClass(player, localPlayer)}`}>{player.displayName}</strong><span className="turn-player-meta">{player.hero.name} · Speed {player.hero.speed} · {teamName[player.hero.team]} · {game?.playerStates[player.id]?.hp ?? player.hero.hp} HP</span></div>{expanded && <i className="turn-branch-node" aria-hidden="true"/>}</article>; })}</div>;
}

function RunStatus({ completedPhases, secondsLeft, worldEvents, worldEventPlan, pendingEvent, onOpenWorldEvents }: { completedPhases: number; secondsLeft: number; worldEvents: SyncedGameState["worldEventHistory"]; worldEventPlan?: SyncedGameState["worldEventPlan"]; pendingEvent?: SyncedGameState["pendingWorldEvent"]; onOpenWorldEvents: () => void }) {
  const currentPhase = getCurrentBattlePhase(completedPhases);
  const visualizedCompletedPhases = getVisualizedCompletedPhases(completedPhases);
  return <nav className="run-status" aria-label="Battle status"><div><span className="eyebrow">PHASE</span><strong>{currentPhase} <i>/ {getPhaseCountDenominator(currentPhase)}</i></strong></div><div className="chapter-pips" aria-label="First 30 phases">{Array.from({ length: PHASE_TIMELINE_LENGTH }).map((_, index) => {
    const phase = index + 1;
    const phaseClass = index < visualizedCompletedPhases ? "complete" : index === visualizedCompletedPhases ? "current" : "future";
    const eventPhase = isWorldEventPhase(phase);
    const schedule = eventPhase ? getWorldEventScheduleEntry(phase) : null;
    const resolvedEvent = eventPhase ? worldEvents.find((entry) => entry.phase === phase) : undefined;
    const resolvedDefinition = resolvedEvent ? getWorldEventDefinition(resolvedEvent.eventKey) : null;
    const pendingForPhase = pendingEvent?.phase === phase ? pendingEvent : undefined;
    const plannedDefinition = worldEventPlan?.[phase] ? getWorldEventDefinition(worldEventPlan[phase]!) : null;
    const waiting = Boolean(pendingForPhase);
    const eventDetail = resolvedEvent
      ? `${resolvedEvent.title}: ${resolvedDefinition?.fullDescription || resolvedEvent.fullDescription || resolvedEvent.description}`
      : pendingForPhase
        ? `${pendingForPhase.title}: ${pendingForPhase.fullDescription || pendingForPhase.description}`
        : plannedDefinition
          ? `${plannedDefinition.title}: ${plannedDefinition.fullDescription}`
          : `${schedule?.intensity} Level ${schedule?.level}. The event will be selected before phase ${phase}.`;
    return <i key={phase} data-turn={phase} title={eventPhase ? undefined : `Phase ${phase}`} tabIndex={eventPhase ? 0 : undefined} aria-label={eventPhase ? `Phase ${phase}, World Event${waiting ? ", waiting for choices" : ""}. ${eventDetail}` : `Phase ${phase}`} className={`${phaseClass} ${eventPhase ? "world-event-turn" : ""} ${resolvedEvent ? "event-triggered" : ""} ${waiting ? "event-pending" : ""}`}>{eventPhase && <span className="phase-event-tooltip" role="tooltip"><span className="tooltip-arrow phase-tooltip-arrow" aria-hidden="true"/><b><Zap size={13}/> Phase {phase} World Event{waiting ? " · Waiting for choices" : ""}</b><small>{eventDetail}</small></span>}</i>;
  })}</div><div className={`turn-clock ${pendingEvent ? "event-paused" : secondsLeft <= 10 ? "urgent" : ""}`}><Clock3 size={14}/> {pendingEvent ? "Event choice" : `${secondsLeft} seconds`}</div><button type="button" className="icon-button phase-world-events-button" onClick={onOpenWorldEvents} aria-label="View all World Events" title="View all World Events"><Zap size={17}/></button></nav>;
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

type RoomMetadata = { roomId: string; createdAt: number; expiresAt: number };

function roomIdFromLocation() {
  return normalizeRoomId(new URLSearchParams(window.location.search).get("room"));
}

export default function GameApp() {
  const [activeRoomId, setActiveRoomId] = useState("");
  const [homeBusy, setHomeBusy] = useState(false);
  const [homeError, setHomeError] = useState("");

  const openRoom = (roomId: string, historyMode: "push" | "replace" = "push") => {
    const normalized = normalizeRoomId(roomId);
    const url = new URL(window.location.href);
    url.searchParams.set("room", normalized);
    window.history[historyMode === "push" ? "pushState" : "replaceState"]({}, "", url);
    setHomeError("");
    setActiveRoomId(normalized);
  };

  const joinRoom = async (roomId: string, historyMode: "push" | "replace" = "push") => {
    const normalized = normalizeRoomId(roomId);
    if (!isValidRoomId(normalized)) {
      setHomeError("Enter a valid 8-character room ID.");
      return;
    }
    setHomeBusy(true);
    setHomeError("");
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(normalized)}`, { cache: "no-store" });
      const result = await response.json() as { room?: RoomMetadata; error?: string };
      if (!response.ok || !result.room) throw new Error(result.error || "Room not found.");
      openRoom(result.room.roomId, historyMode);
    } catch (error) {
      setHomeError(error instanceof Error ? error.message : "Room unavailable.");
    } finally {
      setHomeBusy(false);
    }
  };

  const createRoom = async () => {
    setHomeBusy(true);
    setHomeError("");
    try {
      const response = await fetch("/api/rooms", { method: "POST", headers: { "Content-Type": "application/json" } });
      const result = await response.json() as { room?: RoomMetadata; error?: string };
      if (!response.ok || !result.room) throw new Error(result.error || "Could not create a room.");
      openRoom(result.room.roomId);
    } catch (error) {
      setHomeError(error instanceof Error ? error.message : "Could not create a room.");
    } finally {
      setHomeBusy(false);
    }
  };

  const returnHome = (message = "") => {
    const url = new URL(window.location.href);
    url.searchParams.delete("room");
    window.history.replaceState({}, "", url);
    setActiveRoomId("");
    setHomeError(message);
  };

  useEffect(() => {
    const requestedRoomId = roomIdFromLocation();
    if (requestedRoomId) void joinRoom(requestedRoomId, "replace");
    const handlePopState = () => {
      const nextRoomId = roomIdFromLocation();
      if (nextRoomId) void joinRoom(nextRoomId, "replace");
      else {
        setActiveRoomId("");
        setHomeError("");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return activeRoomId
    ? <RoomGame roomId={activeRoomId} onRoomUnavailable={returnHome} onReturnHome={() => returnHome()}/>
    : <HomeScreen busy={homeBusy} error={homeError} onCreateRoom={createRoom} onJoinRoom={joinRoom}/>;
}

function RoomGame({ roomId, onRoomUnavailable, onReturnHome }: { roomId: string; onRoomUnavailable: (message: string) => void; onReturnHome: () => void }) {
  const { room, status, error: roomError, roomAccessError, sessionId, serverTimeOffsetMs, teamJoinSoundSequence, send, clearError } = useRoomSocket(roomId);
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
  const [presentationQueue, setPresentationQueue] = useState<PresentationQueueItem[]>([]);
  const [deckReview, setDeckReview] = useState<"draw" | "discard" | "graveyard" | null>(null);
  const [expandedPanel, setExpandedPanel] = useState<"history" | "turns" | "world-events" | "shop" | null>(null);
  const [inspectedPlayerId, setInspectedPlayerId] = useState<string | null>(null);
  const [inspectedCardName, setInspectedCardName] = useState<string | null>(null);
  const [inspectedView, setInspectedView] = useState<"status" | "deck">("status");
  const [mobileParty, setMobileParty] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [visibleNotices, setVisibleNotices] = useState<GameNotice[]>([]);
  const expirySentRef = useRef(0);
  const outcomeSoundReadyRef = useRef(false);
  const lastOutcomeSoundKeyRef = useRef("");
  const lastBattleResultKeyRef = useRef("");
  const seenNoticeIdsRef = useRef(new Set<string>());
  const seenPresentationIdsRef = useRef(new Set<string>());
  const noticeTimersRef = useRef(new Map<string, number>());

  useEffect(() => {
    if (!roomAccessError) return;
    onRoomUnavailable(roomAccessError === "expired" ? "That room expired after 24 hours." : "That room no longer exists.");
  }, [onRoomUnavailable, roomAccessError]);

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
  const panelCardNames = useMemo(() => [...new Set([...previewCardCatalog.map((card) => card.name), ...cardCatalog.map((card) => card.name), ...SHOP_CATALOG.filter((offer) => offer.card).map((offer) => offer.name)])], [previewCardCatalog, cardCatalog]);
  const localHand = localState?.hand.map((id) => cardCatalog.find((card) => card.id === id)).filter((card): card is ActionCard => Boolean(card)) ?? [];
  const runComplete = phase === "game" && Boolean(game?.ended);
  const pendingWorldEvent = game?.pendingWorldEvent ?? null;
  const worldEventBlocking = Boolean(pendingWorldEvent);
  const isLocalActiveTurn = phase === "game" && !runComplete && !worldEventBlocking && activePlayer?.id === sessionId && (localState?.hp ?? 0) > 0;
  const activeCard = useMemo(() => isLocalActiveTurn ? localHand.find((card) => card.id === selectedCard) : undefined, [isLocalActiveTurn, localHand, selectedCard]);
  const favorableOmenActive = hasFavorableOmen(localState);
  const activePityCost = activeCard ? getEffectiveCardPityCost(activeCard, localState) : 0;
  const activeCardCanBePlayed = activeCard ? canPayLioraVennHealthCost(activeCard, localState?.hp) : true;
  const activeCardBlockReason = activeCard && !activeCardCanBePlayed ? `Requires ${LIORA_VENN_MINIMUM_HP} HP` : "";
  const battleResultKey = runComplete ? `${game?.turnStartedAt ?? 0}-${game?.winnerTeam ?? "none"}-${game?.endReason ?? "ended"}` : "";
  const localBattleVerdict = game?.winnerTeam && localPlayer ? (game.winnerTeam === localPlayer.hero.team ? "victory" : "defeat") : "complete";
  const secondsLeft = game?.turnDeadline ? Math.max(0, Math.ceil((game.turnDeadline - (now + serverTimeOffsetMs)) / 1000)) : 0;
  const passiveDiceBonus = localPlayer && activeCard && localState ? getPassiveDiceBonus(localPlayer, activeCard, localState) + (["damage", "aoe"].includes(activeCard.effect) && localState.markedTargetId === targetPlayerId ? localState.markedTargetBonus ?? 0 : 0) : 0;
  const outcome = game?.outcome ?? null;
  const currentBattlePhase = getCurrentBattlePhase(game?.completedPhases ?? 0);
  const outcomePresentation = outcome ? formatOutcomePresentation(outcome, players, localPlayer?.id) : null;
  const localStatusPresentations = localPlayer && localState ? getStatusPresentations(localPlayer, localState, players, localPlayer.id, currentBattlePhase) : [];
  const outcomeKey = outcome ? outcome.id ?? `${game?.completedTurns ?? 0}-${outcome.kind}-${outcome.actorName ?? ""}-${outcome.cardId ?? ""}` : "";
  const queuedPresentation = presentationQueue[0];
  const queuedWorldEvent = queuedPresentation?.kind === "world" ? queuedPresentation.event : undefined;
  const activeLifeEvent = queuedPresentation?.kind === "life" ? queuedPresentation.lifeEvent : undefined;
  const activeLifePresentation = activeLifeEvent ? formatLifeEventPresentation(activeLifeEvent, players, localPlayer?.id) : null;
  const showRunComplete = queuedPresentation?.kind === "battle";
  const showNonWorldLifeEvent = Boolean(activeLifeEvent && activeLifeEvent.source !== "world-event");
  const showWorldLifeEvent = Boolean(activeLifeEvent?.source === "world-event");
  const showLifeEvent = showNonWorldLifeEvent || showWorldLifeEvent;
  const isLocalActionOutcome = Boolean(outcome && localPlayer && (outcome.actorId ? outcome.actorId === localPlayer.id : outcome.actorName === localPlayer.displayName) && (outcome.kind === "card" || outcome.kind === "discard" || outcome.kind === "skip"));
  const showOutcome = Boolean(isLocalActionOutcome && outcomeKey !== dismissedOutcomeKey);
  const showTurnSummary = Boolean(outcome?.actorName && !isLocalActionOutcome && outcomeKey !== dismissedSummaryKey);
  const showWorldEvent = Boolean(queuedWorldEvent && queuedWorldEvent.phase !== 3 && !worldEventBlocking);
  const inspectedPlayer = players.find((player) => player.id === inspectedPlayerId);
  const inspectedCard = [...cardCatalog, ...previewCardCatalog].find((card) => card.name === inspectedCardName);
  const reviewedCardIds = deckReview === "draw" ? localState?.drawPile ?? [] : deckReview === "discard" ? localState?.discardPile ?? [] : deckReview === "graveyard" ? localState?.graveyard ?? [] : [];
  const reviewedCards = reviewedCardIds.map((id) => cardCatalog.find((card) => card.id === id)).filter((card): card is ActionCard => Boolean(card));
  const manualPanelOpen = Boolean(deckReview) || Boolean(expandedPanel) || Boolean(inspectedPlayer) || Boolean(inspectedCard);
  const showPendingWorldEventChoice = Boolean(pendingWorldEvent && !manualPanelOpen && !showOutcome && !showTurnSummary && !showNonWorldLifeEvent);
  const activeAutoPanel = manualPanelOpen ? null : showOutcome ? "outcome" : showTurnSummary ? "summary" : showNonWorldLifeEvent ? "life" : worldEventBlocking ? null : showWorldEvent ? "world" : showWorldLifeEvent ? "life" : showRunComplete ? "battle" : null;
  const modalOpen = manualPanelOpen || Boolean(activeAutoPanel);
  const outcomeVfxTone = getOutcomeVfxTone(outcome);
  const modalAutoPanelVfx: { key: string; variant: AutoPanelVfxVariant } | null = activeAutoPanel === "outcome"
    ? { key: `outcome:${outcomeKey}`, variant: `action-${outcomeVfxTone}` }
    : activeAutoPanel === "summary"
      ? { key: `summary:${outcomeKey}`, variant: `summary-${outcomeVfxTone}` }
      : activeAutoPanel === "life" && activeLifeEvent
        ? { key: `life:${activeLifeEvent.id}`, variant: activeLifeEvent.kind === "revive" ? "life-revive" : "life-defeat" }
        : activeAutoPanel === "world" && queuedWorldEvent
          ? { key: `world:${queuedWorldEvent.id}`, variant: "world-resolved" }
          : activeAutoPanel === "battle"
            ? { key: `battle:${battleResultKey}`, variant: localBattleVerdict === "victory" ? "battle-victory" : localBattleVerdict === "defeat" ? "battle-defeat" : "battle-complete" }
            : null;
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
      shield: members.reduce((sum, player) => sum + (game?.playerStates[player.id]?.shield ?? 0) + (game?.playerStates[player.id]?.goldenShield ?? 0), 0),
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
    if (!players.length) return setSelectedPlayerId(null);
    if (!selectedPlayerId || !players.some((player) => player.id === selectedPlayerId)) setSelectedPlayerId(localPlayer?.id ?? null);
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
    const freshNotices = (outcome?.notices ?? []).filter((notice) => ["card-transform", "phase-start", "shop-use"].includes(notice.kind) && !seenNoticeIdsRef.current.has(notice.id));
    if (!freshNotices.length) return;
    freshNotices.forEach((notice) => seenNoticeIdsRef.current.add(notice.id));
    setVisibleNotices((current) => [...current, ...freshNotices]);
    freshNotices.forEach((notice) => {
      const timer = window.setTimeout(() => {
        setVisibleNotices((current) => current.filter((item) => item.id !== notice.id));
        noticeTimersRef.current.delete(notice.id);
      }, GAME_NOTICE_DURATION_MS);
      noticeTimersRef.current.set(notice.id, timer);
    });
  }, [outcome?.notices]);
  useEffect(() => () => {
    noticeTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    noticeTimersRef.current.clear();
  }, []);
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
    if (teamJoinSoundSequence > 0) playEffect("team-join");
  }, [teamJoinSoundSequence, playEffect]);
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
    if (status !== "connected" || !sessionId) return setLobbyError("Room still connecting.");
    if (localPlayer) return setLobbyError("This browser already controls one player.");
    if (players.length >= 10) return setLobbyError("The room already has 10 players.");
    if (!name) return setLobbyError("Enter a name first.");
    if (players.some((player) => player.displayName.toLowerCase() === name.toLowerCase())) return setLobbyError("Name already in use.");
    if (players.filter((player) => player.hero.team === team).length >= 5) return setLobbyError(`${team === "veil" ? "Veilbound" : "Embercourt"} already has five players.`);
    const pendingRandomHero = !selectedHeroName;
    const placeholderHeroName = pendingRandomHero ? characterOptions[0]?.hero.name : selectedHeroName;
    if (!placeholderHeroName) return setLobbyError("No character available.");
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
    if (!resolvedHeroName) return setLobbyError("No character available.");
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
    if (players.length < 2 || !players.every((player) => player.ready)) return setLobbyError("Every player must be ready.");
    if (!players.some((player) => player.hero.team === "veil") || !players.some((player) => player.hero.team === "ember")) return setLobbyError("Each team needs a player.");
    const battlePlayers = players.map((player) => {
      if (!player.randomHero) return player;
      const randomOption = characterOptions[Math.floor(Math.random() * characterOptions.length)];
      const assigned = createPlayerSession(player.displayName, player.hero.team === "veil" ? 0 : 1, randomOption.hero.name, player.id);
      return { ...assigned, ready: player.ready, joinedAt: player.joinedAt, randomHero: false, hero: { ...assigned.hero, team: player.hero.team } };
    });
    send({ type: "start", players: battlePlayers, game: createInitialGame(battlePlayers, createAdventure(), 30) });
  };
  const castDie = () => {
    if (rolling || !game || !activePlayer || activePlayer.id !== sessionId || !activeCard || !activeCardCanBePlayed || runComplete || worldEventBlocking || status !== "connected" || (activeState?.hp ?? 0) <= 0) return;
    playEffect("roll");
    setRolling(true); let ticks = 0;
    const timer = window.setInterval(() => { setAnimatedRoll(randomD20Roll()); ticks += 1; if (ticks >= 9) { window.clearInterval(timer); const finalRoll = randomD20Roll(); const alternateRoll = localState?.additionalDieActive || localState?.luckyDieActive ? randomD20Roll() : undefined; if (send({ type: "game:update", game: resolveCardTurn(game, players, activeCard.id, targetPlayerId, finalRoll, false, alternateRoll) })) playEffect("play"); setAnimatedRoll(finalRoll); setRolling(false); } }, 85);
  };
  const usePityRoll = () => {
    if (!game || !activePlayer || activePlayer.id !== sessionId || !activeCard || !activeCardCanBePlayed || runComplete || worldEventBlocking || status !== "connected" || rolling || (activeState?.hp ?? 0) <= 0 || (localState?.pityPoints ?? 0) < activePityCost) return;
    if (send({ type: "game:update", game: resolveCardTurn(game, players, activeCard.id, targetPlayerId, 0, true) })) playEffect("play");
  };
  const skipTurn = () => {
    if (!game || !activePlayer || activePlayer.id !== sessionId || runComplete || worldEventBlocking || status !== "connected" || (activeState?.hp ?? 0) <= 0) return;
    if (send({ type: "skip-turn", sessionId })) playEffect("skip");
  };
  const discardCard = () => {
    if (!game || !activePlayer || activePlayer.id !== sessionId || !activeCard || runComplete || worldEventBlocking || status !== "connected" || rolling || (activeState?.hp ?? 0) <= 0) return;
    if (send({ type: "discard-card", sessionId, cardId: activeCard.id })) playEffect("discard");
  };
  const buyShopOffer = (offerId: string) => { clearError(); send({ type: "shop:buy", sessionId, offerId }); };
  const exchangePityForGold = () => { clearError(); send({ type: "shop:exchange-pity", sessionId }); };
  const useInventoryItem = (itemId: string) => { clearError(); send({ type: "shop:use-item", sessionId, itemId }); };
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

  return <main className="game-shell arena-focus"><div className="grain"/>{visibleNotices.length > 0 && <section className="game-notice-stack" aria-live="polite" aria-label="Battle notices">{visibleNotices.map((notice) => <article className={`outcome-toast game-notice ${notice.kind}`} key={notice.id}><GameNoticeIcon kind={notice.kind}/><div><strong><GameNoticeTitle notice={notice} players={players} localPlayer={localPlayer}/></strong><span><HighlightPlayerNames text={notice.detail} players={players} localPlayer={localPlayer} useActualNames/></span></div></article>)}</section>}{showGuide && <DetailedGuide onClose={() => setShowGuide(false)}/>} {showPendingWorldEventChoice && pendingWorldEvent && <ShatteredTributeChoicePanel pendingEvent={pendingWorldEvent} players={players} localPlayer={localPlayer} localState={localState} handCards={localHand} cardNames={panelCardNames} serverTimeOffsetMs={serverTimeOffsetMs} connectionError={roomError} onInspectCard={inspectCard} onSubmit={submitWorldEventChoice}/>}
    <header className="topbar"><div className="brand"><div className="brand-mark"><Crown size={20}/></div><div><strong>SHATTERED OATH</strong><span>Two teams. One victor.</span></div></div>
      {phase === "game" ? <RunStatus completedPhases={game?.completedPhases ?? Math.max(0, (game?.roundNumber ?? 1) - 1)} secondsLeft={secondsLeft} worldEvents={game?.worldEventHistory ?? []} worldEventPlan={game?.worldEventPlan} pendingEvent={pendingWorldEvent} onOpenWorldEvents={() => setExpandedPanel("world-events")}/> : <div className="lobby-top-status"><Users size={16}/> {players.length}/10 players · {players.filter((player) => player.ready).length} ready</div>}
      <div className="top-actions"><div className="audio-controls"><button className={`icon-button music-toggle ${musicOn ? "playing" : ""}`} onClick={() => void toggleMusic()} aria-label={musicOn ? "Pause medieval music" : "Play medieval music"} title={musicOn ? "Pause medieval music" : "Play medieval music"}>{musicOn ? <Volume2 size={18}/> : <AudioLines size={18}/>}</button><label className="volume-control" title={`Audio volume ${volume}%`}><input type="range" min="0" max="100" value={volume} style={{ "--audio-volume": `${volume}%` } as React.CSSProperties} onChange={(event) => setVolume(Number(event.target.value))} aria-label="Game audio volume"/><output>{volume}%</output></label></div><button className="text-button" onClick={() => setShowGuide(true)}><CircleHelp size={16}/> How to play</button>{phase === "game" && localPlayer && <ConfirmedTopAction className="leave-game-control" icon={<LogOut size={16}/>} label="Leave battle" title="Leave this battle?" detail="Your player leaves the battle." onConfirm={() => send({ type: "leave-game", sessionId })}/>} {phase === "game" && localPlayer && !runComplete && <ConfirmedTopAction className="end-game-control" icon={<Octagon size={16}/>} label="End battle" title="End this battle?" detail="Current team totals decide the result." onConfirm={() => send({ type: "end-game", sessionId })}/>} {runComplete && !presentationQueue.some((item) => item.kind === "battle") && <button className="text-button" onClick={() => { if (battleResultKey) setPresentationQueue((current) => [...current, { id: `battle:reopen:${battleResultKey}`, kind: "battle", battleKey: battleResultKey }]); }}><Crown size={16}/> Battle result</button>}{phase === "game" && <button className="icon-button mobile-party-button" onClick={() => setMobileParty(true)} aria-label="Open player list"><Users size={18}/></button>}</div>
    </header>
    {phase === "lobby" ? <Lobby roomId={roomId} players={players} playerName={playerName} error={lobbyError || roomError} selectedPlayerId={selectedPlayerId} localSessionId={sessionId} connectionStatus={status} characterOptions={characterOptions} selectedHeroName={selectedHeroName} onNameChange={(name) => { setPlayerName(name); window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, name); setLobbyError(""); clearError(); }} onSlotSelect={selectLobbySlot} onSelectPlayer={setSelectedPlayerId} onToggleReady={toggleReady} onLeave={leaveLobby} onRemovePlayer={removePlayer} onEnterGame={enterGame} onHeroSelect={selectLobbyHero} onReturnHome={onReturnHome}/> :
      <div className="game-layout">{mobileParty && <button className="mobile-rail-backdrop" onClick={() => setMobileParty(false)} aria-label="Close player list"/>}<div className={mobileParty ? "mobile-rail open" : "mobile-rail"}><button className="mobile-close icon-button" onClick={() => setMobileParty(false)}><X size={17}/></button><PartyRail players={players} game={game} localSessionId={localPlayer ? sessionId : ""} onInspectPlayer={inspectPlayer}/></div><PartyRail players={players} game={game} localSessionId={localPlayer ? sessionId : ""} onInspectPlayer={inspectPlayer}/>
        <section className="world-stage combat-stage"><div className="realm-meta"><div><span className="eyebrow">TEAM BATTLE ARENA · UNLIMITED-PHASE MATCH</span><h1>Eliminate the opposing team</h1></div></div>
          <div className="encounter-row"><section className={`objective-card turn-status-banner ${isLocalActiveTurn ? "active" : "waiting"}`}><div className="objective-icon">{isLocalActiveTurn ? <Target size={22}/> : worldEventBlocking ? <Zap size={22}/> : <Hourglass className="waiting-hourglass" size={22}/>}</div><div><strong>{worldEventBlocking ? <>Resolving <span className="active-turn-word">{pendingWorldEvent?.title}</span>&hellip;</> : isLocalActiveTurn ? <>Here is <b className="active-turn-word">your</b> turn</> : activePlayer ? <>Waiting for <HighlightPlayerNames text={playerReference(activePlayer, localPlayer, { includeRelation: true })} players={players} localPlayer={localPlayer}/>&apos;s decision&hellip;</> : "Waiting for a player…"}</strong><p>{worldEventBlocking ? "Turns pause until choices arrive or time expires." : "Defeat the enemy team, or press End battle to settle the current result."}</p></div></section><DiceRoller roll={rolling ? animatedRoll : game?.roll ?? null} rolling={rolling} target={adventure.target} passiveBonus={visibleDiceModifier(passiveDiceBonus, activePlayer?.id, sessionId)} diceBuff={visibleDiceModifier((activeState?.diceBuff ?? 0) + (activeState?.shopDiceBonus ?? 0), activePlayer?.id, sessionId)} dicePenalty={visibleDiceModifier(activeState?.dicePenalty, activePlayer?.id, sessionId)} pityPoints={localState?.pityPoints ?? 0} pityCost={activePityCost} hasSelectedCard={Boolean(activeCard)} canPlaySelectedCard={activeCardCanBePlayed} selectedCardBlockReason={activeCardBlockReason} onRoll={castDie} onPity={usePityRoll} onSkip={skipTurn} onDiscard={discardCard} disabled={worldEventBlocking || activePlayer?.id !== sessionId || status !== "connected" || runComplete || (localState?.hp ?? 1) <= 0}/></div>
          <div className="battle-interaction-space">{activePlayer?.id === sessionId && activeCard && ["enemy", "ally", "defeated-ally", "player"].includes(activeCard.target) ? <section className="interaction-selector" aria-label="Choose interaction target"><div className="target-picker"><Target size={16}/><span>Choose {getCardTargetLabel(activeCard).toLowerCase()}</span>{targetOptions.length ? <TargetPlayerPicker options={targetOptions} selectedId={targetPlayerId} game={game} localPlayer={localPlayer} onChange={setTargetPlayerId}/> : <span className="no-valid-target">No valid target; success has no effect.</span>}</div></section> : null}</div>
          <section className="hand-zone private-hand-zone"><div className="hand-heading"><div><span className="eyebrow">{localPlayer ? "YOUR PRIVATE HAND" : "PRIVATE HAND"}</span><strong>{activePlayer?.id === sessionId ? "Choose a card and target, then roll." : "Plan while the current player acts."}</strong></div>{localPlayer && <div className="pile-review-actions"><span><Hand size={16}/> Hand ({localState?.hand.length ?? 0})</span><button onClick={() => setDeckReview("draw")}><Layers size={16}/> Draw pile ({localState?.drawPile.length ?? 0})</button><button onClick={() => setDeckReview("discard")}><Archive size={16}/> Discard ({localState?.discardPile.length ?? 0})</button><button onClick={() => setDeckReview("graveyard")}><Skull size={16}/> Graveyard ({localState?.graveyard?.length ?? 0})</button></div>}</div>
            {localState && <div className="active-effects-strip"><b>ACTIVE EFFECTS</b>{localStatusPresentations.map((status) => <span className={status.negative ? "effect-penalty" : status.kind === "attackBuff" || status.kind === "shopAttack" ? "effect-attack" : status.kind === "goldenShield" ? "effect-golden" : status.kind === "revive" ? "effect-heal" : "effect-support"} title={status.tooltip} key={status.kind}>{status.label.replace(/^Your /, "")} {status.displayValue}{status.duration && !status.displayValue.endsWith(status.duration) ? ` · ${status.duration}` : ""}</span>)}{!localStatusPresentations.length && <span>No active effects</span>}</div>}
            {localPlayer ? <div className="action-hand four-cards">{localHand.map((card) => {
              const playable = isLocalActiveTurn && status === "connected" && !rolling;
              const isSelected = isLocalActiveTurn && selectedCard === card.id;
              const healthRequirementMet = canPayLioraVennHealthCost(card, localState?.hp);
              return <button className={`action-card gothic-card effect-${card.effect} ${card.unique ? "hero-special-card" : "common-action-card"} ${card.effect === "none" ? "no-effect-card" : ""} ${isSelected ? "selected" : ""}`} aria-pressed={isSelected} title={!healthRequirementMet ? `Requires at least ${LIORA_VENN_MINIMUM_HP} HP to play; you can still discard it.` : undefined} style={{ "--hero-color": localPlayer.hero.color } as React.CSSProperties} key={card.id} onClick={() => setSelectedCard((current) => current === card.id ? "" : card.id)} disabled={!playable}><HandCardContents card={card} pityCostOverride={favorableOmenActive ? 0 : undefined}/></button>;
            })}</div> : <div className="private-hand-empty"><Eye size={20}/><strong>Join the battle to receive a private hand.</strong></div>}
          </section>
        </section>
        <aside className="rival-panel"><section className="turn-queue-card"><div className="panel-heading"><div><span className="eyebrow">TURN ORDER</span><strong>Current and next</strong></div><button className="panel-expand-button" onClick={() => setExpandedPanel("turns")} aria-label="Expand turn order"><ListOrdered size={17}/></button></div><TurnOrderList players={players} game={game} order={visibleTurnOrder} localPlayer={localPlayer} onInspect={inspectPlayer}/></section>
          <section className="rivalry"><div className="panel-heading"><div><span className="eyebrow">TEAM STATUS</span><strong>One team wins</strong></div><Shield size={17}/></div>{(["veil", "ember"] as TeamId[]).map((team) => { const data = team === "veil" ? veil : ember; return <article className={`faction-card ${team}`} key={team}><div className="faction-title"><div className="faction-seal">{team === "veil" ? <Eye size={18}/> : <Flame size={18}/>}</div><div><span>{teamName[team]}</span><strong>{data.hp}/{data.maxHp} total HP</strong></div></div><p>{data.alive}/{data.total} alive · {data.shield} shield</p><div className="influence-track"><i style={{ width: `${data.maxHp ? data.hp / data.maxHp * 100 : 0}%` }}/></div></article>; })}</section>
          <button className="panel-expand-button battle-history-button" onClick={() => setExpandedPanel("history")} aria-haspopup="dialog"><History size={17}/> BATTLE HISTORY</button>
          {localState && <button className="panel-expand-button shop-open-button" onClick={() => { clearError(); setExpandedPanel("shop"); }} aria-haspopup="dialog"><span className="shop-open-title"><ShoppingBag size={17}/> SHOP</span><span className="shop-open-gold"><Coins size={16}/> {formatGoldUnits(localState.goldUnits ?? 0)} GOLD</span></button>}
        </aside>
      </div>}
    {modalOpen && !showGuide && <div className={`modal-backdrop ${activeAutoPanel ? "auto-panel-backdrop" : ""}`} role={activeAutoPanel === "world" ? undefined : "dialog"} aria-modal={activeAutoPanel === "world" ? undefined : true} onClick={closeModal}>{modalAutoPanelVfx && <AutoPanelVfx key={modalAutoPanelVfx.key} variant={modalAutoPanelVfx.variant}/>}<section className={`modal-card ${showGuide ? "tutorial-modal" : ""} ${deckReview || expandedPanel || inspectedPlayer ? "wide-modal" : ""} ${(showOutcome || showTurnSummary || showLifeEvent || showWorldEvent) && !showGuide && !deckReview && !expandedPanel && !inspectedPlayer && !inspectedCard ? "resolution-card" : ""}`} onClick={(event) => event.stopPropagation()}>{activeAutoPanel !== "world" && <button className="modal-close icon-button" onClick={closeModal} aria-label="Close"><X size={18}/></button>}
      {showGuide ? <div className="tutorial-scroll"><span className="eyebrow">COMPLETE TUTORIAL</span><h2>How to win Shattered Oath</h2><p className="modal-lead">Defeat the enemy team, or press End battle to settle the current result.</p><section className="tutorial-section"><h3><Users size={20}/> Setup</h3><div className="tutorial-steps"><article><b>1</b><div><strong>Choose a class: each deck has 3 specials and 7 common cards.</strong></div></article><article><b>2</b><div><strong>Your card zones are private; avatars show public details.</strong></div></article></div></section><section className="tutorial-section"><h3><Dices size={20}/> Playing a turn</h3><div className="tutorial-steps"><article><b>1</b><div><strong>Play or discard a card to replace it; graveyard cards never return.</strong></div></article><article><b>2</b><div><strong>Meet the fresh 8–16 target with your modified d20.</strong></div></article><article><b>3</b><div><strong>Skip or time out to keep every card in place.</strong></div></article></div></section><section className="tutorial-section"><h3><Zap size={20}/> Special failures cause the listed backlash; common failures do nothing.</h3></section><section className="tutorial-section warning-section"><h3><Clock3 size={20}/> Turns last 60 seconds; timeout skips without changing cards.</h3></section></div> :
      deckReview ? <div className="expanded-panel-content"><span className="eyebrow">YOUR PRIVATE DECK</span><h2>{deckReview === "draw" ? "Draw pile" : deckReview === "discard" ? "Discard pile" : "Graveyard"}</h2><p className="modal-lead">{deckReview === "draw" ? "Available replacements; order is private." : deckReview === "discard" ? "Recycles into draw when draw is empty." : "Permanently unavailable this battle."}</p>{reviewedCards.length ? <div className="pile-card-grid">{reviewedCards.map((card, index) => <div className="pile-card-slot" key={`${card.id}-${index}`}><article className={`pile-review-card gothic-card effect-${card.effect} ${card.unique ? "special" : ""}`}><CardFace card={card} contextLabel={card.external ? undefined : `${index + 1} · ${getCardRarityLabel(card)}`}/></article></div>)}</div> : <div className="private-hand-empty"><Archive size={24}/><strong>This pile is empty.</strong></div>}</div> :
      expandedPanel === "history" ? <div className="expanded-panel-content"><span className="eyebrow">EXPANDED BATTLE HISTORY</span><h2>Every action and World Event</h2><HistoryEntries entries={game?.history ?? []} players={players} localPlayer={localPlayer} expanded onInspectPlayer={inspectPlayer} onInspectCard={inspectCard}/></div> :
      expandedPanel === "shop" && localState ? <ShopPanel state={localState} connected={status === "connected" && !runComplete} error={roomError} onBuy={buyShopOffer} onExchangePity={exchangePityForGold} onUseItem={useInventoryItem}/> :
      expandedPanel === "turns" ? <div className="expanded-panel-content"><span className="eyebrow">EXPANDED TURN ORDER</span><h2>Current and upcoming players</h2><TurnOrderList players={players} game={game} order={visibleTurnOrder} localPlayer={localPlayer} expanded onInspect={inspectPlayer}/></div> :
      expandedPanel === "world-events" ? <div className="expanded-panel-content world-event-reference-panel"><WorldEventLibrary cardNames={panelCardNames} onInspectCard={inspectCard}/></div> :
      inspectedPlayer ? inspectedView === "deck" ? <div className="character-deck-panel"><button className="deck-back-button" onClick={() => setInspectedView("status")}><ChevronLeft size={17}/> Back to character status</button><PublicDeck player={inspectedPlayer} localPlayer={localPlayer}/></div> : <div className="character-detail-modal"><CharacterAvatar hero={inspectedPlayer.hero} className="large-portrait" sizes="66px"/><span className="eyebrow"><b className={`player-name-highlight ${playerRelationClass(inspectedPlayer, localPlayer)}`}>{inspectedPlayer.displayName}</b> · {teamName[inspectedPlayer.hero.team]}</span><h2>{inspectedPlayer.hero.name}</h2><div className="character-detail-stats"><div><span>HP</span><strong>{game?.playerStates[inspectedPlayer.id]?.hp ?? inspectedPlayer.hero.hp}/{game?.playerStates[inspectedPlayer.id]?.maxHp ?? inspectedPlayer.hero.maxHp}</strong></div><div><span>Shield</span><strong>{game?.playerStates[inspectedPlayer.id]?.shield ?? 0}</strong></div><div><span>Speed</span><strong>{inspectedPlayer.hero.speed}</strong></div><div><span>Status</span><strong>{(game?.playerStates[inspectedPlayer.id]?.hp ?? inspectedPlayer.hero.hp) > 0 ? "Living" : "Defeated"}</strong></div></div><div className="passive-callout"><Crown size={18}/><div><span>PASSIVE · <b className="passive-name-highlight">{inspectedPlayer.hero.passiveName}</b></span><strong>{inspectedPlayer.hero.passiveText}</strong></div></div><button className="primary-button preview-character-deck-button" onClick={() => setInspectedView("deck")}><Layers size={17}/> Preview full 10-card deck</button></div> :
      inspectedCard ? <article className={`history-card-detail gothic-card effect-${inspectedCard.effect}`}><CardFace card={inspectedCard}/></article> :
      showOutcome && outcome && outcomePresentation ? outcome.kind === "discard" || outcome.kind === "skip" ? <LocalTurnActionPanel outcome={outcome} players={players} localPlayer={localPlayer} cardNames={panelCardNames} onInspectCard={inspectCard} onContinue={() => setDismissedOutcomeKey(outcomeKey)}/> : <div className="resolution-content"><div className={`resolution-hero ${outcome.success ? "success" : "failure"}`}>{outcome.success ? <Check size={34}/> : <Skull size={34}/>}</div><span className="eyebrow">{outcomePresentation.category}</span><h2><HighlightInteractiveNames text={outcomePresentation.title} cardNames={panelCardNames} players={players} localPlayer={localPlayer} onInspectCard={inspectCard}/></h2><div className="resolution-chips">{outcome.effect && <span>{outcome.effect}</span>}{outcome.targetName && <span>Target: <ViewpointPlayerText text={outcome.targetName} players={players} localPlayer={localPlayer} involvedPlayerIds={outcomePresentation.involvedPlayerIds}/></span>}</div>{outcome.resolution === "pity" ? <div className="resolution-pity"><PityIcon size={24}/><span><small>Guaranteed pity success</small><strong>{outcome.pityBefore ?? 0} − {outcome.pityCost ?? 0} = {outcome.pityAfter ?? 0} pity</strong></span></div> : outcome.pityCost === 0 ? <AutomaticSuccessNotice roll={outcome.roll}/> : <div className="resolution-equation"><span><small>d20 roll</small><strong>{outcome.roll ?? 0}</strong></span><i>+</i><span><small>total bonus</small><strong>{outcome.bonus ?? 0}</strong></span>{Boolean(outcome.dicePenalty) && <><i>−</i><span className="failure"><small>enemy penalty</small><strong>{outcome.dicePenalty}</strong></span></>}<i>=</i><span className={outcome.success ? "success" : "failure"}><small>your total</small><strong>{outcome.total}</strong></span><i className="compare-word">vs</i><span className="dice-target-result"><small>dice target</small><strong>{outcome.target}</strong></span></div>}<strong className={`resolution-verdict ${outcome.success ? "success" : "failure"}`}>{outcome.success ? "SUCCESS" : "FAILURE"}</strong><p className="modal-lead"><HighlightInteractiveNames text={outcomePresentation.detail} cardNames={panelCardNames} players={players} localPlayer={localPlayer} onInspectCard={inspectCard}/></p>{outcome.failureDetail && <p className="negative-card-effect"><Skull size={16}/> <ViewpointPlayerText text={outcome.failureDetail} players={players} localPlayer={localPlayer} involvedPlayerIds={outcomePresentation.involvedPlayerIds} emphasizedPlayerIds={outcome.actorId ? [outcome.actorId] : []} cardNames={panelCardNames} onInspectCard={inspectCard}/></p>}<div className="resolution-metrics single-metric"><div><span>Next random target</span><strong>{outcome.nextTarget ?? adventure.target}</strong></div></div><button className="primary-button continue-button" onClick={() => setDismissedOutcomeKey(outcomeKey)}>Continue <ChevronRight size={17}/></button></div> :
      showTurnSummary && outcome && outcomePresentation ? <div className={`resolution-content ${outcome.kind === "discard" ? "discard-summary-content" : ""}`}><div className={`resolution-hero ${outcome.kind === "discard" || outcome.kind === "skip" || outcome.kind === "timeout" || outcome.kind === "forced-skip" ? "world" : outcome.success ? "success" : "failure"}`}>{outcome.kind === "discard" ? <Archive size={34}/> : outcome.kind === "skip" || outcome.kind === "timeout" || outcome.kind === "forced-skip" ? <Hourglass size={34}/> : outcome.success ? <Check size={34}/> : <Skull size={34}/>}</div><span className="eyebrow">{outcomePresentation.category}</span><h2><HighlightInteractiveNames text={outcomePresentation.title} cardNames={panelCardNames} players={players} localPlayer={localPlayer} onInspectCard={inspectCard}/></h2>{outcome.resolution === "roll" && outcome.pityCost === 0 && <AutomaticSuccessNotice roll={outcome.roll}/>}<p className="modal-lead"><HighlightInteractiveNames text={outcomePresentation.detail} cardNames={panelCardNames} players={players} localPlayer={localPlayer} onInspectCard={inspectCard}/></p></div> :
      showWorldEvent && queuedWorldEvent ? <ResolvedWorldEventPanel event={queuedWorldEvent} players={players} localPlayerId={localPlayer?.id} cardNames={panelCardNames} onInspectCard={inspectCard} onClose={() => dismissPresentation()}/> :
      showLifeEvent && activeLifeEvent && activeLifePresentation ? <div className={`resolution-content life-event-content ${activeLifeEvent.kind}`}><div className={`resolution-hero ${activeLifeEvent.kind === "revive" ? "success" : "failure"}`}>{activeLifeEvent.kind === "revive" ? <Heart size={34}/> : <Skull size={34}/>}</div><span className="eyebrow">{activeLifePresentation.category}</span><h2><HighlightInteractiveNames text={activeLifePresentation.title} cardNames={panelCardNames} players={players} localPlayer={localPlayer} onInspectCard={inspectCard}/></h2><p className="modal-lead"><HighlightInteractiveNames text={activeLifePresentation.detail} cardNames={panelCardNames} players={players} localPlayer={localPlayer} onInspectCard={inspectCard}/></p><button className="primary-button continue-button" onClick={() => dismissPresentation()}>Continue <ChevronRight size={17}/></button></div> :
      showRunComplete ? <div className={`resolution-content battle-result-content ${localBattleVerdict}`}><div className={`resolution-hero ${localBattleVerdict === "victory" ? "success" : localBattleVerdict === "defeat" ? "failure" : "world"}`}>{localBattleVerdict === "defeat" ? <Skull size={34}/> : <Crown size={34}/>}</div><span className="eyebrow">BATTLE COMPLETE</span><h2>{localBattleVerdict === "victory" ? "Victory" : localBattleVerdict === "defeat" ? "Defeat" : game?.winnerTeam ? `${teamName[game.winnerTeam]} wins!` : "The battle was ended."}</h2><p className="modal-lead"><HighlightInteractiveNames text={localBattleVerdict === "victory" && localPlayer ? `${teamName[localPlayer.hero.team]} won the battle. ${game?.endReason ?? ""}` : localBattleVerdict === "defeat" && localPlayer && game?.winnerTeam ? `${teamName[game.winnerTeam]} defeated ${teamName[localPlayer.hero.team]}. ${game?.endReason ?? ""}` : game?.endReason ?? undefined} cardNames={panelCardNames} players={players} localPlayer={localPlayer} onInspectCard={inspectCard}/></p><div className="resolution-metrics"><div><span>Veilbound</span><strong>{veil.hp} HP</strong></div><div><span>Embercourt</span><strong>{ember.hp} HP</strong></div></div><button className="primary-button" onClick={() => send({ type: "return:lobby" })}><RefreshCw size={17}/> Return to lobby</button></div> : null}
    </section></div>}
  </main>;
}
