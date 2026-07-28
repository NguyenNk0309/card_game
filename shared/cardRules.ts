import type { ActionCard, PlayerRunState } from "./types";

export function getCardPityCost(card: Omit<ActionCard, "pityCost"> | ActionCard) {
  const storedCost = Number((card as Partial<ActionCard>).pityCost);
  if (Number.isFinite(storedCost) && storedCost >= 0) return Math.min(8, Math.floor(storedCost));
  if (card.effect === "none") return 0;
  if (!card.unique) return Math.min(5, Math.max(3, card.value));
  if (card.effect === "damage") return Math.min(8, 2 + card.value + (card.ignoresShield ? 1 : 0));
  if (card.effect === "aoe") return Math.min(8, 3 + card.value + (card.ignoresShield ? 1 : 0));
  if (card.effect === "heal" || card.effect === "guard") return Math.min(7, 2 + card.value);
  if (["revive", "skip-enemy", "steal-card"].includes(card.supportType ?? "")) return 7;
  if (["purge-card", "advance-ally", "dispel-enemy"].includes(card.supportType ?? "")) return 6;
  return Math.min(6, 3 + card.value);
}

export function hasFavorableOmen(state?: Pick<PlayerRunState, "completedPlayerTurns" | "zeroPityUntilTurn">) {
  return Boolean(state && (state.zeroPityUntilTurn ?? 0) > (state.completedPlayerTurns ?? 0));
}

export function getEffectiveCardPityCost(card: ActionCard, state?: Pick<PlayerRunState, "completedPlayerTurns" | "zeroPityUntilTurn">) {
  return hasFavorableOmen(state) ? 0 : getCardPityCost(card);
}

const effectLabels: Record<ActionCard["effect"], string> = {
  damage: "Single-target attack",
  aoe: "Area attack",
  heal: "Heal an ally",
  guard: "Shield an ally",
  support: "Support teammates",
  none: "No effect"
};

const targetLabels: Record<ActionCard["target"], string> = {
  self: "Self",
  ally: "One living ally (including yourself)",
  "defeated-ally": "One defeated ally",
  "all-allies": "All living allies (including yourself)",
  enemy: "One living enemy",
  "all-enemies": "All living enemies",
  player: "Any player"
};

export function getCardEffectLabel(card: ActionCard) {
  if (card.effect === "heal" && card.target === "self") return "Heal yourself";
  if (card.effect === "guard" && card.target === "self") return "Shield yourself";
  return effectLabels[card.effect];
}

export function getCardTargetLabel(card: ActionCard) {
  if (card.supportType === "advance-ally") return "One other living ally";
  return targetLabels[card.target];
}

export function describeCardSuccess(card: ActionCard) {
  return card.effect === "none" ? "Nothing happen" : "Apply this card's effect.";
}

export function describeCardFailure(card: ActionCard) {
  if (!card.unique) return "Nothing happen";
  if (!card.failureEffect || !card.failureValue) return "The card has no effect.";
  if (card.failureEffect === "self-damage") return `The user takes ${card.failureValue} backlash damage.`;
  if (card.failureEffect === "team-damage") return `The entire team takes ${card.failureValue} backlash damage.`;
  if (card.failureEffect === "lose-shield") return `The user loses up to ${card.failureValue} shield.`;
  return `Every enemy gains ${card.failureValue} shield.`;
}

export function describeCardImpact(card: ActionCard) {
  return `Success: ${describeCardSuccess(card)} Failure: ${describeCardFailure(card)}`;
}
