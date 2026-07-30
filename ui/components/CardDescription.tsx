import type { ActionCard } from "@/shared/types";
import { EffectText } from "./EffectText";

export function CardDescription({ card, className = "" }: { card: ActionCard; className?: string }) {
  return <p className={`card-description ${className}`.trim()}><EffectText text={card.description} card={card}/></p>;
}
