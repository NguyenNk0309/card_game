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
  ally: "One living ally",
  "defeated-ally": "One defeated ally",
  "all-allies": "All living allies",
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
  return targetLabels[card.target];
}

export function describeCardSuccess(card: ActionCard) {
  if (card.effect === "none") return "No gameplay effect. The played card enters discard and one replacement is drawn.";
  if (card.effect === "damage") return `Deal ${card.value} damage to ${targetLabels[card.target].toLowerCase()}; shield absorbs damage before HP${card.ignoresShield ? ", but this card ignores shield" : ""}.`;
  if (card.effect === "aoe") return `Every living enemy takes ${card.value} damage${card.ignoresShield ? " that ignores shield" : "; shield absorbs damage before HP"}.`;
  if (card.effect === "heal") return card.target === "self" ? `Restore up to ${card.value} HP to yourself; this cannot revive you.` : `Choose a living ally, including yourself, and restore up to ${card.value} HP; this cannot revive a defeated player.`;
  if (card.effect === "guard") return card.target === "self" ? `Grant yourself ${card.value} shield.` : `Choose a living ally, including yourself, and grant them ${card.value} shield.`;
  if (card.supportType === "healing") return `Every living ally immediately restores up to ${card.value} HP.`;
  if (card.supportType === "shield") return `Every living ally immediately gains ${card.value} shield.`;
  if (card.supportType === "enemy-dice") return `The chosen enemy suffers -${card.value} to their d20 result on their next turn.`;
  if (card.supportType === "delay-enemy") return "Move the chosen enemy's upcoming turn to the end of the queue.";
  if (card.supportType === "advance-ally") return "Move the chosen ally to the next position in the turn queue.";
  if (card.supportType === "dispel-enemy") return `Remove the chosen enemy's attack and d20 buffs and destroy up to ${card.value} shield.`;
  if (card.supportType === "revive") return `Choose a defeated ally. They revive with one-third HP after ${card.value} completed turns.`;
  if (card.supportType === "skip-enemy") return "Cancel the chosen enemy's next turn without changing their hand or active buffs.";
  if (card.supportType === "purge-card") return "Choose any player. Remove one no-effect common from an ally, or one effect common from an enemy, for this battle.";
  if (card.supportType === "steal-card") return "Temporarily steal one random common card from an enemy hand. It returns to its owner after your next turn.";
  const buff = card.supportType === "attack" ? "damage on their next attack" : "to their d20 result on their next turn";
  return `Every living ally gains +${card.value} ${buff}; the buff remains until used.`;
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
