import { Clover } from "lucide-react";
import { getCardPityCost } from "@/shared/cardRules";
import type { ActionCard } from "@/shared/types";

export function PityIcon({ size = 14 }: { size?: number }) {
  return <Clover size={size} strokeWidth={2.4}/>;
}

export function PityCostBadge({ card }: { card: ActionCard }) {
  const cost = getCardPityCost(card);
  return <span className="pity-cost-badge" aria-label={`${cost} pity points required`} title={`${cost} pity points required`}><PityIcon size={12}/><b>{cost}</b></span>;
}
