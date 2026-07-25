import type { ActionCard, Hero, Realm } from "@/shared/types";

export const HERO_TEMPLATES: Omit<Hero, "id" | "team" | "isYou">[] = [
  { name: "Elara Voss", title: "The Undying Lantern", role: "Warden", classId: "warden", className: "Tactical Warden", passiveName: "United Front", passiveText: "Every Support card Elara plays gains 1 additional point of effect.", skill: "Stand Together", skillText: "Increase the next attack damage of every living ally.", summary: "A flexible warden who makes the entire team more consistent.", strength: "Strong team buffs, ally shields, and turn-order control.", weakness: "Low direct damage.", impact: "Turns allied attacks into finishing blows and moves the right ally forward.", hp: 10, maxHp: 10, color: "#d5b56b", initials: "EV" },
  { name: "Thorne Vale", title: "The Final Arrow", role: "Ranger", classId: "ranger", className: "Ranger", passiveName: "Deadeye", passiveText: "Single-target attacks deal 1 additional damage.", skill: "Marked Arrow", skillText: "A precise shot that deals heavy damage.", summary: "A ranger built to eliminate one enemy at a time.", strength: "Reliable single-target damage.", weakness: "Few defensive tools.", impact: "Quickly removes the most dangerous enemy from battle.", hp: 9, maxHp: 9, color: "#82a88a", initials: "TV" },
  { name: "Mira Ash", title: "The Cinder Blade", role: "Mage", classId: "mage", className: "AOE Mage", passiveName: "Spreading Flame", passiveText: "Every AOE attack deals 1 additional damage to each target.", skill: "Inferno", skillText: "Burn the entire enemy team.", summary: "A fragile mage with the strongest area damage.", strength: "Powerful AOE pressure against the whole enemy team.", weakness: "Low HP and little defense.", impact: "Shortens battles by weakening every opponent at once.", hp: 7, maxHp: 7, color: "#bd705c", initials: "MA" },
  { name: "Brother Orren", title: "The Burden Bearer", role: "Healer", classId: "healer", className: "Restoration Cleric", passiveName: "Enduring Grace", passiveText: "Orren's Heal cards restore 2 additional HP to the chosen ally.", skill: "Prayer of Life", skillText: "Restore a large amount of HP to an ally in danger.", summary: "A cleric who preserves team HP through direct and team-wide healing.", strength: "Saves wounded allies and restores the whole team.", weakness: "Only one special attack card.", impact: "Keeps allies alive and helps win the total-HP tiebreaker on turn 30.", hp: 11, maxHp: 11, color: "#789bad", initials: "BO" },
  { name: "Nyx Calder", title: "The Blade in Shadow", role: "Assassin", classId: "assassin", className: "Assassin", passiveName: "Armor Pierce", passiveText: "Every Nyx attack ignores all shield.", skill: "Quiet Knife", skillText: "Strike directly through an enemy's shield.", summary: "An assassin who finishes protected targets.", strength: "Ignores shield and delivers fast burst damage.", weakness: "Low HP and no special healing.", impact: "Breaks defensive plans and prevents enemies from stalling with shield.", hp: 8, maxHp: 8, color: "#9a83b7", initials: "NC" },
  { name: "Bram Coalhand", title: "The Red-Coal Bulwark", role: "Tank", classId: "tank", className: "Tank", passiveName: "Tempered Steel", passiveText: "Bram's Guard cards create 2 additional shield for the chosen ally.", skill: "Living Fortress", skillText: "Create a large shield for one ally.", summary: "A durable protector who can cover any ally.", strength: "High HP and powerful ally shielding.", weakness: "Low damage.", impact: "Keeps a key teammate alive and prevents a team wipe.", hp: 13, maxHp: 13, color: "#c98b58", initials: "BC" },
  { name: "Sable Fen", title: "The Eye of the Storm", role: "Oracle", classId: "oracle", className: "Oracle", passiveName: "Forewarned", passiveText: "Sable's team takes 1 less damage from world events.", skill: "Blood Omen", skillText: "Increase the next attack damage of every living ally.", summary: "An oracle who controls tempo and reduces event damage.", strength: "Protects the team from events and applies strong buffs or debuffs.", weakness: "Low HP.", impact: "Makes turns 5, 10, 15, and later world events less dangerous.", hp: 7, maxHp: 7, color: "#6aa8a5", initials: "SF" },
  { name: "Kael Rook", title: "The Challenger", role: "Duelist", classId: "duelist", className: "Duelist", passiveName: "No Guard", passiveText: "While Kael has no shield, attacks deal 1 additional damage.", skill: "Riposte", skillText: "A devastating single-target attack.", summary: "A pure attacker who is strongest without protection.", strength: "Sustained burst damage.", weakness: "No special healing or buffs.", impact: "Forces the enemy team to deal with Kael quickly.", hp: 9, maxHp: 9, color: "#a96161", initials: "KR" },
  { name: "Ione Mire", title: "The Oathkeeper", role: "Support", classId: "support", className: "Commander", passiveName: "Commanding Voice", passiveText: "Every Support buff Ione applies gains 1 additional point.", skill: "Attack Order", skillText: "Increase the next attack damage of the whole team.", summary: "A buff specialist who makes allies stronger over several turns.", strength: "Attack and d20 buffs plus enemy dispelling.", weakness: "Low personal damage.", impact: "Amplifies the entire team instead of securing kills alone.", hp: 8, maxHp: 8, color: "#bd9f76", initials: "IM" },
  { name: "Dagan Flint", title: "Blood of the Front Line", role: "Berserker", classId: "berserker", className: "Berserker", passiveName: "Pain Makes Power", passiveText: "At half HP or lower, attacks deal 1 additional damage.", skill: "None Left Standing", skillText: "A powerful AOE attack when Dagan is wounded.", summary: "A warrior who becomes more dangerous as HP falls.", strength: "High HP and strong late-fight damage.", weakness: "Vulnerable to focused finishing attacks at low HP.", impact: "Punishes enemies for trying to wear Dagan down.", hp: 12, maxHp: 12, color: "#768493", initials: "DF" }
];

type CharacterSkillCard = Omit<ActionCard, "unique">;

export const CHARACTER_SKILL_CARDS: Record<string, CharacterSkillCard[]> = {
  "Elara Voss": [
    { id: "ev-stand", name: "Stand Together", type: "Spirit", description: "All living allies gain +2 damage on their next attack; Elara's passive raises this to +3.", bonus: 4, effect: "support", target: "all-allies", value: 2, supportType: "attack" },
    { id: "ev-ward", name: "Lantern Ward", type: "Spirit", description: "Choose a living ally to gain 4 shield; Elara may target herself.", bonus: 4, effect: "guard", target: "ally", value: 4 },
    { id: "ev-command", name: "Forward Command", type: "Spirit", description: "Choose another living ally and move their turn directly after Elara's.", bonus: 4, effect: "support", target: "ally", value: 1, supportType: "advance-ally" }
  ],
  "Thorne Vale": [
    { id: "tv-mark", name: "Marked Arrow", type: "Wit", description: "Deal 4 damage; the Ranger passive increases this to 5.", bonus: 5, effect: "damage", target: "enemy", value: 4 },
    { id: "tv-pierce", name: "Piercing Arrow", type: "Wit", description: "Deal 3 damage and ignore all shield.", bonus: 4, effect: "damage", target: "enemy", value: 3, ignoresShield: true },
    { id: "tv-volley", name: "Arrow Volley", type: "Might", description: "Deal 2 damage to every living enemy.", bonus: 4, effect: "aoe", target: "all-enemies", value: 2 }
  ],
  "Mira Ash": [
    { id: "ma-inferno", name: "Inferno", type: "Might", description: "Deal 3 AOE damage; Mira's passive raises this to 4. On failure, her entire team takes 1 damage.", bonus: 4, effect: "aoe", target: "all-enemies", value: 3, failureEffect: "team-damage", failureValue: 1 },
    { id: "ma-comet", name: "Ash Comet", type: "Wit", description: "Deal 2 AOE damage that ignores shield.", bonus: 5, effect: "aoe", target: "all-enemies", value: 2, ignoresShield: true },
    { id: "ma-rekindle", name: "Rekindle", type: "Spirit", description: "Choose a living ally and restore 4 HP; this cannot revive a defeated player.", bonus: 4, effect: "heal", target: "ally", value: 4 }
  ],
  "Brother Orren": [
    { id: "bo-prayer", name: "Prayer of Life", type: "Spirit", description: "Choose a living ally and restore 5 HP; Orren's passive raises this to 7 HP.", bonus: 4, effect: "heal", target: "ally", value: 5 },
    { id: "bo-blessing", name: "Blessing", type: "Spirit", description: "Immediately restore 2 HP to every living ally.", bonus: 4, effect: "support", target: "all-allies", value: 2, supportType: "healing" },
    { id: "bo-smite", name: "Smite", type: "Might", description: "Deal 3 damage to one enemy.", bonus: 5, effect: "damage", target: "enemy", value: 3 }
  ],
  "Nyx Calder": [
    { id: "nc-knife", name: "Quiet Knife", type: "Wit", description: "Deal 4 damage; the Assassin passive always ignores shield.", bonus: 5, effect: "damage", target: "enemy", value: 4 },
    { id: "nc-execute", name: "Execute", type: "Might", description: "Deal 5 damage through shield. On failure, Nyx takes 3 damage.", bonus: 3, effect: "damage", target: "enemy", value: 5, ignoresShield: true, failureEffect: "self-damage", failureValue: 3 },
    { id: "nc-delay", name: "Misdirection", type: "Wit", description: "Choose an enemy and move their upcoming turn to the end of the queue.", bonus: 4, effect: "support", target: "enemy", value: 1, supportType: "delay-enemy" }
  ],
  "Bram Coalhand": [
    { id: "bc-fortress", name: "Living Fortress", type: "Might", description: "Choose a living ally to gain 5 shield; Bram's passive raises this to 7.", bonus: 4, effect: "guard", target: "ally", value: 5 },
    { id: "bc-temper", name: "Temper Armor", type: "Spirit", description: "Immediately grant 2 shield to every living ally.", bonus: 4, effect: "support", target: "all-allies", value: 2, supportType: "shield" },
    { id: "bc-hammer", name: "Hammer Blow", type: "Might", description: "Deal 3 damage to one enemy.", bonus: 4, effect: "damage", target: "enemy", value: 3 }
  ],
  "Sable Fen": [
    { id: "sf-omen", name: "Blood Omen", type: "Wit", description: "All living allies gain +2 damage on their next attack.", bonus: 4, effect: "support", target: "all-allies", value: 2, supportType: "attack" },
    { id: "sf-mist", name: "Restoring Mist", type: "Spirit", description: "Choose a living ally and restore 3 HP; this cannot revive a defeated player.", bonus: 5, effect: "heal", target: "ally", value: 3 },
    { id: "sf-hex", name: "Dark Omen", type: "Wit", description: "Choose an enemy; they suffer -3 to their d20 result on their next turn.", bonus: 4, effect: "support", target: "enemy", value: 3, supportType: "enemy-dice" }
  ],
  "Kael Rook": [
    { id: "kr-riposte", name: "Riposte", type: "Might", description: "Deal 5 damage; while Kael has no shield this becomes 6. On failure, Kael takes 2 damage.", bonus: 4, effect: "damage", target: "enemy", value: 5, failureEffect: "self-damage", failureValue: 2 },
    { id: "kr-duel", name: "Challenge", type: "Might", description: "Deal 4 damage to one enemy.", bonus: 5, effect: "damage", target: "enemy", value: 4 },
    { id: "kr-sweep", name: "Sweeping Blade", type: "Might", description: "Deal 2 damage to every living enemy.", bonus: 4, effect: "aoe", target: "all-enemies", value: 2 }
  ],
  "Ione Mire": [
    { id: "im-command", name: "Attack Order", type: "Spirit", description: "All living allies gain +2 damage on their next attack; Ione's passive raises this to +3.", bonus: 4, effect: "support", target: "all-allies", value: 2, supportType: "attack" },
    { id: "im-aegis", name: "Focus Order", type: "Spirit", description: "All living allies gain +2 to their next d20 result; Ione's passive raises this to +3.", bonus: 4, effect: "support", target: "all-allies", value: 2, supportType: "dice" },
    { id: "im-break", name: "Break Command", type: "Wit", description: "Choose an enemy; remove their attack and d20 buffs and destroy up to 3 shield.", bonus: 4, effect: "support", target: "enemy", value: 3, supportType: "dispel-enemy" }
  ],
  "Dagan Flint": [
    { id: "df-none", name: "None Left Standing", type: "Might", description: "Deal 3 AOE damage; at half HP or lower this becomes 4. On failure, Dagan takes 2 damage.", bonus: 4, effect: "aoe", target: "all-enemies", value: 3, failureEffect: "self-damage", failureValue: 2 },
    { id: "df-cleave", name: "Cleave", type: "Might", description: "Deal 5 damage. On failure, Dagan takes 2 damage.", bonus: 4, effect: "damage", target: "enemy", value: 5, failureEffect: "self-damage", failureValue: 2 },
    { id: "df-blood", name: "Blood Bond", type: "Spirit", description: "Choose a living ally and restore 3 HP; Dagan may target himself.", bonus: 4, effect: "heal", target: "ally", value: 3 }
  ]
};

export const ACTION_CARDS: ActionCard[] = [
  { id: "slash", name: "Slash", type: "Might", description: "Deal 3 damage to one enemy; shield absorbs damage before HP.", bonus: 4, effect: "damage", target: "enemy", value: 3, unique: false },
  { id: "heavy", name: "Heavy Blow", type: "Might", description: "Deal 4 damage. On failure, the user takes 1 damage.", bonus: 3, effect: "damage", target: "enemy", value: 4, failureEffect: "self-damage", failureValue: 1, unique: false },
  { id: "brace", name: "Brace", type: "Spirit", description: "Grant yourself 3 shield.", bonus: 5, effect: "guard", target: "self", value: 3, unique: false },
  { id: "iron-wall", name: "Iron Wall", type: "Might", description: "Grant yourself 5 shield. On failure, lose up to 2 existing shield.", bonus: 3, effect: "guard", target: "self", value: 5, failureEffect: "lose-shield", failureValue: 2, unique: false },
  { id: "second-wind", name: "Second Wind", type: "Spirit", description: "Restore 4 HP to yourself; this cannot revive you after defeat.", bonus: 4, effect: "heal", target: "self", value: 4, unique: false },
  { id: "empty-gesture", name: "Empty Gesture", type: "Spirit", description: "This card has no gameplay effect. Playing it only cycles it out of your hand.", bonus: 0, effect: "none", target: "self", value: 0, unique: false },
  { id: "broken-plan", name: "Broken Plan", type: "Wit", description: "This card has no gameplay effect. Playing it only cycles it out of your hand.", bonus: 0, effect: "none", target: "self", value: 0, unique: false },
  { id: "lost-momentum", name: "Lost Momentum", type: "Might", description: "This card has no gameplay effect. Playing it only cycles it out of your hand.", bonus: 0, effect: "none", target: "self", value: 0, unique: false },
  { id: "hesitation", name: "Hesitation", type: "Wit", description: "This card has no gameplay effect. Playing it only cycles it out of your hand.", bonus: 0, effect: "none", target: "self", value: 0, unique: false },
  { id: "false-start", name: "False Start", type: "Might", description: "This card has no gameplay effect. Playing it only cycles it out of your hand.", bonus: 0, effect: "none", target: "self", value: 0, unique: false }
];

export const REALMS: Realm[] = [
  { id: "arena", name: "Oathbound Arena", region: "The final battle line", weather: "No retreat", objective: "Defeat the entire opposing team before or on turn 30.", threat: "The opposing team", accent: "#d4b56e", sceneClass: "scene-arena" }
];

export const STORY_BEATS = [
  "Two teams face each other. Only one can leave the arena.",
  "Steel rings as a warrior chooses the next target.",
  "HP and shield decide who remains standing after this turn.",
  "There are no side quests: defeat the enemy or be defeated.",
  "Every card played moves the battle closer to the judgment on turn 30."
];

export const EVENTS = [
  "Battlefield event",
  "Sudden chaos",
  "Escalating curse",
  "Mysterious supplies",
  "Shaking ground"
];
