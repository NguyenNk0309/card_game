"use client";

import { Check, Crown, X } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useRef } from "react";
import { describeCardFailure, describeCardSuccess, getCardEffectLabel } from "@/shared/cardRules";
import type { ActionCard } from "@/shared/types";
import { getCardArtwork } from "../cardArtwork";
import { CardDescription } from "./CardDescription";
import { CardEffectIcon } from "./CardEffectIcon";
import { CardHoverPreview } from "./CardHoverPreview";
import { PityCostBadge } from "./PityCost";
import { TruncatedEffectText } from "./TruncatedEffectText";

export type CardResultRow = {
  icon?: ReactNode;
  label: string;
  result: string;
  tone?: "success" | "failure" | "neutral";
};

type Props = {
  card: ActionCard;
  contextLabel?: ReactNode;
  pityCostOverride?: number;
  resultRows?: CardResultRow[];
};

const defaultRows = (card: ActionCard): CardResultRow[] => [
  { icon: <Check/>, label: "SUCCESS", result: describeCardSuccess(card), tone: "success" },
  { icon: <X/>, label: "FAILURE", result: describeCardFailure(card), tone: "failure" },
];

export function CardFace({ card, contextLabel, pityCostOverride, resultRows }: Props) {
  const artwork = getCardArtwork(card);
  const rows = resultRows ?? defaultRows(card);
  const faceRef = useRef<HTMLDivElement>(null);

  return <><div ref={faceRef} className="gothic-card-face" data-card-id={card.id} data-card-name={card.name} data-rarity={card.unique ? "special" : "common"}>
    <div className="gothic-card-art" data-target={artwork.target} data-art-kind={artwork.kind}>
      <div className="gothic-card-art-backdrop"/>
      {artwork.scene
        ? <img className="gothic-card-scene" src={artwork.scene} alt={artwork.alt} width="768" height="768" loading="lazy" decoding="async" draggable={false}/>
        : <div className="gothic-card-art-missing" role="img" aria-label={artwork.alt}><span>?</span><small>ARTWORK PENDING</small></div>}
      <div className={`gothic-card-effect-wash effect-${card.effect}`} aria-hidden="true"/>
    </div>
    <div className="gothic-card-rarity-banner">{card.unique && <Crown/>}<span>{card.unique ? "SPECIAL" : "COMMON"}</span></div>
    <PityCostBadge card={card} costOverride={pityCostOverride}/>
    {contextLabel && <div className="gothic-card-context">{contextLabel}</div>}
    <div className="gothic-card-copy">
      <div className={`gothic-card-action-icon effect-${card.effect}`} title={getCardEffectLabel(card)}><CardEffectIcon card={card}/></div>
      <strong className="gothic-card-title">{card.name}</strong>
      <CardDescription card={card}/>
    </div>
    <div className="gothic-card-results" style={{ "--result-row-count": Math.max(1, rows.length) } as CSSProperties}>
      {rows.map((row, index) => <div className={`gothic-card-result-row ${row.tone ?? "neutral"}`} key={`${row.label}-${index}`}>
        <span className="gothic-card-result-icon" aria-hidden="true">{row.icon ?? <CardEffectIcon card={card}/>}</span>
        <b>{row.label}</b>
        <TruncatedEffectText className="gothic-card-result-text" maxLines={2} text={row.result} card={card}/>
      </div>)}
    </div>
    <div className="gothic-card-gem" aria-hidden="true"/>
  </div><CardHoverPreview anchorRef={faceRef} artwork={artwork} card={card} pityCostOverride={pityCostOverride} rows={rows}/></>;
}
