"use client";

import { Crown } from "lucide-react";
import type { RefObject } from "react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getCardEffectLabel, getCardPityCost } from "@/shared/cardRules";
import type { ActionCard } from "@/shared/types";
import type { CardArtwork } from "../cardArtwork";
import type { CardResultRow } from "./CardFace";
import { CardEffectIcon } from "./CardEffectIcon";
import { EffectText } from "./EffectText";
import { PityIcon } from "./PityCost";
import { fitCardTooltipToViewport } from "./tooltipPosition";

type Props = {
  anchorRef: RefObject<HTMLDivElement | null>;
  artwork: CardArtwork;
  card: ActionCard;
  pityCostOverride?: number;
  rows: CardResultRow[];
};

type PreviewPosition = {
  left: number;
  placement: "top" | "right";
  ready: boolean;
  top: number;
};

const hiddenPosition: PreviewPosition = { left: -10000, placement: "top", ready: false, top: -10000 };

export function CardHoverPreview({ anchorRef, artwork, card, pityCostOverride, rows }: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PreviewPosition>(hiddenPosition);
  const tooltipRef = useRef<HTMLElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    const anchor = anchorRef.current?.closest<HTMLElement>(".gothic-card");
    if (!anchor) return;
    const show = () => {
      setPosition(hiddenPosition);
      setOpen(true);
    };
    const hide = () => setOpen(false);
    anchor.addEventListener("mouseenter", show);
    anchor.addEventListener("mouseleave", hide);
    return () => {
      anchor.removeEventListener("mouseenter", show);
      anchor.removeEventListener("mouseleave", hide);
    };
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!open) return;
    const placePreview = () => {
      const anchor = anchorRef.current?.closest<HTMLElement>(".gothic-card");
      const tooltip = tooltipRef.current?.getBoundingClientRect();
      if (!anchor || !tooltip) return;
      const placement = anchor.classList.contains("history-card-detail") ? "right" : "top";
      const next = fitCardTooltipToViewport(
        anchor.getBoundingClientRect(),
        tooltip,
        { width: window.innerWidth, height: window.innerHeight },
        placement
      );
      setPosition({ ...next, placement, ready: true });
    };
    placePreview();
    window.addEventListener("resize", placePreview);
    window.addEventListener("scroll", placePreview, true);
    return () => {
      window.removeEventListener("resize", placePreview);
      window.removeEventListener("scroll", placePreview, true);
    };
  }, [anchorRef, open]);

  const portalRoot = open && typeof document !== "undefined" ? document.body : null;
  if (!open || !portalRoot) return null;
  const pityCost = pityCostOverride ?? getCardPityCost(card);

  return createPortal(<aside
    ref={tooltipRef}
    id={tooltipId}
    className={`card-hover-tooltip effect-${card.effect} placement-${position.placement}`}
    role="tooltip"
    aria-label={`${card.name} full card details`}
    style={{ left: position.left, top: position.top, visibility: position.ready ? "visible" : "hidden" }}
  >
    <div
      className="card-hover-tooltip-art"
      style={artwork.scene ? { backgroundImage: `url("${artwork.scene}")` } : undefined}
      aria-hidden="true"
    />
    <div className="card-hover-tooltip-content">
      <header>
        <span className={`card-hover-tooltip-rarity ${card.unique ? "special" : "common"}`}>
          {card.unique && <Crown/>}{card.unique ? "Special" : "Common"}
        </span>
        <span className="card-hover-tooltip-pity"><PityIcon size={18}/><small>Pity points</small><b>{pityCost}</b></span>
      </header>
      <div className="card-hover-tooltip-identity">
        <span className={`card-hover-tooltip-action effect-${card.effect}`}><CardEffectIcon card={card} size={28}/></span>
        <div><small>{getCardEffectLabel(card)}</small><strong>{card.name}</strong></div>
      </div>
      <section className="card-hover-tooltip-description">
        <small>Main description</small>
        <p><EffectText text={card.description} card={card}/></p>
      </section>
      <div className="card-hover-tooltip-results">
        {rows.map((row, index) => <section className={row.tone ?? "neutral"} key={`${row.label}-${index}`}>
          <span aria-hidden="true">{row.icon ?? <CardEffectIcon card={card}/>}</span>
          <b>{row.label}</b>
          <p><EffectText text={row.result} card={card}/></p>
        </section>)}
      </div>
    </div>
  </aside>, portalRoot);
}
