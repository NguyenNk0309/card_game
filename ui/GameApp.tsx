"use client";

import dynamic from "next/dynamic";
import { Archive, AudioLines, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Coins, Crown, Dices, Eye, Flame, Hand, Heart, History, Hourglass, Layers, ListOrdered, LogOut, Octagon, RefreshCw, Shield, ShoppingBag, Skull, Sparkles, Target, Users, Volume2, X, Zap } from "lucide-react";
import { AnimatePresence, LayoutGroup, Reorder, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createAdventure, createInitialGame, createPlayerSession, getCharacterOptions, getPassiveDiceBonus, randomD20Roll, resolveCardTurn } from "@/backend/game/engine";
import { getEffectiveCardPityCost, getCardTargetLabel, hasFavorableOmen } from "@/shared/cardRules";
import { canPayLioraVennHealthCost, LIORA_VENN_MINIMUM_HP } from "@/shared/lioraVenn.mjs";
import { getCurrentBattlePhase, getPhaseCountDenominator, getVisualizedCompletedPhases, PHASE_TIMELINE_LENGTH } from "@/shared/battlePhases.mjs";
import { visibleDiceModifier } from "@/shared/diceVisibility";
import { isValidRoomId, normalizeRoomId } from "@/shared/roomId.mjs";
import { getWorldEventDefinition, getWorldEventScheduleEntry, isWorldEventPhase } from "@/shared/worldEvents.mjs";
import { formatGoldUnits, getShopOffer, SHOP_CATALOG } from "@/shared/shop.mjs";
import { formatHistoryPresentation, formatLifeEventPresentation, formatOutcomePresentation, formatViewpointText, viewerRelation } from "@/shared/viewpoint.mjs";
import type { ActionCard, GameHistoryEntry, GameNotice, GameOutcome, PlayerLifeEvent, PlayerRunState, PlayerSession, SyncedGameState, TeamId, WorldEventOutcome } from "@/shared/types";
import { DiceRoller } from "./components/DiceRoller";
import type { D20DiceProps } from "./d20/D20Dice";
import { CardFace } from "./components/CardFace";
import { CharacterAvatar } from "./components/CharacterAvatar";
import { getCardEffectTone } from "./components/EffectText";
import { HighlightCardNames } from "./components/HighlightCardNames";
import { HighlightPlayerNames } from "./components/HighlightPlayerNames";
import { HomeScreen } from "./components/HomeScreen";
import { Lobby } from "./components/Lobby";
import { PartyRail } from "./components/PartyRail";
import { AutoPanelVfx, type AutoPanelVfxVariant } from "./components/AutoPanelVfx";
import { PityIcon } from "./components/PityCost";
import { ShopPanel } from "./components/ShopPanel";
import { ResolvedWorldEventPanel, ShatteredTributeChoicePanel, WorldEventLibrary } from "./components/WorldEventPanels";
import { useGameAudio } from "./hooks/useGameAudio";
import { useRoomSocket } from "./hooks/useRoomSocket";
import { preloadCardArtwork } from "./cardArtwork";
import { fadePresence, motionTransition, noticePresence, panelPresence, popPresence, screenPresence, subtleHover, subtleTap } from "./motion/presets";

const loadD20Dice = () => import("./d20/D20Dice");
const D20Dice = dynamic<D20DiceProps>(() => loadD20Dice().then((module) => module.D20Dice), { ssr: false });
const D20DebugPanel = process.env.TEST_MODE === "true"
  ? dynamic(() => import("./d20/D20DebugPanel").then((module) => module.D20DebugPanel), { ssr: false })
  : () => null;

const teamName: Record<TeamId, string> = { veil: "Veilbound", ember: "Embercourt" };
const PLAYER_NAME_STORAGE_KEY = "shattered-oath-player-name";
const GAME_NOTICE_DURATION_MS = 10_000;

function isCharacterPassiveActive(player: PlayerSession, state: PlayerRunState) {
  if (state.hp <= 0) return false;
  if (player.hero.name === "Thorne Vale") return Boolean(state.thorneDeadeyeCharge);
  if (player.hero.name === "Liora Venn") return Boolean(state.sanguineRecompense);
  if (player.hero.name === "Sable Fen") return !state.passiveReviveUsed;
  if (player.hero.name === "Kael Rook") return state.shield <= 0;
  if (player.hero.name === "Dagan Flint") return state.hp <= state.maxHp / 2;
  return true;
}
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

const HandCardContents = memo(function HandCardContents({ card, pityCostOverride }: { card: ActionCard; pityCostOverride?: number }) {
  return <CardFace card={card} pityCostOverride={pityCostOverride} previewTrigger="hover" imageLoading="eager" imagePriority="high"/>;
});

function HandCardItem({ card, selected, playable, blockedReason, heroColor, pityCostOverride, onSelect, onMove }: {
  card: ActionCard;
  selected: boolean;
  playable: boolean;
  blockedReason?: string;
  heroColor: string;
  pityCostOverride?: number;
  onSelect: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const lastDragEndRef = useRef(0);
  return <Reorder.Item
    as="div"
    value={card.id}
    className={`hand-card-slot ${selected ? "selected" : ""}`}
    layout="position"
    dragMomentum={false}
    dragElastic={0.08}
    tabIndex={0}
    aria-label={`${card.name}. Drag anywhere on the card, or use Left and Right arrow keys, to rearrange.`}
    onKeyDown={(event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      onMove(event.key === "ArrowLeft" ? -1 : 1);
    }}
    onDragEnd={() => { lastDragEndRef.current = Date.now(); }}
    onClickCapture={(event) => {
      if (Date.now() - lastDragEndRef.current >= 250) return;
      event.preventDefault();
      event.stopPropagation();
    }}
    initial={{ opacity: 0 }}
    whileDrag={{ y: -9, scale: 1.025, rotate: 0.6, zIndex: 25 }}
    whileHover={playable ? { y: selected ? -5 : -3, scale: selected ? 1.02 : 1.01 } : undefined}
    animate={{ opacity: 1, y: selected ? -5 : 0, scale: selected ? 1.02 : 1, rotate: 0 }}
    exit={{ opacity: 0 }}
    transition={{ ...motionTransition.hand, opacity: motionTransition.quick }}
    style={{ willChange: "transform" }}
  >
    <button
      className={`action-card gothic-card effect-${card.effect} ${card.unique ? "hero-special-card" : "common-action-card"} ${card.effect === "none" ? "no-effect-card" : ""} ${selected ? "selected" : ""}`}
      aria-pressed={selected}
      title={blockedReason}
      style={{ "--hero-color": heroColor } as React.CSSProperties}
      onClick={onSelect}
      disabled={!playable}
    ><HandCardContents card={card} pityCostOverride={pityCostOverride}/></button>
  </Reorder.Item>;
}

const BattleHand = memo(function BattleHand({ cards, selectedCard, selectionActive, playable, hp, heroColor, pityCostOverride, onSelect }: {
  cards: ActionCard[];
  selectedCard: string;
  selectionActive: boolean;
  playable: boolean;
  hp?: number;
  heroColor: string;
  pityCostOverride?: number;
  onSelect: (cardId: string) => void;
}) {
  const authoritativeHandKey = cards.map((card) => card.id).join("|");
  const [handOrder, setHandOrder] = useState<string[]>(() => cards.map((card) => card.id));
  const cardsById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);

  useEffect(() => {
    const authoritativeIds = authoritativeHandKey ? authoritativeHandKey.split("|") : [];
    setHandOrder((current) => {
      const reconciled = [...current.filter((id) => cardsById.has(id)), ...authoritativeIds.filter((id) => !current.includes(id))];
      return reconciled.length === current.length && reconciled.every((id, index) => id === current[index]) ? current : reconciled;
    });
  }, [authoritativeHandKey, cardsById]);

  const displayedCards = useMemo(() => {
    const ordered = handOrder.map((id) => cardsById.get(id)).filter((card): card is ActionCard => Boolean(card));
    return ordered.length === cards.length ? ordered : cards;
  }, [cards, cardsById, handOrder]);
  const moveCard = (cardId: string, direction: -1 | 1) => setHandOrder((current) => {
    const index = current.indexOf(cardId);
    const destination = index + direction;
    if (index < 0 || destination < 0 || destination >= current.length) return current;
    const next = [...current];
    [next[index], next[destination]] = [next[destination], next[index]];
    return next;
  });

  return <Reorder.Group as="div" axis="x" values={displayedCards.map((card) => card.id)} onReorder={setHandOrder} className="action-hand four-cards" aria-label="Private hand. Drag anywhere on a card to rearrange.">
    <AnimatePresence initial={false} mode="popLayout">{displayedCards.map((card) => {
      const isSelected = selectionActive && selectedCard === card.id;
      const healthRequirementMet = canPayLioraVennHealthCost(card, hp);
      return <HandCardItem
        card={card}
        selected={isSelected}
        playable={playable}
        blockedReason={!healthRequirementMet ? `Requires at least ${LIORA_VENN_MINIMUM_HP} HP to play; discarding remains available.` : undefined}
        heroColor={heroColor}
        pityCostOverride={pityCostOverride}
        onSelect={() => onSelect(card.id)}
        onMove={(direction) => moveCard(card.id, direction)}
        key={card.id}
      />;
    })}</AnimatePresence>
  </Reorder.Group>;
});

function PublicDeck({ player }: { player: PlayerSession }) {
  return <div className="public-character-deck"><div className="public-deck-heading"><div><strong>{player.hero.name} · {player.skillDeck.length} cards</strong></div></div><div>{player.skillDeck.map((card) => <article key={card.id} className={`public-deck-card gothic-card effect-${card.effect} ${card.unique ? "public-special-card" : ""}`} style={{ "--hero-color": player.hero.color } as React.CSSProperties}><CardFace card={card}/></article>)}</div></div>;
}

function DetailedGuide({ onClose }: { onClose: () => void }) {
  return <m.div className="guide-update-backdrop" onClick={onClose} variants={fadePresence} initial="hidden" animate="visible" exit="exit" transition={motionTransition.standard}>
    <m.section className="guide-update-panel" onClick={(event) => event.stopPropagation()} variants={panelPresence} initial="hidden" animate="visible" exit="exit" transition={motionTransition.panel}>
      <button className="modal-close icon-button" onClick={onClose} aria-label="Close"><X size={18}/></button>
      <h2>How to play Shattered Oath</h2>
      <div className="guide-update-grid">
        <article><strong>1 · Choose a character, or start with a random one.</strong></article>
        <article><strong>2 · HP keeps a character alive; Speed sets turn order.</strong></article>
        <article><strong>3 · Choose a card to roll or discard, or skip.</strong></article>
        <article><strong>4 · Meet the target with the modified d20 to succeed.</strong></article>
        <article><strong>5 · Failed rolls grant pity; spend the shown cost for guaranteed success.</strong></article>
        <article><strong>6 · World Events occur before phases 3, 7, 12, 17, 22, and 27.</strong></article>
        <article><strong>7 · Rolled actions earn Gold. Open Shop below Battle History at any time.</strong></article>
        <article><strong>8 · Potions activate when bought; Items activate when used from Inventory. Effects active before an action apply that turn.</strong></article>
        <article><strong>9 · External Cards enter the draw pile when bought.</strong></article>
        <article><strong>10 · Defeat the enemy team, or press End battle to settle the current result.</strong></article>
      </div>
    </m.section>
  </m.div>;
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
    <m.button className={`text-button ${className}`} onClick={() => { placeConfirmation(); setOpen(true); }} whileHover={subtleHover} whileTap={subtleTap}>{icon} {label}</m.button>
    {typeof document !== "undefined" && createPortal(<AnimatePresence>{open && <m.div className="turn-action-confirm top-action-confirm-popover" ref={confirmationRef} role="dialog" aria-label={title} style={popoverPosition} variants={popPresence} initial="hidden" animate="visible" exit="exit" transition={motionTransition.quick}>
        <strong>{title}</strong>
        <span>{detail}</span>
        <div>
          <button onClick={() => { setOpen(false); onConfirm(); }}><Check size={13}/> Confirm</button>
          <button onClick={() => setOpen(false)}><X size={13}/> Cancel</button>
        </div>
      </m.div>}</AnimatePresence>, document.body)}
  </div>;
}

function GameNoticeTitle({ notice, players, localPlayer }: { notice: GameNotice; players: PlayerSession[]; localPlayer?: PlayerSession }) {
  const actor = notice.actorId ? players.find((player) => player.id === notice.actorId) : undefined;
  const offer = notice.shopOfferId ? getShopOffer(notice.shopOfferId) : undefined;
  if (notice.kind !== "shop-use" || !actor || !offer) return <HighlightPlayerNames text={formatViewpointText(notice.title, players, notice.actorId ?? localPlayer?.id, { useActualNames: true })} players={players} localPlayer={localPlayer} useActualNames/>;
  return <><b className={`inline-player-name ${playerRelationClass(actor, localPlayer)}`}>{actor.displayName}</b> used <b className={`shop-notice-offer ${offer.category}`}>{offer.name}</b></>;
}

function HighlightInteractiveNames({ text = "", cardNames, players, localPlayer, onInspectCard, onInspectPlayer, useActualNames = true }: { text?: string; cardNames: readonly string[]; players: PlayerSession[]; localPlayer?: PlayerSession; onInspectCard?: (name: string) => void; onInspectPlayer?: (id: string) => void; useActualNames?: boolean }) {
  return <HighlightCardNames
    text={text}
    cardNames={cardNames}
    onInspectCard={onInspectCard}
    renderRemainder={(remainder) => <HighlightPlayerNames text={remainder} players={players} localPlayer={localPlayer} onInspect={onInspectPlayer} useActualNames={useActualNames}/>}
  />;
}

function ViewpointPlayerText({ text = "", players, localPlayer, involvedPlayerIds = [], emphasizedPlayerIds = [], onInspect, cardNames = [], onInspectCard, useActualNames = true }: { text?: string; players: PlayerSession[]; localPlayer?: PlayerSession; involvedPlayerIds?: string[]; emphasizedPlayerIds?: string[]; onInspect?: (id: string) => void; cardNames?: readonly string[]; onInspectCard?: (name: string) => void; useActualNames?: boolean }) {
  const formatted = formatViewpointText(text, players, localPlayer?.id, { involvedPlayerIds, emphasizedPlayerIds, useActualNames });
  return <HighlightInteractiveNames text={formatted} cardNames={cardNames} players={players} localPlayer={localPlayer} onInspectPlayer={onInspect} onInspectCard={onInspectCard} useActualNames={useActualNames}/>;
}

function signedOutcomeValue(value: number) {
  if (value === 0) return "0";
  return `${value > 0 ? "+" : "−"}${Math.abs(value)}`;
}

function OutcomeRollEquation({ outcome, players, localPlayer }: { outcome: GameOutcome; players: PlayerSession[]; localPlayer?: PlayerSession }) {
  if (outcome.resolution === "pity") return <div className="resolution-pity"><PityIcon size={24}/><span><small>Guaranteed pity success</small><strong>{outcome.pityBefore ?? 0} − {outcome.pityCost ?? 0} = {outcome.pityAfter ?? 0} pity</strong></span></div>;
  if (outcome.pityCost === 0) return <AutomaticSuccessNotice roll={outcome.roll}/>;
  if (outcome.resolution !== "roll") return null;

  const actor = players.find((player) => player.id === outcome.actorId) ?? players.find((player) => player.displayName === outcome.actorName);
  const totalModifier = (outcome.bonus ?? 0) - (outcome.dicePenalty ?? 0);
  const roll = outcome.roll ?? 0;

  return <div className="resolution-equation"><span><small>d20 roll</small><strong>{roll}</strong></span><i>+</i><span className="modifier-result"><small>total modifier</small><strong>{signedOutcomeValue(totalModifier)}</strong></span><i>=</i><span className={outcome.success ? "success" : "failure"}><small><HighlightPlayerNames text={`${outcome.actorName ?? actor?.displayName ?? "Player"}'s total`} players={players} localPlayer={localPlayer} useActualNames/></small><strong>{outcome.total}</strong></span><i className="compare-word">vs</i><span className="dice-target-result"><small>dice target</small><strong>{outcome.target}</strong></span></div>;
}

function conciseEffectSource(label: string) {
  const source = label.toLowerCase();
  if (source.includes("sacrificed shield") || source.includes("blocked by normal shield")) return "from Shield";
  if (source.includes("golden shield") || source.includes("potion") || source.includes("item")) return "from item";
  if (source.includes("attack buff")) return "from buff";
  if (source.includes("passive")) return "from passive";
  if (source.includes("maximum hp")) return "from max HP";
  if (source.includes("available shield")) return "from available Shield";
  if (source.includes("failure backlash")) return "from backlash";
  if (source.includes("card")) return "base";
  return label;
}

function withoutAutomaticGold(detail: string) {
  return detail.replace(/\s*Earned\s+\d+(?:\.\d+)?\s+Gold\.\s*/gi, " ").replace(/\s+/g, " ").trim();
}

function OutcomeEffectSummary({ outcome, fallbackDetail, players, localPlayer, cardNames, onInspectCard }: { outcome: GameOutcome; fallbackDetail: string; players: PlayerSession[]; localPlayer?: PlayerSession; cardNames: readonly string[]; onInspectCard: (name: string) => void }) {
  const breakdowns = (outcome.effectBreakdowns ?? []).filter((breakdown) => !breakdown.id.startsWith("gold-"));
  if (!breakdowns.length) {
    const detail = withoutAutomaticGold(fallbackDetail);
    return detail ? <p className="modal-lead resolution-outcome-detail"><HighlightInteractiveNames text={detail} cardNames={cardNames} players={players} localPlayer={localPlayer} onInspectCard={onInspectCard} useActualNames/></p> : null;
  }

  return <div className="outcome-effect-summary" aria-label="Effect value details">{breakdowns.map((breakdown) => {
    const isDamage = breakdown.id.startsWith("damage-") || breakdown.id.startsWith("failure-damage-");
    const label = isDamage ? breakdown.label.replace(/ lost$/, " took") : breakdown.label;
    const unit = isDamage ? "damage" : breakdown.unit;
    const context = `${breakdown.id} ${breakdown.label} ${breakdown.unit}`.toLowerCase();
    const tone = /support-healing/.test(context) ? "healing-support"
      : /(healing|revive|restored)/.test(context) ? "heal"
        : /dispel/.test(context) ? "dispel"
          : /marked/.test(context) ? "marked"
            : /attack-buff/.test(context) ? "attack"
              : /shield/.test(context) ? "shield"
                : /(damage|backlash)/.test(context) || breakdown.unit === "HP" ? "damage"
                  : /(d20|dice|roll|result)/.test(context) ? "dice"
                    : /(turn|speed|phase)/.test(context) ? "speed"
                      : /(card|deck|hand|draw|discard|graveyard|steal|stole|purge)/.test(context) ? "cards"
                        : outcome.effect === "support" ? "support"
                          : outcome.effect === "none" ? "none"
                            : "";
    return <p key={breakdown.id}><HighlightInteractiveNames text={label} cardNames={cardNames} players={players} localPlayer={localPlayer} onInspectCard={onInspectCard} useActualNames/> <b className={tone ? `effect-number ${tone}` : undefined}>{breakdown.value < 0 ? signedOutcomeValue(breakdown.value) : breakdown.value}</b> {unit}{breakdown.parts.length ? <> ({breakdown.parts.map((part, index) => {
      const partTone = tone === "dispel" ? tone : /shield/i.test(part.label) ? "shield" : tone;
      return <span key={`${breakdown.id}-${part.label}`}>{index === 0 ? (part.value < 0 ? "−" : "") : part.value < 0 ? " − " : " + "}<b className={partTone ? `effect-number ${partTone}` : undefined}>{Math.abs(part.value)}</b> {conciseEffectSource(part.label)}</span>;
    })})</> : null}.</p>;
  })}</div>;
}

function LocalTurnActionPanel({ outcome, players, localPlayer, cardNames, onInspectCard, onContinue }: { outcome: GameOutcome; players: PlayerSession[]; localPlayer?: PlayerSession; cardNames: readonly string[]; onInspectCard: (name: string) => void; onContinue: () => void }) {
  const discarded = outcome.kind === "discard";
  const presentation = formatOutcomePresentation(outcome, players, localPlayer?.id);
  return <div className={`resolution-content local-turn-action-content ${discarded ? "discard" : "skip"}`}><div className="resolution-hero world">{discarded ? <Archive size={34}/> : <Hourglass size={34}/>}</div><h2><HighlightInteractiveNames text={presentation.title} cardNames={cardNames} players={players} localPlayer={localPlayer} onInspectCard={onInspectCard} useActualNames/></h2><p className="modal-lead resolution-outcome-detail"><HighlightInteractiveNames text={presentation.detail} cardNames={cardNames} players={players} localPlayer={localPlayer} onInspectCard={onInspectCard} useActualNames/></p><button className="primary-button continue-button" onClick={onContinue}>Continue <ChevronRight size={17}/></button></div>;
}

function ActionOutcomePanel({ outcome, players, localPlayer, cardNames, onInspectCard }: { outcome: GameOutcome; players: PlayerSession[]; localPlayer?: PlayerSession; cardNames: readonly string[]; onInspectCard: (name: string) => void }) {
  const presentation = formatOutcomePresentation(outcome, players, localPlayer?.id);
  const separatesActionLabel = outcome.kind === "discard" || outcome.kind === "skip" || outcome.kind === "timeout";
  const neutralOutcome = outcome.kind === "discard" || outcome.kind === "skip" || outcome.kind === "timeout" || outcome.kind === "forced-skip";
  const title = <HighlightInteractiveNames text={presentation.title} cardNames={cardNames} players={players} localPlayer={localPlayer} onInspectCard={onInspectCard} useActualNames/>;

  return <div className={`resolution-content action-outcome-${outcome.kind} ${outcome.kind === "discard" ? "discard-action-outcome-content" : ""}`}>
    <div className={`resolution-hero ${neutralOutcome ? "world" : outcome.success ? "success" : "failure"}`}>{outcome.kind === "discard" ? <Archive size={34}/> : outcome.kind === "skip" || outcome.kind === "timeout" || outcome.kind === "forced-skip" ? <Hourglass size={34}/> : outcome.success ? <Check size={34}/> : <Skull size={34}/>}</div>
    <h2>{separatesActionLabel ? "Action Outcome" : <>Action Outcome · {title}</>}</h2>
    {separatesActionLabel && <p className="action-outcome-event">{title}</p>}
    {outcome.resolution === "roll" && outcome.pityCost === 0 && <AutomaticSuccessNotice roll={outcome.roll}/>}
    {presentation.detail && <p className="modal-lead resolution-outcome-detail"><HighlightInteractiveNames text={presentation.detail} cardNames={cardNames} players={players} localPlayer={localPlayer} onInspectCard={onInspectCard} useActualNames/></p>}
  </div>;
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
  return <LayoutGroup id={expanded ? "expanded-turn-order" : "compact-turn-order"}>
    <div className={`turn-queue-list ${expanded ? "expanded-turn-list turn-branch" : ""}`}>
      <AnimatePresence initial={false} mode="popLayout">
        {branchPlayers.map((player) => {
          const status = player.id === activeId ? "current" : acted.has(player.id) ? "passed" : "future";
          return <m.article layout="position" className={`turn-queue-item ${status}`} aria-label={`${status}: ${player.displayName}`} variants={popPresence} initial="hidden" animate="visible" exit="exit" transition={motionTransition.layout} key={player.id}>
            <button className="portrait-button" onClick={() => onInspect(player.id)} aria-label={`View ${player.displayName}'s character`}><CharacterAvatar hero={player.hero} className="portrait mini" sizes="28px"/></button>
            <div className="turn-player-copy"><strong className={`player-name-highlight ${playerRelationClass(player, localPlayer)}`}>{player.displayName}</strong><span className="turn-player-meta">{player.hero.name} · Speed {player.hero.speed} · {teamName[player.hero.team]} · {game?.playerStates[player.id]?.hp ?? player.hero.hp} HP</span></div>
            {expanded && <i className="turn-branch-node" aria-hidden="true"/>}
          </m.article>;
        })}
      </AnimatePresence>
    </div>
  </LayoutGroup>;
}

function TurnClock({ deadline, serverTimeOffsetMs, paused }: { deadline?: number; serverTimeOffsetMs: number; paused: boolean }) {
  const reducedMotion = Boolean(useReducedMotion());
  const getSecondsLeft = () => deadline ? Math.max(0, Math.ceil((deadline - (Date.now() + serverTimeOffsetMs)) / 1000)) : 0;
  const [secondsLeft, setSecondsLeft] = useState(getSecondsLeft);

  useEffect(() => {
    const updateClock = () => setSecondsLeft(getSecondsLeft());
    updateClock();
    if (!deadline || paused) return;
    const timer = window.setInterval(updateClock, 250);
    return () => window.clearInterval(timer);
  }, [deadline, paused, serverTimeOffsetMs]);

  return <m.div className={`turn-clock ${paused ? "event-paused" : secondsLeft <= 10 ? "urgent" : ""}`} animate={!paused && secondsLeft <= 10 && !reducedMotion ? { scale: [1, 1.045, 1], opacity: [1, .72, 1] } : { scale: 1, opacity: 1 }} transition={!paused && secondsLeft <= 10 && !reducedMotion ? { duration: .58, repeat: Infinity, ease: "easeInOut" } : motionTransition.quick}><Clock3 size={14}/> {paused ? "Event choice" : `${secondsLeft} seconds`}</m.div>;
}

function RunStatus({ completedPhases, turnDeadline, serverTimeOffsetMs, worldEvents, worldEventPlan, pendingEvent, onOpenWorldEvents }: { completedPhases: number; turnDeadline?: number; serverTimeOffsetMs: number; worldEvents: SyncedGameState["worldEventHistory"]; worldEventPlan?: SyncedGameState["worldEventPlan"]; pendingEvent?: SyncedGameState["pendingWorldEvent"]; onOpenWorldEvents: () => void }) {
  const reducedMotion = Boolean(useReducedMotion());
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
    const emphasizeEvent = eventPhase && (phaseClass === "current" || waiting) && !reducedMotion;
    return <m.i key={phase} data-turn={phase} title={eventPhase ? undefined : `Phase ${phase}`} tabIndex={eventPhase ? 0 : undefined} aria-label={eventPhase ? `Phase ${phase}, World Event${waiting ? ", waiting for choices" : ""}. ${eventDetail}` : `Phase ${phase}`} className={`${phaseClass} ${eventPhase ? "world-event-turn" : ""} ${resolvedEvent ? "event-triggered" : ""} ${waiting ? "event-pending" : ""}`} animate={emphasizeEvent ? { scale: [1, 1.32, 1], boxShadow: ["0 0 7px rgba(239,67,48,.68)", "0 0 18px rgba(255,82,61,1)", "0 0 7px rgba(239,67,48,.68)"] } : { scale: 1 }} transition={emphasizeEvent ? { duration: 1.05, repeat: Infinity, ease: "easeInOut" } : motionTransition.quick}>{eventPhase && <span className="phase-event-tooltip" role="tooltip"><span className="tooltip-arrow phase-tooltip-arrow" aria-hidden="true"/><b><Zap size={13}/> Phase {phase} World Event{waiting ? " · Waiting for choices" : ""}</b><small>{eventDetail}</small></span>}</m.i>;
  })}</div><TurnClock deadline={turnDeadline} serverTimeOffsetMs={serverTimeOffsetMs} paused={Boolean(pendingEvent)}/><m.button type="button" className="icon-button phase-world-events-button" onClick={onOpenWorldEvents} aria-label="View all World Events" title="View all World Events" whileHover={subtleHover} whileTap={subtleTap}><Zap size={17}/></m.button></nav>;
}

function TurnStatusBanner({ isLocalActiveTurn, worldEventBlocking, pendingTitle, activePlayer, players, localPlayer }: {
  isLocalActiveTurn: boolean;
  worldEventBlocking: boolean;
  pendingTitle?: string;
  activePlayer?: PlayerSession;
  players: PlayerSession[];
  localPlayer?: PlayerSession;
}) {
  const reducedMotion = Boolean(useReducedMotion());
  const stateKey = worldEventBlocking ? `world:${pendingTitle}` : isLocalActiveTurn ? "local-turn" : `waiting:${activePlayer?.id ?? "none"}`;
  return <m.section layout className={`objective-card turn-status-banner ${isLocalActiveTurn ? "active" : "waiting"}`} animate={{ scale: isLocalActiveTurn && !reducedMotion ? [1, 1.012, 1] : 1 }} transition={isLocalActiveTurn && !reducedMotion ? { duration: 0.42 } : motionTransition.standard}>
    <AnimatePresence initial={false} mode="wait">
      <m.div className="turn-status-content" key={stateKey} variants={popPresence} initial="hidden" animate="visible" exit="exit" transition={motionTransition.standard}>
        <div className="objective-icon">{isLocalActiveTurn ? <Target size={22}/> : worldEventBlocking ? <Zap size={22}/> : <m.span className="waiting-hourglass" animate={reducedMotion ? undefined : { rotate: 360 }} transition={reducedMotion ? undefined : { duration: 2.1, repeat: Infinity, ease: "linear" }}><Hourglass size={22}/></m.span>}</div>
        <div><strong>{worldEventBlocking ? <>Resolving <span className="active-turn-word">{pendingTitle}</span>&hellip;</> : isLocalActiveTurn && activePlayer ? <>It is <HighlightPlayerNames text={activePlayer.displayName} players={players} localPlayer={localPlayer} useActualNames/>&apos;s turn</> : activePlayer ? <>Waiting for <HighlightPlayerNames text={activePlayer.displayName} players={players} localPlayer={localPlayer} useActualNames/>&apos;s decision&hellip;</> : "Waiting for a player…"}</strong><p>{worldEventBlocking ? "Turns pause until choices arrive or time expires." : "Defeat the enemy team, or press End battle to settle the current result."}</p></div>
      </m.div>
    </AnimatePresence>
  </m.section>;
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
    <m.button type="button" className="target-dropdown-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} whileTap={subtleTap}>
      {selected ? <span className="target-option-copy"><strong className={`player-name-highlight ${playerRelationClass(selected, localPlayer)}`}>{selected.displayName}</strong><small>{playerMeta(selected)}</small></span> : <span>No target available</span>}
      <m.span animate={{ rotate: open ? 180 : 0 }} transition={motionTransition.quick}><ChevronDown size={17}/></m.span>
    </m.button>
    <AnimatePresence>{open && <m.div className="target-dropdown-options" role="listbox" aria-label="Choose target player" variants={popPresence} initial="hidden" animate="visible" exit="exit" transition={motionTransition.quick}>{options.map((player) => {
      const isSelected = player.id === selected?.id;
      return <m.button type="button" role="option" aria-selected={isSelected} className={`target-dropdown-option ${isSelected ? "selected" : ""}`} onClick={() => { onChange(player.id); setOpen(false); }} whileHover={{ x: 3 }} whileTap={subtleTap} key={player.id}><span className="target-option-copy"><strong className={`player-name-highlight ${playerRelationClass(player, localPlayer)}`}>{player.displayName}</strong><small>{playerMeta(player)}</small></span>{isSelected && <Check size={16}/>}</m.button>;
    })}</m.div>}</AnimatePresence>
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

  return <><AnimatePresence initial={false} mode="popLayout">
    {activeRoomId
      ? <m.div className="app-screen" key={`room:${activeRoomId}`} variants={screenPresence} initial="hidden" animate="visible" exit="exit" transition={motionTransition.standard}><RoomGame roomId={activeRoomId} onRoomUnavailable={returnHome} onReturnHome={() => returnHome()}/></m.div>
      : <m.div className="app-screen" key="home" variants={screenPresence} initial="hidden" animate="visible" exit="exit" transition={motionTransition.standard}><HomeScreen busy={homeBusy} error={homeError} onCreateRoom={createRoom} onJoinRoom={joinRoom}/></m.div>}
  </AnimatePresence><D20DebugPanel/></>;
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
  const [rollRequestPending, setRollRequestPending] = useState(false);
  const [completedDiceOutcomeKey, setCompletedDiceOutcomeKey] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const [dismissedOutcomeKey, setDismissedOutcomeKey] = useState("");
  const [dismissedActionOutcomeKey, setDismissedActionOutcomeKey] = useState("");
  const [presentationQueue, setPresentationQueue] = useState<PresentationQueueItem[]>([]);
  const [deckReview, setDeckReview] = useState<"draw" | "discard" | "graveyard" | null>(null);
  const [expandedPanel, setExpandedPanel] = useState<"history" | "turns" | "world-events" | "shop" | null>(null);
  const [inspectedPlayerId, setInspectedPlayerId] = useState<string | null>(null);
  const [inspectedCardName, setInspectedCardName] = useState<string | null>(null);
  const [inspectedView, setInspectedView] = useState<"status" | "deck">("status");
  const [visibleNotices, setVisibleNotices] = useState<GameNotice[]>([]);
  const expirySentRef = useRef(0);
  const outcomeSoundReadyRef = useRef(false);
  const lastOutcomeSoundKeyRef = useRef("");
  const lastBattleResultKeyRef = useRef("");
  const seenNoticeIdsRef = useRef(new Set<string>());
  const seenPresentationIdsRef = useRef(new Set<string>());
  const noticeTimersRef = useRef(new Map<string, number>());
  const rollRequestPendingRef = useRef(false);

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
  const cardCatalogById = useMemo(() => new Map(cardCatalog.map((card) => [card.id, card])), [cardCatalog]);
  const previewCardCatalog = useMemo(() => characterOptions.flatMap((option) => option.skillDeck), [characterOptions]);
  const panelCardNames = useMemo(() => [...new Set([...previewCardCatalog.map((card) => card.name), ...cardCatalog.map((card) => card.name), ...SHOP_CATALOG.filter((offer) => offer.card).map((offer) => offer.name)])], [previewCardCatalog, cardCatalog]);
  const authoritativeHandKey = localState?.hand.join("|") ?? "";
  const localHand = useMemo(() => (localState?.hand ?? []).map((id) => cardCatalogById.get(id)).filter((card): card is ActionCard => Boolean(card)), [authoritativeHandKey, cardCatalogById]);
  useEffect(() => {
    if (phase === "game" && localHand.length) preloadCardArtwork(localHand, "high");
  }, [phase, authoritativeHandKey, localHand]);
  useEffect(() => {
    if (!localPlayer || (phase === "lobby" && !localPlayer.ready)) return;
    const warmDice = () => { void loadD20Dice(); };
    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(warmDice, { timeout: 1200 });
      return () => window.cancelIdleCallback(idleId);
    }
    const timer = window.setTimeout(warmDice, 300);
    return () => window.clearTimeout(timer);
  }, [phase, localPlayer?.id, localPlayer?.ready]);
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
  const passiveDiceBonus = localPlayer && activeCard && localState ? getPassiveDiceBonus(localPlayer, activeCard, localState) : 0;
  const markedTargetDiceBonus = activeCard && localState && ["damage", "aoe"].includes(activeCard.effect) && localState.markedTargetId === targetPlayerId ? localState.markedTargetBonus ?? 0 : 0;
  const outcome = game?.outcome ?? null;
  const outcomePresentation = outcome ? formatOutcomePresentation(outcome, players, localPlayer?.id) : null;
  const localPassiveActive = localPlayer && localState ? isCharacterPassiveActive(localPlayer, localState) : false;
  const outcomeKey = outcome ? outcome.id ?? `${game?.completedTurns ?? 0}-${outcome.kind}-${outcome.actorName ?? ""}-${outcome.cardId ?? ""}` : "";
  const diceRollInput = outcome?.kind === "card" && outcome.resolution === "roll" && Number.isInteger(outcome.roll) && (outcome.roll ?? 0) >= 1 && (outcome.roll ?? 0) <= 20
    ? { rawResult: outcome.roll as number, modifier: (outcome.bonus ?? 0) - (outcome.dicePenalty ?? 0), finalResult: outcome.total }
    : null;
  const diceSequencePending = Boolean(diceRollInput && completedDiceOutcomeKey !== outcomeKey);
  const rolling = rollRequestPending || diceSequencePending;
  const displayedDiceTarget = diceSequencePending && outcome ? outcome.target : adventure.target;
  const queuedPresentation = presentationQueue[0];
  const queuedWorldEvent = queuedPresentation?.kind === "world" ? queuedPresentation.event : undefined;
  const activeLifeEvent = queuedPresentation?.kind === "life" ? queuedPresentation.lifeEvent : undefined;
  const activeLifePresentation = activeLifeEvent ? formatLifeEventPresentation(activeLifeEvent, players, localPlayer?.id) : null;
  const showRunComplete = queuedPresentation?.kind === "battle";
  const showNonWorldLifeEvent = Boolean(activeLifeEvent && activeLifeEvent.source !== "world-event");
  const showWorldLifeEvent = Boolean(activeLifeEvent?.source === "world-event");
  const showLifeEvent = showNonWorldLifeEvent || showWorldLifeEvent;
  const outcomeActorIsLocal = Boolean(outcome && localPlayer && (outcome.actorId ? outcome.actorId === localPlayer.id : outcome.actorName === localPlayer.displayName));
  const usesDetailedActionResult = Boolean(outcome && (outcome.kind === "card" || (outcomeActorIsLocal && (outcome.kind === "discard" || outcome.kind === "skip"))));
  const showOutcome = Boolean(usesDetailedActionResult && outcomeKey !== dismissedOutcomeKey);
  const showActionOutcome = Boolean(outcome?.actorName && !usesDetailedActionResult && outcomeKey !== dismissedActionOutcomeKey);
  const showWorldEvent = Boolean(queuedWorldEvent && queuedWorldEvent.phase !== 3 && !worldEventBlocking);
  const inspectedPlayer = players.find((player) => player.id === inspectedPlayerId);
  const inspectedCard = [...cardCatalog, ...previewCardCatalog].find((card) => card.name === inspectedCardName);
  const reviewedCardIds = deckReview === "draw" ? localState?.drawPile ?? [] : deckReview === "discard" ? localState?.discardPile ?? [] : deckReview === "graveyard" ? localState?.graveyard ?? [] : [];
  const reviewedCards = reviewedCardIds.map((id) => cardCatalogById.get(id)).filter((card): card is ActionCard => Boolean(card));
  const manualPanelOpen = Boolean(deckReview) || Boolean(expandedPanel) || Boolean(inspectedPlayer) || Boolean(inspectedCard);
  const showPendingWorldEventChoice = Boolean(!diceSequencePending && pendingWorldEvent && !manualPanelOpen && !showOutcome && !showActionOutcome && !showNonWorldLifeEvent);
  const activeAutoPanel = manualPanelOpen || diceSequencePending ? null : showOutcome ? "outcome" : showActionOutcome ? "action-outcome" : showNonWorldLifeEvent ? "life" : worldEventBlocking ? null : showWorldEvent ? "world" : showWorldLifeEvent ? "life" : showRunComplete ? "battle" : null;
  const modalOpen = manualPanelOpen || Boolean(activeAutoPanel);
  const outcomeVfxTone = getOutcomeVfxTone(outcome);
  const modalAutoPanelVfx: { key: string; variant: AutoPanelVfxVariant } | null = activeAutoPanel === "outcome"
    ? { key: `outcome:${outcomeKey}`, variant: `action-${outcomeVfxTone}` }
    : activeAutoPanel === "action-outcome"
      ? { key: `action-outcome:${outcomeKey}`, variant: `action-outcome-${outcomeVfxTone}` }
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
    rollRequestPendingRef.current = false;
    setRollRequestPending(false);
  }, [outcomeKey]);
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
  useEffect(() => {
    const deadline = game?.turnDeadline;
    if (phase !== "game" || game?.ended || worldEventBlocking || !deadline || expirySentRef.current === deadline) return;
    const expireTurn = () => {
      if (expirySentRef.current === deadline) return;
      expirySentRef.current = deadline;
      send({ type: "expire-turn" });
    };
    const delay = deadline - (Date.now() + serverTimeOffsetMs);
    if (delay <= 0) { expireTurn(); return; }
    const timer = window.setTimeout(expireTurn, delay + 50);
    return () => window.clearTimeout(timer);
  }, [phase, game?.ended, game?.turnDeadline, send, serverTimeOffsetMs, worldEventBlocking]);
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
      else if (activeAutoPanel === "action-outcome") setDismissedActionOutcomeKey(outcomeKey);
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
    if (diceSequencePending) return;
    if (!outcomeSoundReadyRef.current) {
      outcomeSoundReadyRef.current = true;
      lastOutcomeSoundKeyRef.current = outcomeKey;
      return;
    }
    if (!outcomeKey || lastOutcomeSoundKeyRef.current === outcomeKey) return;
    lastOutcomeSoundKeyRef.current = outcomeKey;
    if (outcome?.kind === "card") playEffect(outcome.success ? "roll-success" : "roll-fail");
  }, [diceSequencePending, outcomeKey, outcome?.kind, outcome?.success, playEffect]);
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
    if (rolling || rollRequestPendingRef.current || !game || !activePlayer || activePlayer.id !== sessionId || !activeCard || !activeCardCanBePlayed || runComplete || worldEventBlocking || status !== "connected" || (activeState?.hp ?? 0) <= 0) return;
    playEffect("roll");
    rollRequestPendingRef.current = true;
    setRollRequestPending(true);
    const rawRoll = randomD20Roll();
    const alternateRoll = localState?.additionalDieActive || localState?.luckyDieActive ? randomD20Roll() : undefined;
    if (!send({ type: "game:update", game: resolveCardTurn(game, players, activeCard.id, targetPlayerId, rawRoll, false, alternateRoll) })) {
      rollRequestPendingRef.current = false;
      setRollRequestPending(false);
    }
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
  const selectHandCard = useCallback((cardId: string) => setSelectedCard((current) => current === cardId ? "" : cardId), []);
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
    setInspectedCardName(null);
    setInspectedView("status");
    setInspectedPlayerId(playerId);
  };
  const inspectCard = (cardName: string) => {
    setDeckReview(null);
    setExpandedPanel(null);
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
    if (showActionOutcome) return setDismissedActionOutcomeKey(outcomeKey);
    if (showWorldEvent || showLifeEvent) return dismissPresentation();
    if (showRunComplete) send({ type: "return:lobby" });
  };

  return <main className="game-shell arena-focus"><div className="grain"/>
    <AnimatePresence>{visibleNotices.length > 0 && <m.section layout className="game-notice-stack" aria-live="polite" aria-label="Battle notices">{visibleNotices.map((notice) => <m.article layout className={`outcome-toast game-notice ${notice.kind}`} variants={noticePresence} initial="hidden" animate="visible" exit="exit" transition={motionTransition.standard} key={notice.id}><GameNoticeIcon kind={notice.kind}/><div><strong><GameNoticeTitle notice={notice} players={players} localPlayer={localPlayer}/></strong><span><HighlightPlayerNames text={formatViewpointText(notice.detail, players, notice.actorId ?? localPlayer?.id, { useActualNames: true })} players={players} localPlayer={localPlayer} useActualNames/></span></div></m.article>)}</m.section>}</AnimatePresence>
    <AnimatePresence>{showGuide && <DetailedGuide onClose={() => setShowGuide(false)}/>}</AnimatePresence>
    <AnimatePresence>{showPendingWorldEventChoice && pendingWorldEvent && <ShatteredTributeChoicePanel pendingEvent={pendingWorldEvent} players={players} localPlayer={localPlayer} localState={localState} handCards={localHand} cardNames={panelCardNames} serverTimeOffsetMs={serverTimeOffsetMs} connectionError={roomError} onInspectCard={inspectCard} onSubmit={submitWorldEventChoice}/>}</AnimatePresence>
    <header className="topbar"><div className="brand"><div className="brand-mark"><Crown size={20}/></div><div><strong>SHATTERED OATH</strong><span>Two teams. One victor.</span></div></div>
      {phase === "game" ? <RunStatus completedPhases={game?.completedPhases ?? Math.max(0, (game?.roundNumber ?? 1) - 1)} turnDeadline={game?.turnDeadline} serverTimeOffsetMs={serverTimeOffsetMs} worldEvents={game?.worldEventHistory ?? []} worldEventPlan={game?.worldEventPlan} pendingEvent={pendingWorldEvent} onOpenWorldEvents={() => setExpandedPanel("world-events")}/> : <div className="lobby-top-status"><Users size={16}/> {players.length}/10 players · {players.filter((player) => player.ready).length} ready</div>}
      <div className="top-actions"><div className="audio-controls"><button className={`icon-button music-toggle ${musicOn ? "playing" : ""}`} onClick={() => void toggleMusic()} aria-label={musicOn ? "Pause medieval music" : "Play medieval music"} title={musicOn ? "Pause medieval music" : "Play medieval music"}>{musicOn ? <Volume2 size={18}/> : <AudioLines size={18}/>}</button><label className="volume-control" title={`Audio volume ${volume}%`}><input type="range" min="0" max="100" value={volume} style={{ "--audio-volume": `${volume}%` } as React.CSSProperties} onChange={(event) => setVolume(Number(event.target.value))} aria-label="Game audio volume"/><output>{volume}%</output></label></div><button className="text-button" onClick={() => setShowGuide(true)}><CircleHelp size={16}/> How to play</button>{phase === "game" && localPlayer && <ConfirmedTopAction className="leave-game-control" icon={<LogOut size={16}/>} label="Leave battle" title="Leave this battle?" detail={`${localPlayer.displayName} leaves the battle.`} onConfirm={() => send({ type: "leave-game", sessionId })}/>} {phase === "game" && localPlayer && !runComplete && <ConfirmedTopAction className="end-game-control" icon={<Octagon size={16}/>} label="End battle" title="End this battle?" detail="Current team totals decide the result." onConfirm={() => send({ type: "end-game", sessionId })}/>} {runComplete && !presentationQueue.some((item) => item.kind === "battle") && <button className="text-button" onClick={() => { if (battleResultKey) setPresentationQueue((current) => [...current, { id: `battle:reopen:${battleResultKey}`, kind: "battle", battleKey: battleResultKey }]); }}><Crown size={16}/> Battle result</button>}</div>
    </header>
    <AnimatePresence initial={false} mode="sync">{phase === "lobby" ? <m.div className="room-phase-stage" key="lobby" variants={screenPresence} initial="hidden" animate="visible" exit="exit" transition={motionTransition.screen}><Lobby roomId={roomId} players={players} playerName={playerName} error={lobbyError || roomError} selectedPlayerId={selectedPlayerId} localSessionId={sessionId} connectionStatus={status} characterOptions={characterOptions} selectedHeroName={selectedHeroName} onNameChange={(name) => { setPlayerName(name); window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, name); setLobbyError(""); clearError(); }} onSlotSelect={selectLobbySlot} onSelectPlayer={setSelectedPlayerId} onToggleReady={toggleReady} onLeave={leaveLobby} onRemovePlayer={removePlayer} onEnterGame={enterGame} onHeroSelect={selectLobbyHero} onReturnHome={onReturnHome}/></m.div> :
      <m.div className="room-phase-stage" key="battle" variants={screenPresence} initial="hidden" animate="visible" exit="exit" transition={motionTransition.screen}><div className="game-layout"><PartyRail players={players} game={game} localSessionId={localPlayer ? sessionId : ""} onInspectPlayer={inspectPlayer}/>
        <section className="world-stage combat-stage"><div className="realm-meta"><div><h1>Eliminate the opposing team</h1></div></div>
          <div className="encounter-row"><TurnStatusBanner isLocalActiveTurn={isLocalActiveTurn} worldEventBlocking={worldEventBlocking} pendingTitle={pendingWorldEvent?.title} activePlayer={activePlayer} players={players} localPlayer={localPlayer}/><DiceRoller rolling={rolling} target={displayedDiceTarget} passiveBonus={visibleDiceModifier(passiveDiceBonus, activePlayer?.id, sessionId)} passiveName={activePlayer?.hero.passiveName} diceBuff={visibleDiceModifier(activeState?.diceBuff, activePlayer?.id, sessionId)} dicePenalty={visibleDiceModifier(activeState?.dicePenalty, activePlayer?.id, sessionId)} shopDiceBonus={visibleDiceModifier(activeState?.shopDiceBonus, activePlayer?.id, sessionId)} markedTargetBonus={visibleDiceModifier(markedTargetDiceBonus, activePlayer?.id, sessionId)} pityPoints={localState?.pityPoints ?? 0} pityCost={activePityCost} hasSelectedCard={Boolean(activeCard)} canPlaySelectedCard={activeCardCanBePlayed} selectedCardBlockReason={activeCardBlockReason} onRoll={castDie} onPity={usePityRoll} onSkip={skipTurn} onDiscard={discardCard} disabled={worldEventBlocking || activePlayer?.id !== sessionId || status !== "connected" || runComplete || (localState?.hp ?? 1) <= 0}/></div>
          <div className={`battle-interaction-space${diceSequencePending ? " dice-active" : ""}`}>
            {diceSequencePending && diceRollInput && <D20Dice
              key={outcomeKey}
              rollId={outcomeKey}
              {...diceRollInput}
              onRollComplete={() => setCompletedDiceOutcomeKey(outcomeKey)}
              onRollError={(error) => { console.error(error); setCompletedDiceOutcomeKey(outcomeKey); }}
            />}
            <AnimatePresence initial={false}>{!diceSequencePending && activePlayer?.id === sessionId && activeCard && ["enemy", "ally", "defeated-ally", "player"].includes(activeCard.target) ? <m.section className="interaction-selector" aria-label="Choose interaction target" variants={popPresence} initial="hidden" animate="visible" exit="exit" transition={motionTransition.standard} key={activeCard.id}><div className="target-picker"><Target size={16}/><span>Choose {getCardTargetLabel(activeCard).toLowerCase()}</span>{targetOptions.length ? <TargetPlayerPicker options={targetOptions} selectedId={targetPlayerId} game={game} localPlayer={localPlayer} onChange={setTargetPlayerId}/> : <span className="no-valid-target">No valid target; success has no effect.</span>}</div></m.section> : null}</AnimatePresence>
          </div>
          <section className="hand-zone private-hand-zone"><div className="hand-heading"><div><span className="eyebrow">{localPlayer ? <><span className={`player-name-highlight ${playerRelationClass(localPlayer, localPlayer)}`}>{localPlayer.displayName}</span>&apos;S PRIVATE HAND</> : "PRIVATE HAND"}</span><strong>{activePlayer?.id === sessionId ? "Choose a card and target, then roll. Drag any card to reorder." : "Plan while the current player acts. Drag any card to reorder."}</strong></div>{localPlayer && <div className="pile-review-actions"><span><Hand size={16}/> Hand ({localState?.hand.length ?? 0})</span><button onClick={() => setDeckReview("draw")}><Layers size={16}/> Draw pile ({localState?.drawPile.length ?? 0})</button><button onClick={() => setDeckReview("discard")}><Archive size={16}/> Discard ({localState?.discardPile.length ?? 0})</button><button onClick={() => setDeckReview("graveyard")}><Skull size={16}/> Graveyard ({localState?.graveyard?.length ?? 0})</button></div>}</div>
            {localPlayer && localState && <m.div layout className="active-passive-strip"><b>ACTIVE PASSIVE</b><m.span layout className={`active-passive-effect${localPassiveActive ? " is-active" : ""}`} title={`${localPlayer.hero.passiveName}: ${localPlayer.hero.passiveText}`} aria-label={`${localPlayer.hero.passiveName} passive ${localPassiveActive ? "active" : "inactive"}`} transition={motionTransition.standard}>{localPlayer.hero.passiveText}</m.span></m.div>}
            {localPlayer ? <BattleHand
              cards={localHand}
              selectedCard={selectedCard}
              selectionActive={isLocalActiveTurn}
              playable={isLocalActiveTurn && status === "connected" && !rolling}
              hp={localState?.hp}
              heroColor={localPlayer.hero.color}
              pityCostOverride={favorableOmenActive ? 0 : undefined}
              onSelect={selectHandCard}
            /> : <div className="private-hand-empty"><Eye size={20}/><strong>Join the battle to receive a private hand.</strong></div>}
          </section>
        </section>
        <aside className="rival-panel"><section className="turn-queue-card"><div className="panel-heading"><div><span className="eyebrow">TURN ORDER</span><strong>Current and next</strong></div><button className="panel-expand-button" onClick={() => setExpandedPanel("turns")} aria-label="Expand turn order"><ListOrdered size={17}/></button></div><TurnOrderList players={players} game={game} order={visibleTurnOrder} localPlayer={localPlayer} onInspect={inspectPlayer}/></section>
          <section className="rivalry"><div className="panel-heading"><div><span className="eyebrow">TEAM STATUS</span><strong>One team wins</strong></div><Shield size={17}/></div>{(["veil", "ember"] as TeamId[]).map((team) => { const data = team === "veil" ? veil : ember; return <m.article layout className={`faction-card ${team}`} key={team}><div className="faction-title"><div className="faction-seal">{team === "veil" ? <Eye size={18}/> : <Flame size={18}/>}</div><div><span>{teamName[team]}</span><AnimatePresence initial={false} mode="popLayout"><m.strong key={`${data.hp}:${data.maxHp}`} variants={popPresence} initial="hidden" animate="visible" exit="exit">{data.hp}/{data.maxHp} total HP</m.strong></AnimatePresence></div></div><p>{data.alive}/{data.total} alive · {data.shield} shield</p><div className="influence-track"><m.i initial={false} animate={{ scaleX: data.maxHp ? data.hp / data.maxHp : 0 }} transition={motionTransition.standard} style={{ transformOrigin: "left center" }}/></div></m.article>; })}</section>
          <button className="panel-expand-button battle-history-button" onClick={() => setExpandedPanel("history")} aria-haspopup="dialog"><History size={17}/> BATTLE HISTORY</button>
          {localState && <button className="panel-expand-button shop-open-button" onClick={() => { clearError(); setExpandedPanel("shop"); }} aria-haspopup="dialog"><span className="shop-open-title"><ShoppingBag size={17}/> SHOP</span><span className="shop-open-gold"><Coins size={16}/> {formatGoldUnits(localState.goldUnits ?? 0)} GOLD</span></button>}
        </aside>
      </div></m.div>}</AnimatePresence>
    <AnimatePresence initial={false} mode="wait">{modalOpen && !showGuide && <m.div className={`modal-backdrop ${activeAutoPanel ? "auto-panel-backdrop" : ""}`} role={activeAutoPanel === "world" ? undefined : "dialog"} aria-label={activeAutoPanel === "action-outcome" ? "Action Outcome" : undefined} aria-modal={activeAutoPanel === "world" ? undefined : true} onClick={closeModal} variants={fadePresence} initial="hidden" animate="visible" exit="exit" transition={motionTransition.standard}>{modalAutoPanelVfx && <AutoPanelVfx key={modalAutoPanelVfx.key} variant={modalAutoPanelVfx.variant}/>}<m.section key={deckReview ?? expandedPanel ?? inspectedPlayer?.id ?? inspectedCard?.id ?? activeAutoPanel ?? "modal"} className={`modal-card ${showGuide ? "tutorial-modal" : ""} ${deckReview || expandedPanel || inspectedPlayer ? "wide-modal" : ""} ${(showOutcome || showActionOutcome || showLifeEvent || showWorldEvent) && !showGuide && !deckReview && !expandedPanel && !inspectedPlayer && !inspectedCard ? "resolution-card" : ""}`} onClick={(event) => event.stopPropagation()} variants={panelPresence} initial="hidden" animate="visible" exit="exit" transition={activeAutoPanel === "battle" ? motionTransition.dramatic : motionTransition.panel}>{activeAutoPanel !== "world" && <button className="modal-close icon-button" onClick={closeModal} aria-label="Close"><X size={18}/></button>}
      {showGuide ? <div className="tutorial-scroll"><h2>How to win Shattered Oath</h2><p className="modal-lead">Defeat the enemy team, or press End battle to settle the current result.</p><section className="tutorial-section"><h3><Users size={20}/> Setup</h3><div className="tutorial-steps"><article><b>1</b><div><strong>Choose a class: each deck has 3 specials and 7 common cards.</strong></div></article><article><b>2</b><div><strong>Private card zones stay hidden; avatars show public details.</strong></div></article></div></section><section className="tutorial-section"><h3><Dices size={20}/> Playing a turn</h3><div className="tutorial-steps"><article><b>1</b><div><strong>Play or discard a card to replace it; graveyard cards never return.</strong></div></article><article><b>2</b><div><strong>Meet the fresh 8–16 target with the modified d20.</strong></div></article><article><b>3</b><div><strong>Skip or time out to keep every card in place.</strong></div></article></div></section><section className="tutorial-section"><h3><Zap size={20}/> Special failures cause the listed backlash; common failures do nothing.</h3></section><section className="tutorial-section warning-section"><h3><Clock3 size={20}/> Turns last 60 seconds; timeout skips without changing cards.</h3></section></div> :
      deckReview ? <div className="expanded-panel-content"><h2>{deckReview === "draw" ? "Draw pile" : deckReview === "discard" ? "Discard pile" : "Graveyard"}</h2><p className="modal-lead">{deckReview === "draw" ? "Available replacements; order is private." : deckReview === "discard" ? "Recycles into draw when draw is empty." : "Permanently unavailable this battle."}</p>{reviewedCards.length ? <div className="pile-card-grid">{reviewedCards.map((card, index) => <div className="pile-card-slot" key={`${card.id}-${index}`}><article className={`pile-review-card gothic-card effect-${card.effect} ${card.unique ? "special" : ""}`}><CardFace card={card}/></article></div>)}</div> : <div className="private-hand-empty"><Archive size={24}/><strong>This pile is empty.</strong></div>}</div> :
      expandedPanel === "history" ? <div className="expanded-panel-content"><h2>Every action and World Event</h2><HistoryEntries entries={game?.history ?? []} players={players} localPlayer={localPlayer} expanded onInspectPlayer={inspectPlayer} onInspectCard={inspectCard}/></div> :
      expandedPanel === "shop" && localState && localPlayer ? <ShopPanel player={localPlayer} state={localState} connected={status === "connected" && !runComplete} error={roomError} onBuy={buyShopOffer} onExchangePity={exchangePityForGold} onUseItem={useInventoryItem}/> :
      expandedPanel === "turns" ? <div className="expanded-panel-content"><h2>Current and upcoming players</h2><TurnOrderList players={players} game={game} order={visibleTurnOrder} localPlayer={localPlayer} expanded onInspect={inspectPlayer}/></div> :
      expandedPanel === "world-events" ? <div className="expanded-panel-content world-event-reference-panel"><WorldEventLibrary cardNames={panelCardNames} onInspectCard={inspectCard}/></div> :
      inspectedPlayer ? inspectedView === "deck" ? <div className="character-deck-panel"><button className="deck-back-button" onClick={() => setInspectedView("status")}><ChevronLeft size={17}/> Back to character status</button><PublicDeck player={inspectedPlayer}/></div> : <div className="character-detail-modal"><CharacterAvatar hero={inspectedPlayer.hero} className="large-portrait" sizes="66px"/><h2>{inspectedPlayer.hero.name}</h2><div className="character-detail-stats"><div><span>HP</span><strong>{game?.playerStates[inspectedPlayer.id]?.hp ?? inspectedPlayer.hero.hp}/{game?.playerStates[inspectedPlayer.id]?.maxHp ?? inspectedPlayer.hero.maxHp}</strong></div><div><span>Shield</span><strong>{game?.playerStates[inspectedPlayer.id]?.shield ?? 0}</strong></div><div><span>Speed</span><strong>{inspectedPlayer.hero.speed}</strong></div><div><span>Status</span><strong>{(game?.playerStates[inspectedPlayer.id]?.hp ?? inspectedPlayer.hero.hp) > 0 ? "Living" : "Defeated"}</strong></div></div><div className="passive-callout"><Crown size={18}/><div><span>PASSIVE · <b className="passive-name-highlight">{inspectedPlayer.hero.passiveName}</b></span><strong>{inspectedPlayer.hero.passiveText}</strong></div></div><button className="primary-button preview-character-deck-button" onClick={() => setInspectedView("deck")}><Layers size={17}/> Preview full 10-card deck</button></div> :
      inspectedCard ? <article className={`history-card-detail gothic-card effect-${inspectedCard.effect}`}><CardFace card={inspectedCard}/></article> :
      showOutcome && outcome && outcomePresentation ? outcome.kind === "discard" || outcome.kind === "skip" ? <LocalTurnActionPanel outcome={outcome} players={players} localPlayer={localPlayer} cardNames={panelCardNames} onInspectCard={inspectCard} onContinue={() => setDismissedOutcomeKey(outcomeKey)}/> : <div className="resolution-content"><div className={`resolution-hero ${outcome.success ? "success" : "failure"}`}>{outcome.success ? <Check size={34}/> : <Skull size={34}/>}</div><h2><HighlightInteractiveNames text={outcomePresentation.title} cardNames={panelCardNames} players={players} localPlayer={localPlayer} onInspectCard={inspectCard} useActualNames/></h2><div className="resolution-chips">{outcome.effect && <span className={`effect-${getCardEffectTone({ effect: outcome.effect, supportType: outcome.supportType })}`}>{outcome.effect}</span>}{outcome.targetName && <span>Target: <ViewpointPlayerText text={outcome.targetName} players={players} localPlayer={localPlayer} involvedPlayerIds={outcomePresentation.involvedPlayerIds} useActualNames/></span>}</div><OutcomeRollEquation outcome={outcome} players={players} localPlayer={localPlayer}/><strong className={`resolution-verdict ${outcome.success ? "success" : "failure"}`}>{outcome.success ? "SUCCESS" : "FAILURE"}</strong><OutcomeEffectSummary outcome={outcome} fallbackDetail={outcomePresentation.detail} players={players} localPlayer={localPlayer} cardNames={panelCardNames} onInspectCard={inspectCard}/><div className="resolution-metrics single-metric"><div><span>Next random target</span><strong>{outcome.nextTarget ?? adventure.target}</strong></div></div><button className="primary-button continue-button" onClick={() => setDismissedOutcomeKey(outcomeKey)}>Continue <ChevronRight size={17}/></button></div> :
      showActionOutcome && outcome ? <ActionOutcomePanel outcome={outcome} players={players} localPlayer={localPlayer} cardNames={panelCardNames} onInspectCard={inspectCard}/> :
      showWorldEvent && queuedWorldEvent ? <ResolvedWorldEventPanel event={queuedWorldEvent} players={players} localPlayerId={localPlayer?.id} cardNames={panelCardNames} onInspectCard={inspectCard} onClose={() => dismissPresentation()}/> :
      showLifeEvent && activeLifeEvent && activeLifePresentation ? <div className={`resolution-content life-event-content ${activeLifeEvent.kind}`}><div className={`resolution-hero ${activeLifeEvent.kind === "revive" ? "success" : "failure"}`}>{activeLifeEvent.kind === "revive" ? <Heart size={34}/> : <Skull size={34}/>}</div><h2><HighlightInteractiveNames text={activeLifePresentation.title} cardNames={panelCardNames} players={players} localPlayer={localPlayer} onInspectCard={inspectCard}/></h2><p className="modal-lead"><HighlightInteractiveNames text={activeLifePresentation.detail} cardNames={panelCardNames} players={players} localPlayer={localPlayer} onInspectCard={inspectCard}/></p><button className="primary-button continue-button" onClick={() => dismissPresentation()}>Continue <ChevronRight size={17}/></button></div> :
      showRunComplete ? <div className={`resolution-content battle-result-content ${localBattleVerdict}`}><div className={`resolution-hero ${localBattleVerdict === "victory" ? "success" : localBattleVerdict === "defeat" ? "failure" : "world"}`}>{localBattleVerdict === "defeat" ? <Skull size={34}/> : <Crown size={34}/>}</div><h2>{localBattleVerdict === "victory" ? "Victory" : localBattleVerdict === "defeat" ? "Defeat" : game?.winnerTeam ? `${teamName[game.winnerTeam]} wins!` : "The battle was ended."}</h2><p className="modal-lead"><HighlightInteractiveNames text={localBattleVerdict === "victory" && localPlayer ? `${teamName[localPlayer.hero.team]} won the battle. ${game?.endReason ?? ""}` : localBattleVerdict === "defeat" && localPlayer && game?.winnerTeam ? `${teamName[game.winnerTeam]} defeated ${teamName[localPlayer.hero.team]}. ${game?.endReason ?? ""}` : game?.endReason ?? undefined} cardNames={panelCardNames} players={players} localPlayer={localPlayer} onInspectCard={inspectCard}/></p><div className="resolution-metrics"><div><span>Veilbound</span><strong>{veil.hp} HP</strong></div><div><span>Embercourt</span><strong>{ember.hp} HP</strong></div></div><button className="primary-button" onClick={() => send({ type: "return:lobby" })}><RefreshCw size={17}/> Return to lobby</button></div> : null}
    </m.section></m.div>}</AnimatePresence>
  </main>;
}
