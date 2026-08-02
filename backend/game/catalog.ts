import { LIORA_VENN_SPECIAL_CARDS } from "@/shared/lioraVenn.mjs";
import type { ActionCard, Hero, PlayerSession, Realm } from "@/shared/types";

export const HERO_TEMPLATES: Omit<Hero, "id" | "team" | "isYou">[] = [
  { name: "Elara Voss", title: "The Undying Lantern", role: "Guardian", classId: "warden", className: "Guardian Warden", passiveName: "Lantern-Forged Guard", passiveText: "Elara's Guard cards grant +1 shield.", skill: "Lantern Phalanx", skillText: "Shield every ally.", summary: "A guardian who shields allies and adjusts turn order.", impact: "Stabilizes allies for a finisher.", hp: 11, maxHp: 11, speed: 3, color: "#d5b56b", initials: "EV" },
  { name: "Thorne Vale", title: "The Final Arrow", role: "Ranger", classId: "ranger", className: "Precision Ranger", passiveName: "Second-Beat Deadeye", passiveText: "Every second turn, Thorne's single-target attacks deal +1 damage.", skill: "Deadeye Bolt", skillText: "Deal heavy single-target damage.", summary: "A fast ranger with precise, shield-piercing attacks.", impact: "Removes priority enemies quickly.", hp: 9, maxHp: 9, speed: 9, color: "#82a88a", initials: "TV" },
  { name: "Mira Ash", title: "The Cinder Blade", role: "Mage", classId: "mage", className: "Area Mage", passiveName: "Wildfire Reach", passiveText: "AOE attacks deal +1 damage to each target.", skill: "Wildfire Inferno", skillText: "Burn every enemy.", summary: "A volatile mage who damages the whole enemy team.", impact: "Softens enemies for allied finishers.", hp: 9, maxHp: 9, speed: 5, color: "#bd705c", initials: "MA" },
  { name: "Brother Orren", title: "The Burden Bearer", role: "Healer", classId: "healer", className: "Restoration Cleric", passiveName: "Graceful Restoration", passiveText: "Orren's Heal cards restore +1 HP.", skill: "Graceful Renewal", skillText: "Restore heavy ally HP.", summary: "A healer who restores and revives allies.", impact: "Reverses one critical defeat.", hp: 10, maxHp: 10, speed: 4, color: "#789bad", initials: "BO" },
  { name: "Liora Venn", title: "The Crimson Mercy", role: "Healer", classId: "bloodweaver", className: "Bloodweaver Healer", passiveName: "Sanguine Recompense", passiveText: "After Liora pays HP to attack the enemy, her next successful Heal card restores 1 additional HP to every living ally; does not stack.", skill: "Crimson Verdict", skillText: "Sacrifice HP to deal heavy damage to one enemy.", summary: "A bloodweaver who restores her allies or transforms her own life force into devastating attacks.", impact: "Alternates between powerful team healing and dangerous offensive bursts.", hp: 12, maxHp: 12, speed: 3, color: "#9f4f68", initials: "LV" },
  { name: "Nyx Calder", title: "The Blade in Shadow", role: "Assassin", classId: "assassin", className: "Saboteur Assassin", passiveName: "Veilpiercer", passiveText: "Nyx's Attack cards ignore shield.", skill: "Veilpiercing Knife", skillText: "Strike through shield.", summary: "A fast assassin who pierces shield and steals cards.", impact: "Punishes shield-heavy enemies.", hp: 8, maxHp: 8, speed: 10, color: "#9a83b7", initials: "NC" },
  { name: "Bram Coalhand", title: "The Red-Coal Bulwark", role: "Tank", classId: "tank", className: "Bulwark Tank", passiveName: "Two-Turn Temper", passiveText: "Shields granted by Bram's Guard cards last for 2 turns.", skill: "Two-Turn Bastion", skillText: "Give one ally heavy shield.", summary: "A durable tank who shields allies and turns defense into offense.", impact: "Keeps one key ally alive.", hp: 14, maxHp: 14, speed: 1, color: "#c98b58", initials: "BC" },
  { name: "Sable Fen", title: "The Eye of the Storm", role: "Controller", classId: "oracle", className: "Fate Oracle", passiveName: "Foreseen Return", passiveText: "The first time Sable is defeated, she revives at half HP.", skill: "Foretold Success", skillText: "Set one ally's next card to 0 pity.", summary: "A controller who changes rolls, pity, and turns.", impact: "Makes one crucial action automatic.", hp: 8, maxHp: 8, speed: 7, color: "#6aa8a5", initials: "SF" },
  { name: "Kael Rook", title: "The Challenger", role: "Duelist", classId: "duelist", className: "Disruptive Duelist", passiveName: "Unshielded Edge", passiveText: "Kael's Attack cards deal +1 damage while he has no shield.", skill: "Unshielded Riposte", skillText: "Deal heavy single-target damage.", summary: "A risky duelist who attacks and strips defenses.", impact: "Breaks defenses before finishing.", hp: 10, maxHp: 10, speed: 8, color: "#a96161", initials: "KR" },
  { name: "Ione Mire", title: "Marshal of the Drowned Road", role: "Support", classId: "support", className: "Mirefield Marshal", passiveName: "Marshal's Fortune", passiveText: "Ione gains +1 on every d20 roll.", skill: "Assault Order", skillText: "Boost the team's next attacks.", summary: "A scarred marsh-born field marshal who maps drowned roads, binds warbands by oath, and turns stolen plans against their owners.", impact: "Directs allies from flooded front lines while stripping one enemy option.", hp: 9, maxHp: 9, speed: 6, color: "#7f9c91", initials: "IM" },
  { name: "Dagan Flint", title: "Blood of the Front Line", role: "Berserker", classId: "berserker", className: "Blood Berserker", passiveName: "Bloodied Power", passiveText: "At half HP or lower, Dagan's attacks deal +1 damage.", skill: "Bloodied Onslaught", skillText: "Damage every enemy while wounded.", summary: "A durable attacker who grows stronger when wounded.", impact: "Trades safety for finishing power.", hp: 12, maxHp: 12, speed: 2, color: "#768493", initials: "DF" }
];

type CardWithoutPity = Omit<ActionCard, "pityCost">;
type CharacterSkillCard = Omit<ActionCard, "unique">;

export function calculatePityCost(card: CardWithoutPity | ActionCard) {
  const storedCost = Number((card as Partial<ActionCard>).pityCost);
  if (Number.isFinite(storedCost) && storedCost >= 0) return Math.min(8, Math.floor(storedCost));
  if (card.effect === "none") return 0;
  if (!card.unique) return Math.min(5, Math.max(2, card.value));
  if (card.effect === "damage") return Math.min(8, 2 + card.value + (card.ignoresShield ? 1 : 0));
  if (card.effect === "aoe") return Math.min(8, 3 + card.value + (card.ignoresShield ? 1 : 0));
  if (card.effect === "heal" || card.effect === "guard") return Math.min(7, 2 + card.value);
  if (["revive", "skip-enemy", "steal-card"].includes(card.supportType ?? "")) return 7;
  if (["purge-card", "advance-ally", "dispel-enemy"].includes(card.supportType ?? "")) return 6;
  return Math.min(6, 3 + card.value);
}

export const CHARACTER_SKILL_CARDS: Record<string, CharacterSkillCard[]> = {
  "Elara Voss": [
    { id: "ev-aegis", name: "Lantern Phalanx", description: "All living allies, including yourself, gain 2 shield (3 with Lantern-Forged Guard); expires at the end of each target's next turn.", bonus: 0, effect: "guard", target: "all-allies", value: 2, failureEffect: "team-damage", failureValue: 1, pityCost: 5 },
    { id: "ev-ward", name: "Undying Ward", description: "One living ally, including yourself, gains 3 shield (4 with Lantern-Forged Guard); expires at the end of the target's next turn.", bonus: 0, effect: "guard", target: "ally", value: 3, failureEffect: "lose-shield", failureValue: 2, pityCost: 5 },
    { id: "ev-command", name: "Rescue Order", description: "Move another living ally directly behind Elara in turn order.", bonus: 0, effect: "support", target: "ally", value: 1, supportType: "advance-ally", failureEffect: "self-damage", failureValue: 1, pityCost: 4 }
  ],
  "Thorne Vale": [
    { id: "tv-mark", name: "Deadeye Bolt", description: "Deal 4 damage to one living enemy (5 when Second-Beat Deadeye triggers).", bonus: 0, effect: "damage", target: "enemy", value: 4, failureEffect: "self-damage", failureValue: 2, pityCost: 6 },
    { id: "tv-pierce", name: "Armor-Piercing Bolt", description: "Deal 3 damage to one living enemy, ignoring shield (4 when Second-Beat Deadeye triggers).", bonus: 0, effect: "damage", target: "enemy", value: 3, ignoresShield: true, failureEffect: "self-damage", failureValue: 2, pityCost: 6 },
    { id: "tv-hunt", name: "Predator's Boon", description: "One living ally, including yourself, gains +2 attack damage; expires at the end of the target's next turn.", bonus: 0, effect: "support", target: "ally", value: 2, supportType: "attack", failureEffect: "enemy-shield", failureValue: 1, pityCost: 5 }
  ],
  "Mira Ash": [
    { id: "ma-inferno", name: "Wildfire Inferno", description: "Deal 3 damage to every living enemy (4 with Wildfire Reach).", bonus: 0, effect: "aoe", target: "all-enemies", value: 3, failureEffect: "team-damage", failureValue: 1, pityCost: 7 },
    { id: "ma-comet", name: "Piercing Ashfall", description: "Deal 2 damage to every living enemy, ignoring shield (3 with Wildfire Reach).", bonus: 0, effect: "aoe", target: "all-enemies", value: 2, ignoresShield: true, failureEffect: "self-damage", failureValue: 2, pityCost: 7 },
    { id: "ma-gravity", name: "Gravitic Misfortune", description: "One living enemy gets -2 on their next d20; expires at the end of the target's next turn.", bonus: 0, effect: "support", target: "enemy", value: 2, supportType: "enemy-dice", failureEffect: "enemy-shield", failureValue: 1, pityCost: 5 }
  ],
  "Brother Orren": [
    { id: "bo-prayer", name: "Graceful Renewal", description: "One living ally, including yourself, restores 3 HP (4 with Graceful Restoration); cannot revive.", bonus: 0, effect: "heal", target: "ally", value: 3, failureEffect: "self-damage", failureValue: 1, pityCost: 5 },
    { id: "bo-blessing", name: "Shared Restoration", description: "All living allies, including yourself, restore 2 HP (3 with Graceful Restoration); cannot revive.", bonus: 0, effect: "heal", target: "all-allies", value: 2, failureEffect: "team-damage", failureValue: 1, pityCost: 6 },
    { id: "bo-return", name: "Immediate Resurrection", description: "Immediately revive one defeated ally with one-third HP; then this card enters the graveyard.", bonus: 0, effect: "support", target: "defeated-ally", value: 1, supportType: "revive", failureEffect: "team-damage", failureValue: 2, pityCost: 8 }
  ],
  "Liora Venn": LIORA_VENN_SPECIAL_CARDS.map((card) => ({ ...card })),
  "Nyx Calder": [
    { id: "nc-knife", name: "Veilpiercing Knife", description: "Deal 3 damage to one living enemy, ignoring shield.", bonus: 0, effect: "damage", target: "enemy", value: 3, failureEffect: "self-damage", failureValue: 2, pityCost: 6 },
    { id: "nc-execute", name: "Veilpiercing Execution", description: "Deal 4 damage to one living enemy, ignoring shield.", bonus: 0, effect: "damage", target: "enemy", value: 4, ignoresShield: true, failureEffect: "self-damage", failureValue: 3, pityCost: 7 },
    { id: "nc-pilfer", name: "Borrowed Fate", description: "Steal 1 random card from an enemy hand, preferring special cards; return it to their discard pile when Nyx's next turn ends.", bonus: 0, effect: "support", target: "enemy", value: 1, supportType: "steal-card", failureEffect: "enemy-shield", failureValue: 2, pityCost: 7 }
  ],
  "Bram Coalhand": [
    { id: "bc-fortress", name: "Two-Turn Bastion", description: "One living ally, including yourself, gains 4 shield; expires at the end of the target's second turn.", bonus: 0, effect: "guard", target: "ally", value: 4, failureEffect: "lose-shield", failureValue: 3, pityCost: 6 },
    { id: "bc-temper", name: "Tempered Phalanx", description: "All living allies, including yourself, gain 3 shield; expires at the end of each target's second turn.", bonus: 0, effect: "guard", target: "all-allies", value: 3, failureEffect: "team-damage", failureValue: 1, pityCost: 7 },
    { id: "bc-march", name: "Bulwark to Blade", description: "Remove all your current shield, then deal that much damage to one living enemy.", bonus: 0, effect: "damage", target: "enemy", value: 0, failureEffect: "lose-shield", failureValue: 4, pityCost: 7 }
  ],
  "Sable Fen": [
    { id: "sf-favor", name: "Foretold Success", description: "One living ally, including yourself, plays their next card during their next turn for 0 pity; expires at the end of that turn.", bonus: 0, effect: "support", target: "ally", value: 2, supportType: "zero-pity", failureEffect: "self-damage", failureValue: 2, pityCost: 6 },
    { id: "sf-hex", name: "Foretold Misfortune", description: "One living enemy gets -3 on their next d20; expires at the end of the target's next turn.", bonus: 0, effect: "support", target: "enemy", value: 3, supportType: "enemy-dice", failureEffect: "enemy-shield", failureValue: 1, pityCost: 6 },
    { id: "sf-stolen", name: "Foretold Delay", description: "Cancel one living enemy's next turn. Their effects expire normally when that turn ends.", bonus: 0, effect: "support", target: "enemy", value: 1, supportType: "skip-enemy", failureEffect: "team-damage", failureValue: 2, pityCost: 8 }
  ],
  "Kael Rook": [
    { id: "kr-riposte", name: "Unshielded Riposte", description: "Deal 3 damage (+1 with Unshielded Edge while Kael has no shield).", bonus: 0, effect: "damage", target: "enemy", value: 3, failureEffect: "self-damage", failureValue: 2, pityCost: 5 },
    { id: "kr-duel", name: "Baresteel Challenge", description: "Deal 3 damage. Unshielded Edge: +2 if Kael and the target have no shield; +1 if only Kael has no shield.", bonus: 0, effect: "damage", target: "enemy", value: 3, failureEffect: "lose-shield", failureValue: 2, pityCost: 6 },
    { id: "kr-break", name: "Buffbreaker", description: "Remove one living enemy's attack and d20 buffs, then destroy up to 3 shield.", bonus: 0, effect: "support", target: "enemy", value: 3, supportType: "dispel-enemy", failureEffect: "enemy-shield", failureValue: 2, pityCost: 6 }
  ],
  "Ione Mire": [
    { id: "im-command", name: "Assault Order", description: "All living allies, including yourself, gain +2 attack damage; expires at the end of each target's next turn.", bonus: 0, effect: "support", target: "all-allies", value: 2, supportType: "attack", failureEffect: "team-damage", failureValue: 1, pityCost: 6 },
    { id: "im-focus", name: "Precision Order", description: "All living allies, including yourself, gain +2 d20; expires at the end of each target's next turn.", bonus: 0, effect: "support", target: "all-allies", value: 2, supportType: "dice", failureEffect: "team-damage", failureValue: 1, pityCost: 6 },
    { id: "im-purge", name: "Mirefield Seizure", description: "Move 1 random card from an enemy hand to their graveyard for 2 phases, then return it to their draw pile.", bonus: 0, effect: "support", target: "enemy", value: 2, supportType: "purge-card", failureEffect: "enemy-shield", failureValue: 2, pityCost: 8 }
  ],
  "Dagan Flint": [
    { id: "df-none", name: "Bloodied Onslaught", description: "Deal 3 damage to every living enemy (4 while Dagan is at half HP).", bonus: 0, effect: "aoe", target: "all-enemies", value: 3, failureEffect: "self-damage", failureValue: 2, pityCost: 7 },
    { id: "df-cleave", name: "Bloodied Cleave", description: "Deal 4 damage to one living enemy (5 while Dagan is at half HP).", bonus: 0, effect: "damage", target: "enemy", value: 4, failureEffect: "self-damage", failureValue: 2, pityCost: 7 },
    { id: "df-frenzy", name: "Flintblood Fury", description: "Gain +3 attack damage; expires at the end of your next turn.", bonus: 0, effect: "support", target: "self", value: 3, supportType: "attack", failureEffect: "self-damage", failureValue: 2, pityCost: 6 }
  ]
};

export const PHASE_FIVE_CARD_UPGRADES = {
  "lost-momentum": "heavy",
  "broken-plan": "brace",
  "empty-gesture": "second-wind"
} as const;

const COMMON_ACTION_CARDS: ActionCard[] = [
  { id: "slash", name: "Slash", description: "Deal 2 damage to one living enemy.", bonus: 0, effect: "damage", target: "enemy", value: 2, unique: false, pityCost: 2 },
  { id: "heavy", name: "Heavy Blow", description: "Deal 3 damage to one living enemy.", bonus: 0, effect: "damage", target: "enemy", value: 3, unique: false, pityCost: 3 },
  { id: "brace", name: "Brace", description: "Gain 2 shield; expires at the end of your next turn.", bonus: 0, effect: "guard", target: "self", value: 2, unique: false, pityCost: 2 },
  { id: "second-wind", name: "Second Wind", description: "Restore 3 HP to yourself; cannot revive.", bonus: 0, effect: "heal", target: "self", value: 3, unique: false, pityCost: 3 },
  { id: "empty-gesture", name: "Empty Gesture", description: "No effect; upgrades to a heal card after phase 5.", bonus: 0, effect: "none", target: "self", value: 0, unique: false, pityCost: 0 },
  { id: "broken-plan", name: "Broken Plan", description: "No effect; upgrades to a shield card after phase 5.", bonus: 0, effect: "none", target: "self", value: 0, unique: false, pityCost: 0 },
  { id: "lost-momentum", name: "Lost Momentum", description: "No effect; upgrades to a heavy attack card after phase 5.", bonus: 0, effect: "none", target: "self", value: 0, unique: false, pityCost: 0 }
];

export const ACTION_CARDS: ActionCard[] = COMMON_ACTION_CARDS.map((card) => ({ ...card, pityCost: calculatePityCost(card) }));

const matchesCommonCardId = (cardId: string, commonId: string) => cardId === commonId || cardId.endsWith(`-common-${commonId}`);

export function upgradeCardsAfterPhaseFive(cards: ActionCard[], completedPhases: number) {
  if (completedPhases < 5) return cards;
  let changed = false;
  const upgraded = cards.map((card) => {
    const sourceId = (Object.keys(PHASE_FIVE_CARD_UPGRADES) as Array<keyof typeof PHASE_FIVE_CARD_UPGRADES>)
      .find((candidate) => matchesCommonCardId(card.id, candidate));
    if (!sourceId || card.effect !== "none") return card;
    const targetId = PHASE_FIVE_CARD_UPGRADES[sourceId];
    const target = cards.find((candidate) => matchesCommonCardId(candidate.id, targetId));
    if (!target) return card;
    const { id: _targetId, ...targetAbilities } = target;
    changed = true;
    return { ...targetAbilities, id: card.id };
  });
  return changed ? upgraded : cards;
}

export function upgradePlayerCardsAfterPhaseFive(players: PlayerSession[], completedPhases: number) {
  if (completedPhases < 5) return players;
  let changed = false;
  const upgraded = players.map((player) => {
    const skillDeck = upgradeCardsAfterPhaseFive(player.skillDeck, completedPhases);
    if (skillDeck === player.skillDeck) return player;
    changed = true;
    return { ...player, skillDeck };
  });
  return changed ? upgraded : players;
}

export const REALMS: Realm[] = [
  { id: "arena", name: "Oathbound Arena", region: "The final battle line", weather: "No retreat", objective: "Defeat the enemy team or have a player end the battle.", threat: "The opposing team", accent: "#d4b56e", sceneClass: "scene-arena" }
];

export const STORY_BEATS = [
  "Two teams enter; one leaves.",
  "A warrior chooses the next target.",
  "HP and shield decide who stands.",
  "Defeat the enemy or fall.",
  "The battle continues until one side falls."
];

export const EVENTS = [
  "Battlefield event",
  "Sudden chaos",
  "Escalating curse",
  "Mysterious supplies",
  "Shaking ground"
];
