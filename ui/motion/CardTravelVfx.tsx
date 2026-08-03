"use client";

import { Archive, Hand, Layers, Repeat2, Skull, Sparkles } from "lucide-react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { useEffect } from "react";
import type { ActionCard } from "@/shared/types";
import { CardEffectIcon } from "../components/CardEffectIcon";
import { motionEase } from "./presets";

export type CardTravelKind = "deal" | "draw" | "discard" | "graveyard" | "borrow" | "lent" | "return" | "restore" | "recycle" | "acquire";

export type CardTravelEvent = {
  id: string;
  card: ActionCard;
  kind: CardTravelKind;
};

const labels: Record<CardTravelKind, string> = {
  deal: "Opening hand",
  draw: "Drawn",
  discard: "Discarded",
  graveyard: "Moved to graveyard",
  borrow: "Borrowed",
  lent: "Borrowed by another player",
  return: "Returned to owner",
  restore: "Restored from graveyard",
  recycle: "Discard pile reshuffled",
  acquire: "Added to deck",
};

function TravelIcon({ kind }: { kind: CardTravelKind }) {
  if (kind === "discard") return <Archive/>;
  if (kind === "graveyard") return <Skull/>;
  if (kind === "borrow" || kind === "lent" || kind === "return") return <Repeat2/>;
  if (kind === "recycle") return <Layers/>;
  if (kind === "deal" || kind === "draw") return <Hand/>;
  return <Sparkles/>;
}

const travelFrames = (kind: CardTravelKind, reduced: boolean) => {
  if (reduced) return {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  };
  switch (kind) {
    case "deal":
      return { initial: { opacity: 0, x: -210, y: 90, rotate: -12, scale: 0.72 }, animate: { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }, exit: { opacity: 0, y: 110, scale: 0.86 } };
    case "draw":
      return { initial: { opacity: 0, x: -260, y: 45, rotate: -16, scale: 0.68 }, animate: { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }, exit: { opacity: 0, y: 115, scale: 0.88 } };
    case "discard":
      return { initial: { opacity: 0, y: 85, scale: 0.82 }, animate: { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }, exit: { opacity: 0, x: 270, y: 105, rotate: 18, scale: 0.7 } };
    case "graveyard":
      return { initial: { opacity: 0, y: -80, scale: 1.08 }, animate: { opacity: 1, y: 0, rotate: 0, scale: 1, filter: "grayscale(0)" }, exit: { opacity: 0, y: 155, rotate: -10, scale: 0.54, filter: "grayscale(1)" } };
    case "borrow":
      return { initial: { opacity: 0, x: 300, rotate: 18, scale: 0.72 }, animate: { opacity: 1, x: [300, -18, 0], rotate: [18, -3, 0], scale: 1 }, exit: { opacity: 0, y: 110, scale: 0.86 } };
    case "lent":
      return { initial: { opacity: 0, y: 80, scale: 0.82 }, animate: { opacity: 1, x: 0, y: 0, scale: 1 }, exit: { opacity: 0, x: -310, rotate: -18, scale: 0.68 } };
    case "return":
      return { initial: { opacity: 0, x: -290, rotate: -16, scale: 0.7 }, animate: { opacity: 1, x: [ -290, 18, 0 ], rotate: [-16, 3, 0], scale: 1 }, exit: { opacity: 0, x: 150, y: 80, scale: 0.76 } };
    case "restore":
      return { initial: { opacity: 0, y: 150, scale: 0.55, filter: "grayscale(1)" }, animate: { opacity: 1, y: 0, scale: 1, filter: "grayscale(0)" }, exit: { opacity: 0, y: -70, scale: 0.82 } };
    case "recycle":
      return { initial: { opacity: 0, scale: 0.68, rotate: -160 }, animate: { opacity: 1, scale: 1, rotate: 0 }, exit: { opacity: 0, x: -190, rotate: 90, scale: 0.7 } };
    default:
      return { initial: { opacity: 0, y: -100, scale: 0.72 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 100, scale: 0.78 } };
  }
};

function CardTravelItem({ event, index, onComplete }: { event: CardTravelEvent; index: number; onComplete: (id: string) => void }) {
  const reduced = Boolean(useReducedMotion());
  const frames = travelFrames(event.kind, reduced);
  useEffect(() => {
    const timer = window.setTimeout(() => onComplete(event.id), reduced ? 650 : 1150 + index * 90);
    return () => window.clearTimeout(timer);
  }, [event.id, index, onComplete, reduced]);
  return <m.article
    className={`card-travel-vfx card-travel-${event.kind} effect-${event.card.effect}`}
    initial={frames.initial}
    animate={frames.animate}
    exit={frames.exit}
    transition={{ duration: reduced ? 0.16 : 0.48, ease: motionEase, delay: reduced ? 0 : index * 0.07 }}
    aria-hidden="true"
  >
    <span className="card-travel-icon"><TravelIcon kind={event.kind}/></span>
    <span className="card-travel-effect"><CardEffectIcon card={event.card}/></span>
    <strong>{event.card.name}</strong>
    <small>{labels[event.kind]}</small>
  </m.article>;
}

export function CardTravelVfx({ events, onComplete }: { events: CardTravelEvent[]; onComplete: (id: string) => void }) {
  return <div className="card-travel-layer" aria-hidden="true">
    <AnimatePresence>
      {events.map((event, index) => <CardTravelItem event={event} index={index} onComplete={onComplete} key={event.id}/>)}
    </AnimatePresence>
  </div>;
}
