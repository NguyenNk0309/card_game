"use client";

import { Check, Crown, X } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { memo, useCallback, useRef, useState } from "react";
import { describeCardFailure, describeCardSuccess, getCardEffectLabel, getCardRarity } from "@/shared/cardRules";
import type { ActionCard } from "@/shared/types";
import { getCardArtwork } from "../cardArtwork";
import { CardDescription } from "./CardDescription";
import { getCardEffectTone } from "./EffectText";
import { CardEffectIcon } from "./CardEffectIcon";
import { CardArtworkViewer } from "./CardArtworkViewer";
import { CardHoverPreview } from "./CardHoverPreview";
import { PityCostBadge } from "./PityCost";
import { TruncatedEffectText } from "./TruncatedEffectText";

export type CardResultRow = {
  icon?: ReactNode;
  label: string;
  result: string;
  tone?: "success" | "failure" | "neutral";
  effectTone?: "damage" | "shield" | "none";
};

type Props = {
  card: ActionCard;
  imageLoading?: "eager" | "lazy";
  imagePriority?: "high" | "low" | "auto";
  pityCostOverride?: number;
  previewTrigger?: "click" | "hover";
  resultRows?: CardResultRow[];
};

const defaultRows = (card: ActionCard): CardResultRow[] => [
  { icon: <Check/>, label: "SUCCESS", result: describeCardSuccess(card), tone: "success" },
  { icon: <X/>, label: "FAILURE", result: describeCardFailure(card), tone: "failure", effectTone: card.failureEffect === "self-damage" || card.failureEffect === "team-damage" ? "damage" : card.failureEffect === "lose-shield" || card.failureEffect === "enemy-shield" ? "shield" : "none" },
];

export const CardFace = memo(function CardFace({ card, imageLoading = "lazy", imagePriority = "auto", pityCostOverride, previewTrigger = "click", resultRows }: Props) {
  const artwork = getCardArtwork(card);
  const rarity = getCardRarity(card);
  const effectTone = getCardEffectTone(card);
  const artworkSource = artwork.preview ?? artwork.scene;
  const rows = resultRows ?? defaultRows(card);
  const faceRef = useRef<HTMLDivElement>(null);
  const [artworkViewerOpen, setArtworkViewerOpen] = useState(false);
  const changeArtworkViewer = useCallback((open: boolean) => setArtworkViewerOpen(open), []);

  return <><div ref={faceRef} className="gothic-card-face" data-card-id={card.id} data-card-name={card.name} data-rarity={rarity}>
    <div className="gothic-card-art" data-target={artwork.target} data-art-kind={artwork.kind}>
      <div className="gothic-card-art-backdrop"/>
      {artworkSource
        ? <img className="gothic-card-scene" src={artworkSource} alt={artwork.alt} width="640" height="640" loading={imageLoading} fetchPriority={imagePriority} decoding="async" draggable={false}/>
        : <div className="gothic-card-art-missing" role="img" aria-label={artwork.alt}><span>?</span><small>ARTWORK PENDING</small></div>}
      <div className={`gothic-card-effect-wash effect-${effectTone}`} aria-hidden="true"/>
    </div>
    <div className="gothic-card-rarity-banner">{rarity === "special" && <Crown/>}<span>{rarity.toUpperCase()}</span></div>
    <PityCostBadge card={card} costOverride={pityCostOverride}/>
    <div className="gothic-card-copy">
      <div className={`gothic-card-action-icon effect-${effectTone}`} title={getCardEffectLabel(card)}><CardEffectIcon card={card}/></div>
      <strong className="gothic-card-title">{card.name}</strong>
      <CardDescription card={card}/>
    </div>
    <div className="gothic-card-results" style={{ "--result-row-count": Math.max(1, rows.length) } as CSSProperties}>
      {rows.map((row, index) => <div className={`gothic-card-result-row ${row.tone ?? "neutral"} ${row.effectTone ?? ""}`} key={`${row.label}-${index}`}>
        <span className="gothic-card-result-icon" aria-hidden="true">{row.icon ?? <CardEffectIcon card={card}/>}</span>
        <b>{row.label}</b>
        <TruncatedEffectText className="gothic-card-result-text" maxLines={2} text={row.result} card={card}/>
      </div>)}
    </div>
    <CardArtworkViewer artwork={artwork} cardName={card.name} open={artworkViewerOpen} onOpenChange={changeArtworkViewer}/>
    <div className="gothic-card-gem" aria-hidden="true"/>
  </div><CardHoverPreview anchorRef={faceRef} artwork={artwork} card={card} pityCostOverride={pityCostOverride} rows={rows} suspended={artworkViewerOpen} trigger={previewTrigger}/></>;
});
