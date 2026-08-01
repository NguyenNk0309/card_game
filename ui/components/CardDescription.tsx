import type { ActionCard } from "@/shared/types";
import { TruncatedEffectText } from "./TruncatedEffectText";

export function CardDescription({ card, className = "" }: { card: ActionCard; className?: string }) {
  return <TruncatedEffectText as="p" className={`card-description ${className}`.trim()} maxLines={4} text={card.description} card={card}/>;
}
