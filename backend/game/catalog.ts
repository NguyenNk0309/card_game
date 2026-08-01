import type { ActionCard, Hero, PlayerSession, Realm } from "@/shared/types";

export const HERO_TEMPLATES: Omit<Hero, "id" | "team" | "isYou">[] = [
  { name: "Elara Voss", title: "The Undying Lantern", role: "Guardian", classId: "warden", className: "Guardian Warden", passiveName: "United Front", passiveText: "Elara's Support cards gain +1 effect.", skill: "Rallying Aegis", skillText: "Shield every ally.", summary: "A guardian who shields allies and adjusts turn order.", strength: "Team shields and turn rescue.", weakness: "No special attacks; moderate HP.", impact: "Stabilizes allies for a finisher.", hp: 11, maxHp: 11, speed: 3, color: "#d5b56b", initials: "EV" },
  { name: "Thorne Vale", title: "The Final Arrow", role: "Ranger", classId: "ranger", className: "Precision Ranger", passiveName: "Deadeye", passiveText: "Single-target attacks deal +1 damage.", skill: "Marked Arrow", skillText: "Deal heavy single-target damage.", summary: "A fast ranger with precise, shield-piercing attacks.", strength: "Reliable focused damage.", weakness: "Low defense and no healing.", impact: "Removes priority enemies quickly.", hp: 9, maxHp: 9, speed: 9, color: "#82a88a", initials: "TV" },
  { name: "Mira Ash", title: "The Cinder Blade", role: "Mage", classId: "mage", className: "Area Mage", passiveName: "Spreading Flame", passiveText: "AOE attacks deal +1 damage per target.", skill: "Inferno", skillText: "Burn every enemy.", summary: "A fragile mage who damages the whole enemy team.", strength: "Strongest multi-target pressure.", weakness: "Lowest HP and risky backlash.", impact: "Softens enemies for allied finishers.", hp: 7, maxHp: 7, speed: 5, color: "#bd705c", initials: "MA" },
  { name: "Brother Orren", title: "The Burden Bearer", role: "Healer", classId: "healer", className: "Restoration Cleric", passiveName: "Enduring Grace", passiveText: "Orren's Heal cards restore +2 HP.", skill: "Prayer of Life", skillText: "Restore heavy ally HP.", summary: "A healer who restores and revives allies.", strength: "Best healing and only ally revive.", weakness: "No special damage; revive is single-use.", impact: "Reverses one critical defeat.", hp: 10, maxHp: 10, speed: 4, color: "#789bad", initials: "BO" },
  { name: "Nyx Calder", title: "The Blade in Shadow", role: "Assassin", classId: "assassin", className: "Saboteur Assassin", passiveName: "Armor Pierce", passiveText: "Nyx's attacks ignore shield.", skill: "Quiet Knife", skillText: "Strike through shield.", summary: "A fast assassin who pierces shield and steals cards.", strength: "Shield bypass and hand disruption.", weakness: "Low HP and severe backlash.", impact: "Punishes shield-heavy enemies.", hp: 8, maxHp: 8, speed: 10, color: "#9a83b7", initials: "NC" },
  { name: "Bram Coalhand", title: "The Red-Coal Bulwark", role: "Tank", classId: "tank", className: "Bulwark Tank", passiveName: "Tempered Steel", passiveText: "Bram's Guard cards grant +2 shield.", skill: "Living Fortress", skillText: "Give one ally heavy shield.", summary: "A durable tank with three ally-shielding skills.", strength: "Highest HP and strongest shields.", weakness: "No special damage, healing, or control.", impact: "Keeps one key ally alive.", hp: 14, maxHp: 14, speed: 1, color: "#c98b58", initials: "BC" },
  { name: "Sable Fen", title: "The Eye of the Storm", role: "Controller", classId: "oracle", className: "Fate Oracle", passiveName: "Second Sight", passiveText: "Sable's first defeat revives her at half HP.", skill: "Favorable Omen", skillText: "Set one ally's next card to 0 pity.", summary: "A controller who changes rolls, pity, and turns.", strength: "Strong tempo control and self-revival.", weakness: "Low HP and severe team backlash.", impact: "Makes one crucial action automatic.", hp: 8, maxHp: 8, speed: 7, color: "#6aa8a5", initials: "SF" },
  { name: "Kael Rook", title: "The Challenger", role: "Duelist", classId: "duelist", className: "Disruptive Duelist", passiveName: "No Guard", passiveText: "Without shield, Kael's attacks deal +1 damage.", skill: "Riposte", skillText: "Deal heavy single-target damage.", summary: "A risky duelist who attacks and strips defenses.", strength: "High focused damage and dispel.", weakness: "Best unshielded and vulnerable.", impact: "Breaks defenses before finishing.", hp: 10, maxHp: 10, speed: 8, color: "#a96161", initials: "KR" },
  { name: "Ione Mire", title: "Marshal of the Drowned Road", role: "Support", classId: "support", className: "Mirefield Marshal", passiveName: "Commanding Voice", passiveText: "Ione gains +1 to every d20.", skill: "Attack Order", skillText: "Boost the team's next attacks.", summary: "A scarred marsh-born field marshal who maps drowned roads, binds warbands by oath, and turns stolen plans against their owners.", strength: "Disciplined orders, reliable rolls, and card denial.", weakness: "No special damage, shield, or healing.", impact: "Directs allies from flooded front lines while stripping one enemy option.", hp: 9, maxHp: 9, speed: 6, color: "#7f9c91", initials: "IM" },
  { name: "Dagan Flint", title: "Blood of the Front Line", role: "Berserker", classId: "berserker", className: "Blood Berserker", passiveName: "Pain Makes Power", passiveText: "At half HP or lower, attacks deal +1 damage.", skill: "None Left Standing", skillText: "Damage every enemy while wounded.", summary: "A durable attacker who grows stronger when wounded.", strength: "High HP and low-HP damage.", weakness: "Self-focused with damaging backlash.", impact: "Trades safety for finishing power.", hp: 12, maxHp: 12, speed: 2, color: "#768493", initials: "DF" }
];

type CardWithoutPity = Omit<ActionCard, "pityCost">;
type CharacterSkillCard = Omit<CardWithoutPity, "unique">;

export function calculatePityCost(card: CardWithoutPity | ActionCard) {
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

export const CHARACTER_SKILL_CARDS: Record<string, CharacterSkillCard[]> = {
  "Elara Voss": [
    { id: "ev-aegis", name: "Rallying Aegis", description: "All living allies, including yourself, gain 2 shield (3 with United Front); expires at the end of each target's next turn.", bonus: 0, effect: "support", target: "all-allies", value: 2, supportType: "shield", failureEffect: "team-damage", failureValue: 1 },
    { id: "ev-ward", name: "Lantern Ward", description: "One living ally, including yourself, gains 4 shield; expires at the end of the target's next turn.", bonus: 0, effect: "guard", target: "ally", value: 4, failureEffect: "lose-shield", failureValue: 2 },
    { id: "ev-command", name: "Rescue Formation", description: "Move another living ally directly behind Elara in turn order.", bonus: 0, effect: "support", target: "ally", value: 1, supportType: "advance-ally", failureEffect: "self-damage", failureValue: 1 }
  ],
  "Thorne Vale": [
    { id: "tv-mark", name: "Marked Arrow", description: "Deal 4 damage to one living enemy (5 with Deadeye).", bonus: 0, effect: "damage", target: "enemy", value: 4, failureEffect: "self-damage", failureValue: 1 },
    { id: "tv-pierce", name: "Piercing Arrow", description: "Deal 3 damage to one living enemy, ignoring shield (4 with Deadeye).", bonus: 0, effect: "damage", target: "enemy", value: 3, ignoresShield: true, failureEffect: "self-damage", failureValue: 2 },
    { id: "tv-hunt", name: "Hunter's Mark", description: "One living ally, including yourself, gains +2 attack damage; expires at the end of the target's next turn.", bonus: 0, effect: "support", target: "ally", value: 2, supportType: "attack", failureEffect: "lose-shield", failureValue: 2 }
  ],
  "Mira Ash": [
    { id: "ma-inferno", name: "Inferno", description: "Deal 2 damage to every living enemy (3 with Spreading Flame).", bonus: 0, effect: "aoe", target: "all-enemies", value: 2, failureEffect: "team-damage", failureValue: 1 },
    { id: "ma-comet", name: "Ash Comet", description: "Deal 2 damage to every living enemy, ignoring shield (3 with Spreading Flame).", bonus: 0, effect: "aoe", target: "all-enemies", value: 2, ignoresShield: true, failureEffect: "self-damage", failureValue: 2 },
    { id: "ma-gravity", name: "Gravity Hex", description: "One living enemy gets -2 on their next d20; expires at the end of the target's next turn.", bonus: 0, effect: "support", target: "enemy", value: 2, supportType: "enemy-dice", failureEffect: "team-damage", failureValue: 1 }
  ],
  "Brother Orren": [
    { id: "bo-prayer", name: "Prayer of Life", description: "One living ally, including yourself, restores 4 HP (6 with Enduring Grace); cannot revive.", bonus: 0, effect: "heal", target: "ally", value: 4, failureEffect: "self-damage", failureValue: 1 },
    { id: "bo-blessing", name: "Shared Blessing", description: "All living allies, including yourself, restore 2 HP; cannot revive.", bonus: 0, effect: "support", target: "all-allies", value: 2, supportType: "healing", failureEffect: "team-damage", failureValue: 1 },
    { id: "bo-return", name: "Returning Light", description: "Immediately revive one defeated ally with one-third HP; they take the next turn after Orren in the current phase, then this card enters the graveyard.", bonus: 0, effect: "support", target: "defeated-ally", value: 1, supportType: "revive", failureEffect: "team-damage", failureValue: 2 }
  ],
  "Nyx Calder": [
    { id: "nc-knife", name: "Quiet Knife", description: "Deal 4 damage to one living enemy, ignoring shield.", bonus: 0, effect: "damage", target: "enemy", value: 4, failureEffect: "self-damage", failureValue: 1 },
    { id: "nc-execute", name: "Execute", description: "Deal 5 damage to one living enemy, ignoring shield.", bonus: 0, effect: "damage", target: "enemy", value: 5, ignoresShield: true, failureEffect: "self-damage", failureValue: 3 },
    { id: "nc-pilfer", name: "Pilfered Chance", description: "Steal 1 random card from an enemy hand, preferring special cards; return it to their discard pile when Nyx's next turn ends.", bonus: 0, effect: "support", target: "enemy", value: 1, supportType: "steal-card", failureEffect: "self-damage", failureValue: 2 }
  ],
  "Bram Coalhand": [
    { id: "bc-fortress", name: "Living Fortress", description: "One living ally, including yourself, gains 5 shield (7 with Tempered Steel); expires at the end of the target's next turn.", bonus: 0, effect: "guard", target: "ally", value: 5, failureEffect: "lose-shield", failureValue: 3 },
    { id: "bc-temper", name: "Temper Armor", description: "All living allies, including yourself, gain 2 shield; expires at the end of each target's next turn.", bonus: 0, effect: "support", target: "all-allies", value: 2, supportType: "shield", failureEffect: "team-damage", failureValue: 1 },
    { id: "bc-march", name: "Fortified March", description: "All living allies, including yourself, gain 3 shield; expires at the end of each target's next turn.", bonus: 0, effect: "support", target: "all-allies", value: 3, supportType: "shield", failureEffect: "team-damage", failureValue: 2 }
  ],
  "Sable Fen": [
    { id: "sf-favor", name: "Favorable Omen", description: "One living ally, including yourself, plays their next card during their next turn for 0 pity; expires at the end of that turn, and after its third use enters the graveyard.", bonus: 0, effect: "support", target: "ally", value: 2, supportType: "zero-pity", failureEffect: "self-damage", failureValue: 1 },
    { id: "sf-hex", name: "Dark Omen", description: "One living enemy gets -3 on their next d20; expires at the end of the target's next turn.", bonus: 0, effect: "support", target: "enemy", value: 3, supportType: "enemy-dice", failureEffect: "team-damage", failureValue: 1 },
    { id: "sf-stolen", name: "Stolen Moment", description: "Cancel one living enemy's next turn. Their effects expire normally when that turn ends.", bonus: 0, effect: "support", target: "enemy", value: 1, supportType: "skip-enemy", failureEffect: "team-damage", failureValue: 2 }
  ],
  "Kael Rook": [
    { id: "kr-riposte", name: "Riposte", description: "Deal 5 damage to one living enemy (6 while Kael has no shield).", bonus: 0, effect: "damage", target: "enemy", value: 5, failureEffect: "self-damage", failureValue: 2 },
    { id: "kr-duel", name: "Challenge", description: "Deal 4 damage to one living enemy (5 while Kael has no shield).", bonus: 0, effect: "damage", target: "enemy", value: 4, failureEffect: "lose-shield", failureValue: 3 },
    { id: "kr-break", name: "Break Stance", description: "Remove one living enemy's attack and d20 buffs, then destroy up to 3 shield.", bonus: 0, effect: "support", target: "enemy", value: 3, supportType: "dispel-enemy", failureEffect: "self-damage", failureValue: 1 }
  ],
  "Ione Mire": [
    { id: "im-command", name: "Attack Order", description: "All living allies, including yourself, gain +2 attack damage; expires at the end of each target's next turn.", bonus: 0, effect: "support", target: "all-allies", value: 2, supportType: "attack", failureEffect: "team-damage", failureValue: 1 },
    { id: "im-focus", name: "Focus Order", description: "All living allies, including yourself, gain +2 d20; expires at the end of each target's next turn.", bonus: 0, effect: "support", target: "all-allies", value: 2, supportType: "dice", failureEffect: "self-damage", failureValue: 1 },
    { id: "im-purge", name: "Tactical Purge", description: "Move 1 random card from an enemy hand to graveyard for 2 phases, then to discard pile; after its third use, this card enters Ione's graveyard.", bonus: 0, effect: "support", target: "enemy", value: 2, supportType: "purge-card", failureEffect: "self-damage", failureValue: 2 }
  ],
  "Dagan Flint": [
    { id: "df-none", name: "None Left Standing", description: "Deal 3 damage to every living enemy (4 while Dagan is at half HP).", bonus: 0, effect: "aoe", target: "all-enemies", value: 3, failureEffect: "self-damage", failureValue: 2 },
    { id: "df-cleave", name: "Cleave", description: "Deal 5 damage to one living enemy (6 while Dagan is at half HP).", bonus: 0, effect: "damage", target: "enemy", value: 5, failureEffect: "self-damage", failureValue: 3 },
    { id: "df-frenzy", name: "Blood Frenzy", description: "Gain +3 attack damage; expires at the end of your next turn.", bonus: 0, effect: "support", target: "self", value: 3, supportType: "attack", failureEffect: "self-damage", failureValue: 2 }
  ]
};

export const PHASE_FIVE_CARD_UPGRADES = {
  "lost-momentum": "heavy",
  "broken-plan": "brace",
  "empty-gesture": "second-wind"
} as const;

const COMMON_ACTION_CARDS: CardWithoutPity[] = [
  { id: "slash", name: "Slash", description: "Deal 3 damage to one living enemy.", bonus: 0, effect: "damage", target: "enemy", value: 3, unique: false },
  { id: "heavy", name: "Heavy Blow", description: "Deal 4 damage to one living enemy.", bonus: 0, effect: "damage", target: "enemy", value: 4, unique: false },
  { id: "brace", name: "Brace", description: "Gain 3 shield; expires at the end of your next turn.", bonus: 0, effect: "guard", target: "self", value: 3, unique: false },
  { id: "second-wind", name: "Second Wind", description: "Restore 4 HP to yourself; cannot revive.", bonus: 0, effect: "heal", target: "self", value: 4, unique: false },
  { id: "empty-gesture", name: "Empty Gesture", description: "No effect; upgrades to a heal card after phase 5.", bonus: 0, effect: "none", target: "self", value: 0, unique: false },
  { id: "broken-plan", name: "Broken Plan", description: "No effect; upgrades to a shield card after phase 5.", bonus: 0, effect: "none", target: "self", value: 0, unique: false },
  { id: "lost-momentum", name: "Lost Momentum", description: "No effect; upgrades to a heavy attack card after phase 5.", bonus: 0, effect: "none", target: "self", value: 0, unique: false }
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
  { id: "arena", name: "Oathbound Arena", region: "The final battle line", weather: "No retreat", objective: "Defeat the enemy team by phase 30.", threat: "The opposing team", accent: "#d4b56e", sceneClass: "scene-arena" }
];

export const STORY_BEATS = [
  "Two teams enter; one leaves.",
  "A warrior chooses the next target.",
  "HP and shield decide who stands.",
  "Defeat the enemy or fall.",
  "Phase 30 approaches."
];

export const EVENTS = [
  "Battlefield event",
  "Sudden chaos",
  "Escalating curse",
  "Mysterious supplies",
  "Shaking ground"
];
