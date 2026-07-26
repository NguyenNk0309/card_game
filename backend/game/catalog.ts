import type { ActionCard, Hero, Realm } from "@/shared/types";

export const HERO_TEMPLATES: Omit<Hero, "id" | "team" | "isYou">[] = [
  { name: "Elara Voss", title: "The Undying Lantern", role: "Guardian", classId: "warden", className: "Guardian Warden", passiveName: "United Front", passiveText: "Every Support card Elara plays gains 1 additional point of effect.", skill: "Rallying Aegis", skillText: "Shield the entire allied formation.", summary: "A formation guardian who shields allies and fixes the team's turn order.", strength: "Team shields, rescue turns, and reliable protection.", weakness: "No special attack cards and only moderate personal HP.", impact: "Prevents a damaged formation from collapsing while an attacker prepares the finish.", hp: 11, maxHp: 11, speed: 3, color: "#d5b56b", initials: "EV" },
  { name: "Thorne Vale", title: "The Final Arrow", role: "Ranger", classId: "ranger", className: "Precision Ranger", passiveName: "Deadeye", passiveText: "Single-target attacks deal 1 additional damage.", skill: "Marked Arrow", skillText: "A precise shot that deals heavy damage.", summary: "A focused ranged attacker who marks an ally before finishing one enemy.", strength: "Reliable single-target damage and shield piercing.", weakness: "Low protection and no special healing.", impact: "Removes a priority enemy without supplying broad team defense.", hp: 9, maxHp: 9, speed: 9, color: "#82a88a", initials: "TV" },
  { name: "Mira Ash", title: "The Cinder Blade", role: "Mage", classId: "mage", className: "Area Mage", passiveName: "Spreading Flame", passiveText: "Every AOE attack deals 1 additional damage to each target.", skill: "Inferno", skillText: "Burn the entire enemy team.", summary: "A fragile area specialist who pressures every opponent and disrupts one roll.", strength: "The strongest multi-target pressure.", weakness: "Lowest HP and dangerous spell backlash.", impact: "Softens an entire team so allied finishers can secure eliminations.", hp: 7, maxHp: 7, speed: 5, color: "#bd705c", initials: "MA" },
  { name: "Brother Orren", title: "The Burden Bearer", role: "Healer", classId: "healer", className: "Restoration Cleric", passiveName: "Enduring Grace", passiveText: "Orren's Heal cards restore 2 additional HP to the chosen ally.", skill: "Prayer of Life", skillText: "Restore a large amount of HP to an ally in danger.", summary: "A dedicated healer who restores wounded allies and can prepare one defeated ally to return.", strength: "Highest direct healing and the only delayed revival.", weakness: "No special damage and revival takes two completed turns.", impact: "Forces opponents to finish fights quickly before defeated allies return.", hp: 10, maxHp: 10, speed: 4, color: "#789bad", initials: "BO" },
  { name: "Nyx Calder", title: "The Blade in Shadow", role: "Assassin", classId: "assassin", className: "Saboteur Assassin", passiveName: "Armor Pierce", passiveText: "Every Nyx attack ignores all shield.", skill: "Quiet Knife", skillText: "Strike directly through an enemy's shield.", summary: "A shield-piercing finisher who can temporarily steal a common card.", strength: "Ignores shield and disrupts an enemy hand.", weakness: "Low HP and high backlash on the strongest strike.", impact: "Punishes shield-heavy teams and briefly borrows an enemy option.", hp: 8, maxHp: 8, speed: 10, color: "#9a83b7", initials: "NC" },
  { name: "Bram Coalhand", title: "The Red-Coal Bulwark", role: "Tank", classId: "tank", className: "Bulwark Tank", passiveName: "Tempered Steel", passiveText: "Bram's Guard cards create 2 additional shield for the chosen ally.", skill: "Living Fortress", skillText: "Create a large shield for one ally.", summary: "The toughest protector, carrying three special ways to shield allies.", strength: "Highest HP and strongest single-ally shielding.", weakness: "No special attack, healing, or turn control.", impact: "Keeps one essential teammate alive through concentrated attacks.", hp: 14, maxHp: 14, speed: 1, color: "#c98b58", initials: "BC" },
  { name: "Sable Fen", title: "The Eye of the Storm", role: "Controller", classId: "oracle", className: "Fate Oracle", passiveName: "Second Sight", passiveText: "The first time Sable is defeated, she immediately revives with half of her maximum HP.", skill: "Favorable Omen", skillText: "Improve allied rolls before a difficult target.", summary: "A fate controller who improves allied rolls, curses enemies, cancels one enemy turn, and can return from defeat once.", strength: "Powerful tempo control and a one-time self-revival.", weakness: "Low HP, no special damage, and severe team backlash.", impact: "Changes who succeeds and who gets to act, then bends fate once to survive defeat.", hp: 8, maxHp: 8, speed: 7, color: "#6aa8a5", initials: "SF" },
  { name: "Kael Rook", title: "The Challenger", role: "Duelist", classId: "duelist", className: "Disruptive Duelist", passiveName: "No Guard", passiveText: "While Kael has no shield, attacks deal 1 additional damage.", skill: "Riposte", skillText: "A devastating single-target attack.", summary: "A risky duelist who attacks twice and breaks one enemy's prepared defenses.", strength: "High single-target pressure and buff removal.", weakness: "Strongest without shield and vulnerable to backlash.", impact: "Challenges one prepared enemy and strips their advantage before a follow-up.", hp: 10, maxHp: 10, speed: 8, color: "#a96161", initials: "KR" },
  { name: "Ione Mire", title: "The Oathkeeper", role: "Support", classId: "support", className: "Tactical Commander", passiveName: "Commanding Voice", passiveText: "Ione gains +1 to every d20 result.", skill: "Attack Order", skillText: "Increase the next attack damage of the whole team.", summary: "A pure support commander who buffs allies and moves an ally's no-effect common card to the graveyard.", strength: "Reliable d20 results and strong team-wide preparation.", weakness: "No special damage, shield, or healing.", impact: "Makes every teammate better and permanently refines an allied deck at the right moment.", hp: 9, maxHp: 9, speed: 6, color: "#bd9f76", initials: "IM" },
  { name: "Dagan Flint", title: "Blood of the Front Line", role: "Berserker", classId: "berserker", className: "Blood Berserker", passiveName: "Pain Makes Power", passiveText: "At half HP or lower, attacks deal 1 additional damage.", skill: "None Left Standing", skillText: "A powerful AOE attack when Dagan is wounded.", summary: "A high-HP attacker who builds personal damage and becomes dangerous when wounded.", strength: "Durable pressure and strong low-HP attacks.", weakness: "Self-focused kit with damaging backlash.", impact: "Demands healing judgment: wounded Dagan hits harder but is easier to finish.", hp: 12, maxHp: 12, speed: 2, color: "#768493", initials: "DF" }
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
    { id: "ev-aegis", name: "Rallying Aegis", type: "Spirit", description: "Every living ally, including yourself, gains 2 shield. United Front raises this to 3 shield.", bonus: 0, effect: "support", target: "all-allies", value: 2, supportType: "shield", failureEffect: "team-damage", failureValue: 1 },
    { id: "ev-ward", name: "Lantern Ward", type: "Spirit", description: "Choose one living ally, including yourself. Grant them 4 shield.", bonus: 0, effect: "guard", target: "ally", value: 4, failureEffect: "lose-shield", failureValue: 2 },
    { id: "ev-command", name: "Rescue Formation", type: "Wit", description: "Choose another living ally. Move them directly behind Elara in the turn queue.", bonus: 0, effect: "support", target: "ally", value: 1, supportType: "advance-ally", failureEffect: "self-damage", failureValue: 1 }
  ],
  "Thorne Vale": [
    { id: "tv-mark", name: "Marked Arrow", type: "Wit", description: "Choose one living enemy. Deal 4 damage; Deadeye raises this to 5 damage. Shield absorbs damage before HP.", bonus: 0, effect: "damage", target: "enemy", value: 4, failureEffect: "self-damage", failureValue: 1 },
    { id: "tv-pierce", name: "Piercing Arrow", type: "Wit", description: "Choose one living enemy. Deal 3 damage, ignoring shield; Deadeye raises this to 4 damage.", bonus: 0, effect: "damage", target: "enemy", value: 3, ignoresShield: true, failureEffect: "self-damage", failureValue: 2 },
    { id: "tv-hunt", name: "Hunter's Mark", type: "Spirit", description: "Choose one living ally, including yourself. Their next attack gains +2 damage.", bonus: 0, effect: "support", target: "ally", value: 2, supportType: "attack", failureEffect: "lose-shield", failureValue: 2 }
  ],
  "Mira Ash": [
    { id: "ma-inferno", name: "Inferno", type: "Might", description: "Deal 2 damage to every living enemy; Spreading Flame raises this to 3 damage each. Shield absorbs damage before HP.", bonus: 0, effect: "aoe", target: "all-enemies", value: 2, failureEffect: "team-damage", failureValue: 1 },
    { id: "ma-comet", name: "Ash Comet", type: "Wit", description: "Deal 2 damage to every living enemy, ignoring shield; Spreading Flame raises this to 3 damage each.", bonus: 0, effect: "aoe", target: "all-enemies", value: 2, ignoresShield: true, failureEffect: "self-damage", failureValue: 2 },
    { id: "ma-gravity", name: "Gravity Hex", type: "Wit", description: "Choose one living enemy. Their next d20 result suffers -2.", bonus: 0, effect: "support", target: "enemy", value: 2, supportType: "enemy-dice", failureEffect: "team-damage", failureValue: 1 }
  ],
  "Brother Orren": [
    { id: "bo-prayer", name: "Prayer of Life", type: "Spirit", description: "Choose one living ally, including yourself. Restore up to 4 HP; Enduring Grace raises this to 6 HP. This cannot revive a defeated player.", bonus: 0, effect: "heal", target: "ally", value: 4, failureEffect: "self-damage", failureValue: 1 },
    { id: "bo-blessing", name: "Shared Blessing", type: "Spirit", description: "Every living ally, including yourself, restores up to 2 HP. This cannot revive a defeated player.", bonus: 0, effect: "support", target: "all-allies", value: 2, supportType: "healing", failureEffect: "team-damage", failureValue: 1 },
    { id: "bo-return", name: "Returning Light", type: "Spirit", description: "Choose a defeated ally. After 2 completed turns, they revive with one-third HP. After its first use, this card moves to the graveyard.", bonus: 0, effect: "support", target: "defeated-ally", value: 2, supportType: "revive", failureEffect: "team-damage", failureValue: 2 }
  ],
  "Nyx Calder": [
    { id: "nc-knife", name: "Quiet Knife", type: "Wit", description: "Choose one living enemy. Deal 4 damage, ignoring shield.", bonus: 0, effect: "damage", target: "enemy", value: 4, failureEffect: "self-damage", failureValue: 1 },
    { id: "nc-execute", name: "Execute", type: "Might", description: "Choose one living enemy. Deal 5 damage, ignoring shield.", bonus: 0, effect: "damage", target: "enemy", value: 5, ignoresShield: true, failureEffect: "self-damage", failureValue: 3 },
    { id: "nc-pilfer", name: "Pilfered Chance", type: "Wit", description: "Choose one living enemy. Steal one random common card from their hand until the end of Nyx's next turn.", bonus: 0, effect: "support", target: "enemy", value: 1, supportType: "steal-card", failureEffect: "self-damage", failureValue: 2 }
  ],
  "Bram Coalhand": [
    { id: "bc-fortress", name: "Living Fortress", type: "Might", description: "Choose one living ally, including yourself. Grant them 5 shield; Tempered Steel raises this to 7 shield.", bonus: 0, effect: "guard", target: "ally", value: 5, failureEffect: "lose-shield", failureValue: 3 },
    { id: "bc-temper", name: "Temper Armor", type: "Spirit", description: "Every living ally, including yourself, gains 2 shield.", bonus: 0, effect: "support", target: "all-allies", value: 2, supportType: "shield", failureEffect: "team-damage", failureValue: 1 },
    { id: "bc-march", name: "Fortified March", type: "Might", description: "Every living ally, including yourself, gains 3 shield.", bonus: 0, effect: "support", target: "all-allies", value: 3, supportType: "shield", failureEffect: "team-damage", failureValue: 2 }
  ],
  "Sable Fen": [
    { id: "sf-favor", name: "Favorable Omen", type: "Spirit", description: "Every living ally, including yourself, gains +2 to their next d20 result.", bonus: 0, effect: "support", target: "all-allies", value: 2, supportType: "dice", failureEffect: "self-damage", failureValue: 1 },
    { id: "sf-hex", name: "Dark Omen", type: "Wit", description: "Choose one living enemy. Their next d20 result suffers -3.", bonus: 0, effect: "support", target: "enemy", value: 3, supportType: "enemy-dice", failureEffect: "team-damage", failureValue: 1 },
    { id: "sf-stolen", name: "Stolen Moment", type: "Wit", description: "Choose one living enemy. Cancel their next turn; their hand and active buffs remain unchanged.", bonus: 0, effect: "support", target: "enemy", value: 1, supportType: "skip-enemy", failureEffect: "team-damage", failureValue: 2 }
  ],
  "Kael Rook": [
    { id: "kr-riposte", name: "Riposte", type: "Might", description: "Choose one living enemy. Deal 5 damage; No Guard raises this to 6 damage while Kael has no shield. Shield absorbs damage before HP.", bonus: 0, effect: "damage", target: "enemy", value: 5, failureEffect: "self-damage", failureValue: 2 },
    { id: "kr-duel", name: "Challenge", type: "Might", description: "Choose one living enemy. Deal 4 damage; No Guard raises this to 5 damage while Kael has no shield. Shield absorbs damage before HP.", bonus: 0, effect: "damage", target: "enemy", value: 4, failureEffect: "lose-shield", failureValue: 3 },
    { id: "kr-break", name: "Break Stance", type: "Wit", description: "Choose one living enemy. Remove their attack and d20 buffs, then destroy up to 3 shield.", bonus: 0, effect: "support", target: "enemy", value: 3, supportType: "dispel-enemy", failureEffect: "self-damage", failureValue: 1 }
  ],
  "Ione Mire": [
    { id: "im-command", name: "Attack Order", type: "Spirit", description: "Every living ally, including yourself, gains +2 damage on their next attack.", bonus: 0, effect: "support", target: "all-allies", value: 2, supportType: "attack", failureEffect: "team-damage", failureValue: 1 },
    { id: "im-focus", name: "Focus Order", type: "Spirit", description: "Every living ally, including yourself, gains +2 to their next d20 result.", bonus: 0, effect: "support", target: "all-allies", value: 2, supportType: "dice", failureEffect: "self-damage", failureValue: 1 },
    { id: "im-purge", name: "Tactical Purge", type: "Wit", description: "Choose one living ally, including yourself. Move one of their no-effect common cards to their graveyard. After its third use, Tactical Purge also moves to Ione's graveyard.", bonus: 0, effect: "support", target: "ally", value: 1, supportType: "purge-card", failureEffect: "self-damage", failureValue: 2 }
  ],
  "Dagan Flint": [
    { id: "df-none", name: "None Left Standing", type: "Might", description: "Deal 3 damage to every living enemy; Pain Makes Power raises this to 4 damage each while Dagan is at half HP or lower. Shield absorbs damage before HP.", bonus: 0, effect: "aoe", target: "all-enemies", value: 3, failureEffect: "self-damage", failureValue: 2 },
    { id: "df-cleave", name: "Cleave", type: "Might", description: "Choose one living enemy. Deal 5 damage; Pain Makes Power raises this to 6 damage while Dagan is at half HP or lower. Shield absorbs damage before HP.", bonus: 0, effect: "damage", target: "enemy", value: 5, failureEffect: "self-damage", failureValue: 3 },
    { id: "df-frenzy", name: "Blood Frenzy", type: "Spirit", description: "Dagan gains +3 damage on his next attack.", bonus: 0, effect: "support", target: "self", value: 3, supportType: "attack", failureEffect: "self-damage", failureValue: 2 }
  ]
};

const COMMON_ACTION_CARDS: CardWithoutPity[] = [
  { id: "slash", name: "Slash", type: "Might", description: "Choose one living enemy. Deal 3 damage. Shield absorbs damage before HP.", bonus: 4, effect: "damage", target: "enemy", value: 3, unique: false },
  { id: "heavy", name: "Heavy Blow", type: "Might", description: "Choose one living enemy. Deal 4 damage. Shield absorbs damage before HP.", bonus: 3, effect: "damage", target: "enemy", value: 4, unique: false },
  { id: "brace", name: "Brace", type: "Spirit", description: "Grant yourself 3 shield.", bonus: 5, effect: "guard", target: "self", value: 3, unique: false },
  { id: "second-wind", name: "Second Wind", type: "Spirit", description: "Restore up to 4 HP to yourself. This cannot revive you after defeat.", bonus: 4, effect: "heal", target: "self", value: 4, unique: false },
  { id: "empty-gesture", name: "Empty Gesture", type: "Spirit", description: "This card has no gameplay effect. Playing it only cycles it out of your hand.", bonus: 0, effect: "none", target: "self", value: 0, unique: false },
  { id: "broken-plan", name: "Broken Plan", type: "Wit", description: "This card has no gameplay effect. Playing it only cycles it out of your hand.", bonus: 0, effect: "none", target: "self", value: 0, unique: false },
  { id: "lost-momentum", name: "Lost Momentum", type: "Might", description: "This card has no gameplay effect. Playing it only cycles it out of your hand.", bonus: 0, effect: "none", target: "self", value: 0, unique: false }
];

export const ACTION_CARDS: ActionCard[] = COMMON_ACTION_CARDS.map((card) => ({ ...card, pityCost: calculatePityCost(card) }));

export const REALMS: Realm[] = [
  { id: "arena", name: "Oathbound Arena", region: "The final battle line", weather: "No retreat", objective: "Defeat the entire opposing team before or on phase 30.", threat: "The opposing team", accent: "#d4b56e", sceneClass: "scene-arena" }
];

export const STORY_BEATS = [
  "Two teams face each other. Only one can leave the arena.",
  "Steel rings as a warrior chooses the next target.",
  "HP and shield decide who remains standing after this turn.",
  "There are no side quests: defeat the enemy or be defeated.",
  "Every completed phase moves the battle closer to the judgment at phase 30."
];

export const EVENTS = [
  "Battlefield event",
  "Sudden chaos",
  "Escalating curse",
  "Mysterious supplies",
  "Shaking ground"
];
