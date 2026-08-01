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
  trigger: "click" | "hover";
};

type PreviewPosition = {
  left: number;
  placement: "top" | "right";
  ready: boolean;
  top: number;
};

const hiddenPosition: PreviewPosition = { left: -10000, placement: "top", ready: false, top: -10000 };

export function CardHoverPreview({ anchorRef, artwork, card, pityCostOverride, rows, trigger }: Props) {
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
    const toggle = () => {
      setPosition(hiddenPosition);
      setOpen((current) => !current);
    };
    const activateWithKeyboard = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      anchor.click();
    };
    const isNativeControl = anchor.matches("button, a[href], input, select, textarea, summary");
    const previousRole = anchor.getAttribute("role");
    const previousTabIndex = anchor.getAttribute("tabindex");
    const previousControls = anchor.getAttribute("aria-controls");
    const previousExpanded = anchor.getAttribute("aria-expanded");

    anchor.dataset.cardPreviewTrigger = trigger;
    if (trigger === "hover") {
      anchor.addEventListener("mouseenter", show);
      anchor.addEventListener("mouseleave", hide);
    } else {
      anchor.classList.add("card-preview-click-trigger");
      anchor.setAttribute("aria-controls", tooltipId);
      anchor.setAttribute("aria-expanded", "false");
      anchor.addEventListener("click", toggle);
      if (!isNativeControl) {
        anchor.setAttribute("role", "button");
        anchor.tabIndex = 0;
        anchor.addEventListener("keydown", activateWithKeyboard);
      }
    }
    return () => {
      anchor.removeEventListener("mouseenter", show);
      anchor.removeEventListener("mouseleave", hide);
      anchor.removeEventListener("click", toggle);
      anchor.removeEventListener("keydown", activateWithKeyboard);
      anchor.classList.remove("card-preview-click-trigger");
      delete anchor.dataset.cardPreviewTrigger;
      const restoreAttribute = (name: string, value: string | null) => value === null
        ? anchor.removeAttribute(name)
        : anchor.setAttribute(name, value);
      restoreAttribute("role", previousRole);
      restoreAttribute("tabindex", previousTabIndex);
      restoreAttribute("aria-controls", previousControls);
      restoreAttribute("aria-expanded", previousExpanded);
      hide();
    };
  }, [anchorRef, tooltipId, trigger]);

  useEffect(() => {
    const anchor = anchorRef.current?.closest<HTMLElement>(".gothic-card");
    if (trigger !== "click" || !anchor) return;
    anchor.setAttribute("aria-expanded", String(open));
    if (!open) return;
    const closeOutside = (event: MouseEvent) => {
      if (event.target instanceof Node && (anchor.contains(event.target) || tooltipRef.current?.contains(event.target))) return;
      setOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("click", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [anchorRef, open, trigger]);

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
