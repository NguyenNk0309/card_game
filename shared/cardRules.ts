import type { ActionCard } from "./types";

const effectLabels: Record<ActionCard["effect"], string> = {
  damage: "Single-target attack",
  aoe: "Area attack",
  heal: "Heal an ally",
  guard: "Shield an ally",
  support: "Support teammates"
};

const targetLabels: Record<ActionCard["target"], string> = {
  self: "Self",
  ally: "One living ally",
  "all-allies": "All living allies",
  enemy: "One living enemy",
  "all-enemies": "All living enemies"
};

export function getCardEffectLabel(card: ActionCard) {
  if (card.effect === "heal" && card.target === "self") return "Heal yourself";
  if (card.effect === "guard" && card.target === "self") return "Shield yourself";
  return effectLabels[card.effect];
}

export function getCardTargetLabel(card: ActionCard) {
  return targetLabels[card.target];
}

export function describeCardImpact(card: ActionCard) {
  const failure = card.failureEffect && card.failureValue ? ` On failure: ${card.failureEffect === "self-damage" ? `the user takes ${card.failureValue} damage` : card.failureEffect === "team-damage" ? `the entire team takes ${card.failureValue} damage` : card.failureEffect === "lose-shield" ? `the user loses up to ${card.failureValue} shield` : `every enemy gains ${card.failureValue} shield`}.` : "";
  if (card.effect === "damage") return `On success: deal ${card.value} damage to ${targetLabels[card.target].toLowerCase()}; shield absorbs damage before HP${card.ignoresShield ? ", but this card ignores shield" : ""}.${failure}`;
  if (card.effect === "aoe") return `On success: every living enemy takes ${card.value} damage${card.ignoresShield ? " that ignores shield" : "; shield absorbs damage before HP"}.${failure}`;
  if (card.effect === "heal") return card.target === "self" ? `On success: restore up to ${card.value} HP to yourself; this cannot revive you.${failure}` : `On success: choose a living ally, including yourself, and restore up to ${card.value} HP; this cannot revive a defeated player.${failure}`;
  if (card.effect === "guard") return card.target === "self" ? `On success: grant yourself ${card.value} shield.${failure}` : `On success: choose a living ally, including yourself, and grant them ${card.value} shield.${failure}`;
  if (card.supportType === "healing") return `On success: every living ally immediately restores up to ${card.value} HP.`;
  if (card.supportType === "shield") return `On success: every living ally immediately gains ${card.value} shield.`;
  if (card.supportType === "enemy-dice") return `On success: the chosen enemy suffers -${card.value} to their d20 result on their next turn.`;
  if (card.supportType === "delay-enemy") return "On success: move the chosen enemy's upcoming turn to the end of the queue.";
  if (card.supportType === "advance-ally") return "On success: move the chosen ally to the next position in the turn queue.";
  if (card.supportType === "dispel-enemy") return `On success: remove the chosen enemy's attack and d20 buffs and destroy up to ${card.value} shield.`;
  const buff = card.supportType === "attack" ? "damage on their next attack" : "to their d20 result on their next turn";
  return `On success: every living ally gains +${card.value} ${buff}; the buff remains until used.`;
}
