import { Ban, Heart, Shield, Sparkles, Swords } from "lucide-react";
import type { ActionCard } from "@/shared/types";

export function CardEffectIcon({ card, size = 18 }: { card: ActionCard; size?: number }) {
  if (card.effect === "damage" || card.effect === "aoe") return <Swords size={size} aria-label="Attack card"/>;
  if (card.effect === "heal") return <Heart size={size} aria-label="Heal card"/>;
  if (card.effect === "guard") return <Shield size={size} aria-label="Guard card"/>;
  if (card.effect === "support") return <Sparkles size={size} aria-label="Support card"/>;
  return <Ban size={size} aria-label="No-effect card"/>;
}
