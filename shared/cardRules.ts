import type { ActionCard, PlayerRunState } from "./types";
import { calculateRuntimePityCost, isTestModeEnabled } from "./pityCost.mjs";

export function getCardPityCost(card: Omit<ActionCard, "pityCost"> | ActionCard) {
  return calculateRuntimePityCost(card, isTestModeEnabled(process.env.TEST_MODE));
}

export function hasFavorableOmen(state?: Pick<PlayerRunState, "completedPlayerTurns" | "zeroPityUntilTurn" | "shopFreePity">) {
  return Boolean(state && ((state.zeroPityUntilTurn ?? 0) > (state.completedPlayerTurns ?? 0) || state.shopFreePity));
}

export function getEffectiveCardPityCost(card: ActionCard, state?: Pick<PlayerRunState, "completedPlayerTurns" | "zeroPityUntilTurn" | "shopFreePity">) {
  return hasFavorableOmen(state) ? 0 : getCardPityCost(card);
}

export function getCardRarity(card: Pick<ActionCard, "external" | "unique">): "external" | "special" | "common" {
  if (card.external) return "external";
  return card.unique ? "special" : "common";
}

export function getCardRarityLabel(card: Pick<ActionCard, "external" | "unique">) {
  const rarity = getCardRarity(card);
  return `${rarity[0].toUpperCase()}${rarity.slice(1)}`;
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
  if (card.effect === "heal" && card.target === "all-allies") return "Heal all allies";
  if (card.effect === "guard" && card.target === "self") return "Shield yourself";
  if (card.effect === "support" && card.target === "self") return "Empower yourself";
  return effectLabels[card.effect];
}

export function getCardTargetLabel(card: ActionCard) {
  if (card.supportType === "advance-ally") return "One other living ally";
  return targetLabels[card.target];
}

export function describeCardSuccess(card: ActionCard) {
  return card.effect === "none" ? "No effect." : "Effect applies.";
}

export function describeCardFailure(card: ActionCard) {
  if (!card.unique || !card.failureEffect || !card.failureValue) return "No effect.";
  if (card.failureEffect === "self-damage") return `Take ${card.failureValue} backlash damage.`;
  if (card.failureEffect === "team-damage") return `Team takes ${card.failureValue} backlash damage.`;
  if (card.failureEffect === "lose-shield") return `Lose up to ${card.failureValue} shield.`;
  return `Every enemy gains ${card.failureValue} shield until the end of their next turn.`;
}

export function describeCardImpact(card: ActionCard) {
  return `Success: ${describeCardSuccess(card)} Failure: ${describeCardFailure(card)}`;
}
