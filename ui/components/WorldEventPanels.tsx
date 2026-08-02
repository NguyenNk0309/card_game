"use client";

import { Archive, Check, ChevronRight, Clock3, Eye, LockKeyhole, Sparkles, X, Zap } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  WORLD_EVENT_SCHEDULE,
  getWorldEventDefinition,
  getWorldEventsForPhase,
} from "@/shared/worldEvents.mjs";
import { formatViewpointText } from "@/shared/viewpoint.mjs";
import type {
  ActionCard,
  PendingWorldEvent,
  PlayerRunState,
  PlayerSession,
  WorldEventOutcome,
} from "@/shared/types";
import { CardFace } from "./CardFace";
import { AutoPanelVfx } from "./AutoPanelVfx";
import { HighlightCardNames } from "./HighlightCardNames";

const DIALOG_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function containDialogFocus(event: ReactKeyboardEvent<HTMLElement>, dialog: HTMLElement | null) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (event.key !== "Tab" || !dialog) return;
  const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE_SELECTOR))
    .filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
  if (!focusable.length) {
    event.preventDefault();
    dialog.focus({ preventScroll: true });
    return;
  }
  const first = focusable[0];
  const last = focusable.at(-1)!;
  const active = document.activeElement;
  if (!dialog.contains(active) || (event.shiftKey && active === first) || (!event.shiftKey && active === last)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus({ preventScroll: true });
  }
}

function isSafeFocusTarget(element: HTMLElement | null): element is HTMLElement {
  if (!element?.isConnected || element.hidden) return false;
  if (element instanceof HTMLButtonElement || element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) return !element.disabled;
  return true;
}

function intensityClass(intensity: string) {
  return `intensity-${intensity.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function useEventCountdown(deadlineAt: number, serverTimeOffsetMs: number) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [deadlineAt]);

  return Math.max(0, Math.ceil((deadlineAt - (now + serverTimeOffsetMs)) / 1000));
}

export type WorldEventLibraryProps = {
  className?: string;
  cardNames?: readonly string[];
  onInspectCard?: (name: string) => void;
};

export function WorldEventLibrary({ className = "", cardNames = [], onInspectCard }: WorldEventLibraryProps) {
  const headingId = useId();

  return <section className={`world-event-library ${className}`.trim()} aria-labelledby={headingId}>
    <header className="world-event-library-heading">
      <span className="eyebrow"><Zap size={14}/> WORLD EVENT LIBRARY</span>
      <h2 id={headingId}>Six escalating event phases</h2>
      <p>Phases 3, 7, 12, 17, 22, and 27; phase 3 is fixed.</p>
    </header>
    <div className="world-event-library-groups">
      {WORLD_EVENT_SCHEDULE.map((schedule) => {
        const events = getWorldEventsForPhase(schedule.phase);
        return <section className={`world-event-library-group ${intensityClass(schedule.intensity)}`} data-world-event-phase={schedule.phase} key={schedule.phase}>
          <header>
            <div>
              <span>Phase {schedule.phase}</span>
              <strong>Level {schedule.level} · {schedule.intensity}</strong>
            </div>
            <b>{schedule.selection === "fixed" ? "Fixed" : "1 of 3"}</b>
          </header>
          <div className="world-event-library-events">
            {events.map((event) => <article className="world-event-library-event" data-event-key={event.key} key={event.key}>
              <div className="world-event-library-event-title">
                <Sparkles size={16}/>
                <div>
                  <span>{event.interactive ? "Player choice" : "Immediate"}</span>
                  <h3>{event.title}</h3>
                </div>
              </div>
              <p><HighlightCardNames text={event.fullDescription} cardNames={cardNames} onInspectCard={onInspectCard}/></p>
            </article>)}
          </div>
        </section>;
      })}
    </div>
  </section>;
}

type ChoiceCard = {
  id: string;
  slotKey: string;
  card?: ActionCard;
  zoneLabel: "Hand" | "Draw pile" | "Discard pile";
  borrowed: boolean;
  eligible: boolean;
};

export type ShatteredTributeChoicePanelProps = {
  pendingEvent: PendingWorldEvent;
  players: PlayerSession[];
  localPlayer?: PlayerSession;
  localState?: PlayerRunState;
  /** Card definitions for the local hand, including borrowed cards when present. */
  handCards?: ActionCard[];
  cardNames?: readonly string[];
  serverTimeOffsetMs?: number;
  connectionError?: string;
  onInspectCard?: (name: string) => void;
  onSubmit: (eventId: string, selectedCardIds: string[]) => boolean | void | Promise<boolean | void>;
};

export function ShatteredTributeChoicePanel({
  pendingEvent,
  players,
  localPlayer,
  localState,
  handCards = [],
  cardNames = [],
  serverTimeOffsetMs = 0,
  connectionError = "",
  onInspectCard,
  onSubmit,
}: ShatteredTributeChoicePanelProps) {
  const titleId = useId();
  const descriptionId = useId();
  const progressId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const firstEligibleRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const waitingRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [awaitingAcknowledgement, setAwaitingAcknowledgement] = useState(false);
  const secondsLeft = useEventCountdown(pendingEvent.deadlineAt, serverTimeOffsetMs);
  const definition = getWorldEventDefinition(pendingEvent.eventKey);
  const fullRule = definition?.fullDescription ?? pendingEvent.fullDescription ?? pendingEvent.description;
  const requiredIds = pendingEvent.requiredPlayerIds ?? [];
  const submittedIds = pendingEvent.submittedPlayerIds ?? [];
  const autoResolvedIds = pendingEvent.autoResolvedPlayerIds ?? [];
  const isRequired = Boolean(localPlayer && requiredIds.includes(localPlayer.id));
  const isAuthoritativelySubmitted = Boolean(localPlayer && submittedIds.includes(localPlayer.id));
  const isWaiting = isAuthoritativelySubmitted || awaitingAcknowledgement;

  const choiceCards = useMemo<ChoiceCard[]>(() => {
    if (!localPlayer || !localState) return [];
    const suppliedCards = new Map(handCards.map((card) => [card.id, card]));
    const ownedCards = new Map(localPlayer.skillDeck.map((card) => [card.id, card]));
    const zones = [
      { zone: "hand" as const, zoneLabel: "Hand" as const, cardIds: localState.hand },
      { zone: "drawPile" as const, zoneLabel: "Draw pile" as const, cardIds: localState.drawPile },
      { zone: "discardPile" as const, zoneLabel: "Discard pile" as const, cardIds: localState.discardPile },
    ];
    const borrowedCountById = (localState.borrowedCards ?? []).reduce((counts, entry) => {
      counts.set(entry.cardId, (counts.get(entry.cardId) ?? 0) + 1);
      return counts;
    }, new Map<string, number>());
    const borrowedSlots = new Set<string>();
    for (const { zone, cardIds } of zones) {
      for (let index = cardIds.length - 1; index >= 0; index -= 1) {
        const cardId = cardIds[index];
        const remaining = borrowedCountById.get(cardId) ?? 0;
        if (!remaining) continue;
        borrowedSlots.add(`${zone}:${index}`);
        borrowedCountById.set(cardId, remaining - 1);
      }
    }
    return zones.flatMap(({ zone, zoneLabel, cardIds }) => cardIds.map((id, index) => {
      const ownedCard = ownedCards.get(id);
      const owned = Boolean(ownedCard);
      const borrowed = borrowedSlots.has(`${zone}:${index}`) || !owned;
      const card = borrowed ? suppliedCards.get(id) ?? ownedCard : ownedCard ?? suppliedCards.get(id);
      return {
        id,
        slotKey: `${zone}:${id}:${index}`,
        card,
        zoneLabel,
        borrowed,
        eligible: owned && !borrowed && !ownedCard?.unique,
      };
    })).filter((entry) => !entry.card?.unique);
  }, [handCards, localPlayer, localState]);

  const eligibleCards = choiceCards.filter((entry) => entry.eligible);
  const requiredSelectionCount = Math.min(2, eligibleCards.length);
  const firstEligibleSlotKey = eligibleCards[0]?.slotKey;
  const canSubmit = isRequired
    && !isWaiting
    && selectedIds.length === requiredSelectionCount
    && secondsLeft > 0;

  useEffect(() => {
    setSelectedIds([]);
    setAwaitingAcknowledgement(false);
  }, [pendingEvent.id, localPlayer?.id]);

  useEffect(() => {
    if (isAuthoritativelySubmitted) setAwaitingAcknowledgement(false);
  }, [isAuthoritativelySubmitted]);

  useEffect(() => {
    if (connectionError && !isAuthoritativelySubmitted) setAwaitingAcknowledgement(false);
  }, [connectionError, isAuthoritativelySubmitted]);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      window.requestAnimationFrame(() => {
        const restoreTarget = isSafeFocusTarget(restoreFocusRef.current)
          ? restoreFocusRef.current
          : document.querySelector<HTMLElement>(".game-shell button:not([disabled])");
        if (isSafeFocusTarget(restoreTarget)) restoreTarget.focus({ preventScroll: true });
      });
    };
  }, [pendingEvent.id]);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      const selectableTarget = firstEligibleRef.current
        ?? (confirmRef.current && !confirmRef.current.disabled ? confirmRef.current : null);
      const focusTarget = isRequired && !isWaiting
        ? selectableTarget ?? dialogRef.current
        : waitingRef.current ?? dialogRef.current;
      focusTarget?.focus({ preventScroll: true });
    });
  }, [isRequired, isWaiting, pendingEvent.id]);

  const toggleCard = (cardId: string) => {
    setSelectedIds((current) => {
      if (current.includes(cardId)) return current.filter((id) => id !== cardId);
      if (current.length >= requiredSelectionCount) return current;
      return [...current, cardId];
    });
  };

  const submitChoice = async () => {
    if (!canSubmit) return;
    setAwaitingAcknowledgement(true);
    try {
      const accepted = await onSubmit(pendingEvent.id, selectedIds);
      if (accepted === false) setAwaitingAcknowledgement(false);
    } catch {
      setAwaitingAcknowledgement(false);
    }
  };

  const submittedCount = submittedIds.length;

  return <div className="world-event-choice-backdrop auto-panel-backdrop" data-world-event-id={pendingEvent.id}>
    <AutoPanelVfx key={pendingEvent.id} variant="world-pending"/>
    <section
      className={`world-event-choice-panel ${intensityClass(pendingEvent.intensity)}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={`${descriptionId} ${progressId}`}
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={(event) => containDialogFocus(event, dialogRef.current)}
    >
      <header className="world-event-choice-heading">
        <div className="resolution-hero world"><Archive size={30}/></div>
        <div>
          <span className="eyebrow">WORLD EVENT · PHASE {pendingEvent.phase} · LEVEL {pendingEvent.level}</span>
          <h2 id={titleId}>{pendingEvent.title}</h2>
          <span className={`world-event-intensity ${intensityClass(pendingEvent.intensity)}`}>{pendingEvent.intensity}</span>
        </div>
        <time className="world-event-choice-clock" dateTime={`PT${secondsLeft}S`} aria-label={`${secondsLeft} seconds remaining`}>
          <Clock3 size={17}/> {formatCountdown(secondsLeft)}
        </time>
      </header>

      <p className="world-event-rule" id={descriptionId}><HighlightCardNames text={fullRule} cardNames={cardNames} onInspectCard={onInspectCard}/></p>

      <div className="world-event-submission-progress" id={progressId} role="status" aria-live="polite" aria-atomic="true">
        <span>{submittedCount} of {requiredIds.length} required players submitted</span>
        <div className="world-event-progress-track" aria-hidden="true"><i style={{ width: `${requiredIds.length ? submittedCount / requiredIds.length * 100 : 100}%` }}/></div>
      </div>

      <ul className="world-event-player-statuses" aria-label="Player submission status">
        {requiredIds.map((playerId) => {
          const player = players.find((candidate) => candidate.id === playerId);
          const autoResolved = autoResolvedIds.includes(playerId);
          const submitted = submittedIds.includes(playerId);
          const status = autoResolved ? "Auto-resolved" : submitted ? "Submitted" : "Waiting";
          return <li className={autoResolved ? "auto-resolved" : submitted ? "submitted" : "waiting"} key={playerId}>
            <span>{playerId === localPlayer?.id ? "You" : player?.displayName ?? "Player no longer in battle"}</span>
            <strong>{status}</strong>
          </li>;
        })}
      </ul>

      {isRequired && !isWaiting ? <div className="world-event-choice-controls">
        <div className="world-event-choice-instructions">
          <div>
            <Eye size={17}/>
            <span><strong>Your private cards</strong><small>Choose owned common cards from hand, draw, or discard.</small></span>
          </div>
          <b>Selected {selectedIds.length} of {requiredSelectionCount}</b>
        </div>

        <div className="world-event-choice-card-grid" role="group" aria-label={`Choose exactly ${requiredSelectionCount} owned common cards from hand, draw pile, or discard pile`}>
          {choiceCards.map((entry) => {
            const selected = entry.eligible && selectedIds.includes(entry.id);
            const selectionFull = selectedIds.length >= requiredSelectionCount && !selected;
            const cardLabel = entry.borrowed
              ? "Borrowed card; unavailable"
              : `${entry.card?.name ?? "Owned common card"}, ${entry.zoneLabel}, ${selected ? "selected" : "not selected"}`;
            return <button
              type="button"
              className={`world-event-choice-card action-card ${entry.card ? `gothic-card effect-${entry.card.effect}` : ""} common-action-card ${selected ? "selected" : ""} ${entry.borrowed ? "borrowed" : ""}`.trim()}
              aria-label={cardLabel}
              aria-pressed={entry.eligible ? selected : undefined}
              ref={entry.slotKey === firstEligibleSlotKey ? firstEligibleRef : undefined}
              disabled={!entry.eligible || selectionFull}
              onClick={() => toggleCard(entry.id)}
              key={entry.slotKey}
            >
              {entry.card ? <CardFace card={entry.card} contextLabel={<>{entry.borrowed
                ? <><LockKeyhole/> Borrowed · unavailable</>
                : selected ? <><Check/> Selected</> : `${entry.zoneLabel} · Available`}</>}/> : <>
                <div className="card-sigil"><LockKeyhole size={18}/></div>
                <strong>Borrowed card</strong>
              </>}
            </button>;
          })}
          {!eligibleCards.length && <p className="world-event-no-choice-cards">No eligible owned common cards.</p>}
        </div>

        {connectionError && <p className="world-event-choice-error" role="alert">{connectionError}</p>}

        <button type="button" className="primary-button world-event-confirm-choice" ref={confirmRef} disabled={!canSubmit} onClick={() => void submitChoice()}>
          Confirm {requiredSelectionCount} {requiredSelectionCount === 1 ? "card" : "cards"} <ChevronRight size={17}/>
        </button>
      </div> : <div className="world-event-choice-waiting" ref={waitingRef} role="status" aria-live="polite" tabIndex={-1}>
        {isRequired
          ? <><Check size={24}/><strong>Choice submitted</strong><p>Waiting for others; choices stay private.</p></>
          : <><LockKeyhole size={24}/><strong>No choice needed</strong><p>Waiting for required players.</p></>}
      </div>}
    </section>
  </div>;
}

export type ResolvedWorldEventPanelProps = {
  event: WorldEventOutcome;
  players: PlayerSession[];
  localPlayerId?: string;
  cardNames?: readonly string[];
  className?: string;
  onInspectCard?: (name: string) => void;
  onClose: () => void;
};

export function ResolvedWorldEventPanel({
  event,
  players,
  localPlayerId,
  cardNames = [],
  className = "",
  onInspectCard,
  onClose,
}: ResolvedWorldEventPanelProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const definition = getWorldEventDefinition(event.eventKey);
  const fullRule = definition?.fullDescription ?? event.fullDescription ?? event.description;
  const localResult = localPlayerId ? event.results.find((result) => result.playerId === localPlayerId) : undefined;

  useEffect(() => {
    window.requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
  }, [event.id]);

  return <div
    className={`resolution-content world-event-resolution ${intensityClass(event.intensity)} ${className}`.trim()}
    data-world-event-id={event.id}
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    aria-describedby={descriptionId}
    ref={panelRef}
    tabIndex={-1}
    onKeyDown={(keyEvent) => containDialogFocus(keyEvent, panelRef.current)}
  >
    <button type="button" className="modal-close icon-button" onClick={onClose} aria-label="Close"><X size={18}/></button>
    <div className="resolution-hero world"><Zap size={34}/></div>
    <span className="eyebrow">WORLD EVENT · PHASE {event.phase} · LEVEL {event.level}</span>
    <h2 id={titleId}>{event.title}</h2>
    <span className={`world-event-intensity ${intensityClass(event.intensity)}`}>{event.intensity}</span>
    <p className="modal-lead world-event-rule" id={descriptionId}><HighlightCardNames text={fullRule} cardNames={cardNames} onInspectCard={onInspectCard}/></p>

    {localResult && <section className="world-event-private-result" aria-label="Your private World Event result">
      <span><LockKeyhole size={15}/> YOUR PRIVATE RESULT</span>
      <strong><HighlightCardNames text={formatViewpointText(localResult.privateSummary || localResult.publicSummary, players, localPlayerId, { involvedPlayerIds: [localResult.playerId] })} cardNames={cardNames} onInspectCard={onInspectCard}/></strong>
      {localResult.autoResolved && <small>Auto-resolved at the deadline.</small>}
    </section>}

  </div>;
}
