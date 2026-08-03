"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ActionCard, PlayerRunState, SyncedGameState } from "@/shared/types";
import type { CardTravelEvent, CardTravelKind } from "../motion/CardTravelVfx";

type CardSnapshot = {
  zones: Record<"hand" | "drawPile" | "discardPile" | "graveyard", string[]>;
  borrowed: string[];
  lent: string[];
};

const snapshotOf = (game: SyncedGameState, sessionId: string, state: PlayerRunState): CardSnapshot => ({
  zones: {
    hand: [...state.hand],
    drawPile: [...state.drawPile],
    discardPile: [...state.discardPile],
    graveyard: [...state.graveyard],
  },
  borrowed: (state.borrowedCards ?? []).map((entry) => entry.cardId),
  lent: Object.entries(game.playerStates).flatMap(([playerId, playerState]) => playerId === sessionId
    ? []
    : (playerState.borrowedCards ?? []).filter((entry) => entry.ownerId === sessionId).map((entry) => entry.cardId)),
});

const zoneOf = (snapshot: CardSnapshot, cardId: string) => (Object.keys(snapshot.zones) as Array<keyof CardSnapshot["zones"]>)
  .find((zone) => snapshot.zones[zone].includes(cardId));

export function useCardTravel({ game, localState, sessionId, cards }: {
  game: SyncedGameState | null;
  localState?: PlayerRunState;
  sessionId: string;
  cards: ActionCard[];
}) {
  const [events, setEvents] = useState<CardTravelEvent[]>([]);
  const previousRef = useRef<CardSnapshot | null>(null);
  const sequenceRef = useRef(0);
  const cardMap = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const signature = game && localState ? JSON.stringify({
    hand: localState.hand,
    drawPile: localState.drawPile,
    discardPile: localState.discardPile,
    graveyard: localState.graveyard,
    borrowed: localState.borrowedCards,
    lent: Object.entries(game.playerStates).map(([id, state]) => [id, state.borrowedCards]),
  }) : "";

  useEffect(() => {
    if (!game || !localState || !sessionId) {
      previousRef.current = null;
      setEvents([]);
      return;
    }
    const current = snapshotOf(game, sessionId, localState);
    const previous = previousRef.current;
    previousRef.current = current;
    const next: CardTravelEvent[] = [];
    const emitted = new Set<string>();
    const emit = (cardId: string, kind: CardTravelKind) => {
      const card = cardMap.get(cardId);
      const key = `${kind}:${cardId}`;
      if (!card || emitted.has(key)) return;
      emitted.add(key);
      sequenceRef.current += 1;
      next.push({ id: `${game.completedTurns}:${sequenceRef.current}:${key}`, card, kind });
    };

    if (!previous) {
      if (game.completedTurns === 0) current.zones.hand.forEach((cardId) => emit(cardId, "deal"));
      if (next.length) setEvents(next.slice(0, 6));
      return;
    }

    const newBorrowed = current.borrowed.filter((cardId) => !previous.borrowed.includes(cardId));
    const returnedBorrowed = previous.borrowed.filter((cardId) => !current.borrowed.includes(cardId));
    const newLent = current.lent.filter((cardId) => !previous.lent.includes(cardId));
    const returnedLent = previous.lent.filter((cardId) => !current.lent.includes(cardId));
    newBorrowed.forEach((cardId) => emit(cardId, "borrow"));
    returnedBorrowed.forEach((cardId) => emit(cardId, "return"));
    newLent.forEach((cardId) => emit(cardId, "lent"));
    returnedLent.forEach((cardId) => emit(cardId, "return"));

    const allIds = new Set([
      ...Object.values(previous.zones).flat(),
      ...Object.values(current.zones).flat(),
    ]);
    allIds.forEach((cardId) => {
      const from = zoneOf(previous, cardId);
      const to = zoneOf(current, cardId);
      if (from === to || newBorrowed.includes(cardId) || returnedBorrowed.includes(cardId) || newLent.includes(cardId) || returnedLent.includes(cardId)) return;
      if (to === "graveyard") emit(cardId, "graveyard");
      else if (from === "graveyard") emit(cardId, "restore");
      else if (to === "hand" && from === "drawPile") emit(cardId, "draw");
      else if (to === "hand" && from === "discardPile") emit(cardId, "recycle");
      else if (from === "hand" && to === "discardPile") emit(cardId, "discard");
      else if (from === "discardPile" && to === "drawPile") emit(cardId, "recycle");
      else if (!from && to) emit(cardId, "acquire");
    });

    if (next.length) setEvents((currentEvents) => [...currentEvents, ...next].slice(-8));
  }, [cardMap, game, localState, sessionId, signature]);

  const complete = useCallback((id: string) => setEvents((current) => current.filter((event) => event.id !== id)), []);
  return { events, complete };
}
