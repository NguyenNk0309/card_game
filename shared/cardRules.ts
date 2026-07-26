import type { ActionCard } from "./types";

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
  return card.effect === "none" ? "Play this card with no gameplay effect." : "Apply this card's effect.";
}

export function describeCardFailure(card: ActionCard) {
  if (!card.unique) return "No effect. Common cards never cause an additional failure penalty.";
  if (!card.failureEffect || !card.failureValue) return "The card has no effect.";
  if (card.failureEffect === "self-damage") return `The user takes ${card.failureValue} backlash damage.`;
  if (card.failureEffect === "team-damage") return `The entire team takes ${card.failureValue} backlash damage.`;
  if (card.failureEffect === "lose-shield") return `The user loses up to ${card.failureValue} shield.`;
  return `Every enemy gains ${card.failureValue} shield.`;
}

export function describeCardImpact(card: ActionCard) {
  return `Success: ${describeCardSuccess(card)} Failure: ${describeCardFailure(card)}`;
}
