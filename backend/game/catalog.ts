import type { ActionCard, Hero, Realm } from "@/shared/types";

export const HERO_TEMPLATES: Omit<Hero, "id" | "team" | "isYou">[] = [
  { name: "Elara Voss", title: "The Lantern-Bound", role: "Warden", skill: "Stand Together", skillText: "Reduce Doom while steadying the whole company.", summary: "A flexible protector who keeps wounded allies standing.", strength: "Reliable healing, guarding, and Doom control.", weakness: "Lower direct damage than dedicated fighters.", impact: "Elara prevents one bad round from becoming a party collapse.", hp: 9, maxHp: 9, color: "#d5b56b", initials: "EV" },
  { name: "Thorne Vale", title: "Last of the Briar", role: "Ranger", skill: "Marked Trail", skillText: "Make a precise, low-risk Wit check to advance the oath.", summary: "A careful scout who finds safe routes through dangerous events.", strength: "Consistent checks and accurate ranged pressure.", weakness: "Average protection and limited emergency healing.", impact: "Thorne lowers the chance that exploration turns feed World Doom.", hp: 8, maxHp: 8, color: "#82a88a", initials: "TV" },
  { name: "Mira Ash", title: "Cinder-Tongued", role: "Arcanist", skill: "Borrowed Flame", skillText: "Unleash the highest-damage spell at serious risk.", summary: "A fragile spellcaster built for explosive turns.", strength: "The highest bonuses and burst damage in the roster.", weakness: "Lowest health and several dangerous failure risks.", impact: "Mira can swing a rivalry quickly, but needs allies to protect her.", hp: 6, maxHp: 6, color: "#bd705c", initials: "MA" },
  { name: "Brother Orren", title: "The Unshriven", role: "Votary", skill: "Shared Burden", skillText: "Restore a large amount of health to an ally.", summary: "A durable healer who carries the company's wounds.", strength: "Powerful healing, shields, and safe support cards.", weakness: "His unique deck has almost no offensive pressure.", impact: "Orren lets aggressive allies survive long enough to finish the run.", hp: 10, maxHp: 10, color: "#789bad", initials: "BO" },
  { name: "Nyx Calder", title: "Whisper in Iron", role: "Scoundrel", skill: "Quiet Knife", skillText: "Strike through shields with a precise Wit attack.", summary: "A risky infiltrator who punishes protected rival heroes.", strength: "High Wit bonuses and shield-piercing damage.", weakness: "Low health and an expensive high-risk finisher.", impact: "Nyx breaks defensive stalemates and pressures the rival banner.", hp: 7, maxHp: 7, color: "#9a83b7", initials: "NC" },
  { name: "Bram Coalhand", title: "Oathbreaker Smith", role: "Bulwark", skill: "Hold the Line", skillText: "Give an ally the largest shield in the roster.", summary: "The toughest front-line guardian in the company.", strength: "Highest health and exceptional shield values.", weakness: "Lower card bonuses make difficult checks unreliable.", impact: "Bram absorbs pressure so fragile specialists can take risky turns.", hp: 12, maxHp: 12, color: "#c98b58", initials: "BC" },
  { name: "Sable Fen", title: "Marsh-Seer", role: "Oracle", skill: "A Glimpse Ahead", skillText: "Attempt the strongest pure world check.", summary: "A fragile oracle who controls objectives and the pace of Doom.", strength: "Excellent checks, support, and flexible protection.", weakness: "Very low health and modest direct damage.", impact: "Sable makes hard chapters safer if the party keeps her alive.", hp: 6, maxHp: 6, color: "#6aa8a5", initials: "SF" },
  { name: "Kael Rook", title: "Bannerless", role: "Duelist", skill: "Riposte", skillText: "Counterattack for heavy rival damage.", summary: "An aggressive duelist who thrives on dangerous exchanges.", strength: "Repeated high damage with useful self-protection.", weakness: "High total risk and little party-wide support.", impact: "Kael forces the opposing team to react instead of building safely.", hp: 8, maxHp: 8, color: "#a96161", initials: "KR" },
  { name: "Ione Mire", title: "Keeper of Names", role: "Chronicler", skill: "True Account", skillText: "Resolve a dependable check with almost no risk.", summary: "A tactical chronicler who keeps the adventure moving.", strength: "Safe checks, Doom reduction, and adaptable utility.", weakness: "Low health and weak direct attacks.", impact: "Ione creates steady progress when the party cannot afford failure.", hp: 7, maxHp: 7, color: "#bd9f76", initials: "IM" },
  { name: "Dagan Flint", title: "Grave Company", role: "Vanguard", skill: "No One Left", skillText: "Hit hard while drawing danger away from allies.", summary: "A resilient vanguard who mixes damage with protection.", strength: "High health, strong attacks, and durable shields.", weakness: "Weak healing and lower bonuses on utility actions.", impact: "Dagan anchors the front line and keeps pressure on rival heroes.", hp: 11, maxHp: 11, color: "#768493", initials: "DF" }
];

type CharacterSkillCard = Omit<ActionCard, "unique">;

export const CHARACTER_SKILL_CARDS: Record<string, CharacterSkillCard[]> = {
  "Elara Voss": [
    { id: "ev-stand-together", name: "Stand Together", type: "Spirit", description: "Steady every oath and reduce World Doom by 2.", bonus: 5, risk: 1, effect: "support", target: "none", value: 2 },
    { id: "ev-lantern-ward", name: "Lantern Ward", type: "Might", description: "Wrap an ally in lantern-light for 3 shield.", bonus: 5, risk: 1, effect: "guard", target: "ally", value: 3 },
    { id: "ev-guiding-light", name: "Guiding Light", type: "Spirit", description: "Restore 3 health to a wounded ally.", bonus: 4, risk: 1, effect: "heal", target: "ally", value: 3 },
    { id: "ev-oath-at-dusk", name: "Oath at Dusk", type: "Wit", description: "Risk the lantern's secret on a powerful world check.", bonus: 6, risk: 4, effect: "check", target: "none", value: 0 },
    { id: "ev-hold-the-breach", name: "Hold the Breach", type: "Might", description: "Drive a rival from the breach for 3 damage.", bonus: 4, risk: 3, effect: "damage", target: "enemy", value: 3 }
  ],
  "Thorne Vale": [
    { id: "tv-marked-trail", name: "Marked Trail", type: "Wit", description: "Find a safe route through the current world event.", bonus: 6, risk: 1, effect: "check", target: "none", value: 0 },
    { id: "tv-briar-shot", name: "Briar Shot", type: "Wit", description: "Pin a rival with a precise shot for 3 damage.", bonus: 5, risk: 2, effect: "damage", target: "enemy", value: 3 },
    { id: "tv-hidden-path", name: "Hidden Path", type: "Spirit", description: "Guide the company around danger and reduce Doom by 2.", bonus: 5, risk: 2, effect: "support", target: "none", value: 2 },
    { id: "tv-thornsnare", name: "Thornsnare", type: "Might", description: "Protect an ally with a living barrier worth 3 shield.", bonus: 4, risk: 2, effect: "guard", target: "ally", value: 3 },
    { id: "tv-last-arrow", name: "Last Arrow", type: "Might", description: "Spend the ranger's final arrow for 3 damage.", bonus: 4, risk: 3, effect: "damage", target: "enemy", value: 3 }
  ],
  "Mira Ash": [
    { id: "ma-borrowed-flame", name: "Borrowed Flame", type: "Might", description: "Unleash unstable fire for 4 damage.", bonus: 7, risk: 4, effect: "damage", target: "enemy", value: 4 },
    { id: "ma-cinder-veil", name: "Cinder Veil", type: "Spirit", description: "Hide behind hot ash and gain 3 shield.", bonus: 5, risk: 2, effect: "guard", target: "self", value: 3 },
    { id: "ma-ashen-insight", name: "Ashen Insight", type: "Wit", description: "Read the future in flame with exceptional force.", bonus: 6, risk: 3, effect: "check", target: "none", value: 0 },
    { id: "ma-phoenix-spark", name: "Phoenix Spark", type: "Spirit", description: "Restore 3 health to yourself or an ally.", bonus: 4, risk: 1, effect: "heal", target: "ally", value: 3 },
    { id: "ma-wildfire-oath", name: "Wildfire Oath", type: "Might", description: "Let the spell run wild for 4 rival damage.", bonus: 5, risk: 4, effect: "damage", target: "enemy", value: 4 }
  ],
  "Brother Orren": [
    { id: "bo-shared-burden", name: "Shared Burden", type: "Spirit", description: "Take part of an ally's pain and restore 4 health.", bonus: 5, risk: 1, effect: "heal", target: "ally", value: 4 },
    { id: "bo-unshriven-ward", name: "Unshriven Ward", type: "Spirit", description: "Grant an ally 4 shield through stubborn faith.", bonus: 5, risk: 1, effect: "guard", target: "ally", value: 4 },
    { id: "bo-take-the-wound", name: "Take the Wound", type: "Might", description: "Stand between danger and an ally for 3 shield.", bonus: 4, risk: 1, effect: "guard", target: "ally", value: 3 },
    { id: "bo-absolution", name: "Absolution", type: "Wit", description: "Calm the realm and reduce World Doom by 3.", bonus: 5, risk: 2, effect: "support", target: "none", value: 3 },
    { id: "bo-final-litany", name: "Final Litany", type: "Spirit", description: "Trust an old prayer to resolve the world check.", bonus: 4, risk: 2, effect: "check", target: "none", value: 0 }
  ],
  "Nyx Calder": [
    { id: "nc-pierce-quiet-knife", name: "Quiet Knife", type: "Wit", description: "Slip through every shield and deal 3 damage.", bonus: 6, risk: 2, effect: "damage", target: "enemy", value: 3 },
    { id: "nc-false-face", name: "False Face", type: "Wit", description: "Outwit the world with a dangerous disguise.", bonus: 6, risk: 3, effect: "check", target: "none", value: 0 },
    { id: "nc-smoke-bond", name: "Smoke Bond", type: "Spirit", description: "Disappear into smoke and gain 3 shield.", bonus: 5, risk: 2, effect: "guard", target: "self", value: 3 },
    { id: "nc-whispered-pact", name: "Whispered Pact", type: "Spirit", description: "Call in a hidden favor to heal an ally for 3.", bonus: 4, risk: 2, effect: "heal", target: "ally", value: 3 },
    { id: "nc-iron-betrayal", name: "Iron Betrayal", type: "Might", description: "Expose yourself to land a brutal 4-damage strike.", bonus: 5, risk: 4, effect: "damage", target: "enemy", value: 4 }
  ],
  "Bram Coalhand": [
    { id: "bc-hold-the-line", name: "Hold the Line", type: "Might", description: "Forge the strongest defense and give an ally 5 shield.", bonus: 4, risk: 0, effect: "guard", target: "ally", value: 5 },
    { id: "bc-forge-ward", name: "Forge Ward", type: "Might", description: "Give any hero 4 shield, even across team lines.", bonus: 4, risk: 1, effect: "guard", target: "any", value: 4 },
    { id: "bc-hammerfall", name: "Hammerfall", type: "Might", description: "Swing the oath-hammer for 4 rival damage.", bonus: 4, risk: 3, effect: "damage", target: "enemy", value: 4 },
    { id: "bc-tempered-oath", name: "Tempered Oath", type: "Spirit", description: "Reinforce the company and reduce World Doom by 3.", bonus: 4, risk: 1, effect: "support", target: "none", value: 3 },
    { id: "bc-field-repair", name: "Field Repair", type: "Spirit", description: "Patch an ally's wounds and restore 2 health.", bonus: 5, risk: 1, effect: "heal", target: "ally", value: 2 }
  ],
  "Sable Fen": [
    { id: "sf-a-glimpse-ahead", name: "A Glimpse Ahead", type: "Wit", description: "See the safest future with the roster's best check bonus.", bonus: 7, risk: 2, effect: "check", target: "none", value: 0 },
    { id: "sf-marsh-mercy", name: "Marsh Mercy", type: "Spirit", description: "Draw healing mist around an ally for 3 health.", bonus: 5, risk: 1, effect: "heal", target: "ally", value: 3 },
    { id: "sf-fate-ward", name: "Fate Ward", type: "Spirit", description: "Give any chosen hero 3 shield.", bonus: 5, risk: 1, effect: "guard", target: "any", value: 3 },
    { id: "sf-foretold-ruin", name: "Foretold Ruin", type: "Wit", description: "Name a rival's next wound and deal 2 damage.", bonus: 5, risk: 3, effect: "damage", target: "enemy", value: 2 },
    { id: "sf-third-eye", name: "Open the Third Eye", type: "Spirit", description: "Trade certainty for 3 points of Doom reduction.", bonus: 4, risk: 3, effect: "support", target: "none", value: 3 }
  ],
  "Kael Rook": [
    { id: "kr-riposte", name: "Riposte", type: "Might", description: "Counter a rival attack and deal 4 damage.", bonus: 6, risk: 3, effect: "damage", target: "enemy", value: 4 },
    { id: "kr-duelist-stance", name: "Duelist's Stance", type: "Might", description: "Prepare the counterstroke and gain 3 shield.", bonus: 5, risk: 2, effect: "guard", target: "self", value: 3 },
    { id: "kr-bannerless-challenge", name: "Bannerless Challenge", type: "Might", description: "Demand single combat and deal 4 damage.", bonus: 5, risk: 4, effect: "damage", target: "enemy", value: 4 },
    { id: "kr-blood-price", name: "Blood Price", type: "Spirit", description: "Bind your wounds and restore 2 health.", bonus: 4, risk: 2, effect: "heal", target: "self", value: 2 },
    { id: "kr-winning-feint", name: "Winning Feint", type: "Wit", description: "Turn the duel into leverage on the world check.", bonus: 5, risk: 3, effect: "check", target: "none", value: 0 }
  ],
  "Ione Mire": [
    { id: "im-true-account", name: "True Account", type: "Wit", description: "Name what truly happened with almost no risk.", bonus: 6, risk: 1, effect: "check", target: "none", value: 0 },
    { id: "im-rewrite-fate", name: "Rewrite Fate", type: "Spirit", description: "Revise the worst ending and reduce World Doom by 3.", bonus: 5, risk: 2, effect: "support", target: "none", value: 3 },
    { id: "im-name-the-fallen", name: "Name the Fallen", type: "Spirit", description: "Restore an ally's courage and 3 health.", bonus: 5, risk: 1, effect: "heal", target: "ally", value: 3 },
    { id: "im-archive-ward", name: "Archive Ward", type: "Wit", description: "Protect any hero with a remembered defense worth 3 shield.", bonus: 4, risk: 1, effect: "guard", target: "any", value: 3 },
    { id: "im-forbidden-ending", name: "Forbidden Ending", type: "Might", description: "Write a rival out of the scene for 2 damage.", bonus: 5, risk: 3, effect: "damage", target: "enemy", value: 2 }
  ],
  "Dagan Flint": [
    { id: "df-no-one-left", name: "No One Left", type: "Might", description: "Drive into danger and deal 4 damage to a rival.", bonus: 5, risk: 2, effect: "damage", target: "enemy", value: 4 },
    { id: "df-grave-company", name: "Grave Company", type: "Might", description: "Raise the old formation and give an ally 4 shield.", bonus: 4, risk: 1, effect: "guard", target: "ally", value: 4 },
    { id: "df-march-on", name: "March On", type: "Spirit", description: "Force the company forward and reduce World Doom by 2.", bonus: 4, risk: 2, effect: "support", target: "none", value: 2 },
    { id: "df-last-watch", name: "Last Watch", type: "Might", description: "Brace alone and gain 4 shield.", bonus: 4, risk: 1, effect: "guard", target: "self", value: 4 },
    { id: "df-end-the-threat", name: "End the Threat", type: "Might", description: "Commit everything to a 4-damage finishing blow.", bonus: 5, risk: 4, effect: "damage", target: "enemy", value: 4 }
  ]
};

export const ACTION_CARDS: ActionCard[] = [
  { id: "stand", name: "Stand as One", type: "Spirit", description: "Steady the company and reduce World Doom by 3 on success.", bonus: 3, risk: 0, effect: "support", target: "none", value: 3, unique: false },
  { id: "flank", name: "Through the Ruin", type: "Wit", description: "Exploit a forgotten passage and wound a rival for 2.", bonus: 5, risk: 3, effect: "damage", target: "enemy", value: 2, unique: false },
  { id: "bargain", name: "A Dangerous Bargain", type: "Spirit", description: "Risk a secret for a powerful world check and influence.", bonus: 6, risk: 5, effect: "check", target: "none", value: 0, unique: false },
  { id: "force", name: "Break Their Line", type: "Might", description: "Drive an opposing hero back and deal 3 damage.", bonus: 4, risk: 4, effect: "damage", target: "enemy", value: 3, unique: false },
  { id: "scout", name: "Read the Ash", type: "Wit", description: "Read the danger and press the shared objective safely.", bonus: 2, risk: 1, effect: "check", target: "none", value: 0, unique: false },
  { id: "mend", name: "Field Dressing", type: "Spirit", description: "Restore 3 health to yourself or an ally.", bonus: 3, risk: 0, effect: "heal", target: "ally", value: 3, unique: false },
  { id: "guard", name: "Raise the Guard", type: "Might", description: "Give yourself 3 shield against the next attack.", bonus: 3, risk: 1, effect: "guard", target: "self", value: 3, unique: false },
  { id: "rally", name: "Rally the Fallen", type: "Spirit", description: "Restore 2 health and grant 1 shield to an ally.", bonus: 4, risk: 1, effect: "heal", target: "ally", value: 2, unique: false },
  { id: "feint", name: "False Opening", type: "Wit", description: "Bait a rival into danger and deal 2 damage through shields.", bonus: 5, risk: 2, effect: "damage", target: "enemy", value: 2, unique: false },
  { id: "ward", name: "Shared Ward", type: "Spirit", description: "Give any hero 2 shield and calm the realm by 1 Doom.", bonus: 3, risk: 0, effect: "guard", target: "any", value: 2, unique: false }
];

export const REALMS: Realm[] = [
  { id: "moonfall", name: "Moonfall Citadel", region: "The Weeping March", weather: "Black rain", objective: "Seal the starless gate before the tenth bell.", threat: "The Hollow Warden", accent: "#a8c6d1", sceneClass: "scene-moonfall" },
  { id: "embercrag", name: "Embercrag Bastion", region: "The Glass Frontier", weather: "Cinder wind", objective: "Recover the furnace-heart before the mountain wakes.", threat: "The Ashen Choir", accent: "#d4935a", sceneClass: "scene-ember" },
  { id: "fogvale", name: "Fogvale Abbey", region: "The Drowned Lowlands", weather: "Living fog", objective: "Name the saint buried beneath the drowned cloister.", threat: "The Bell Without a Tongue", accent: "#84afa2", sceneClass: "scene-fog" }
];

export const STORY_BEATS = [
  "A procession of empty armor kneels across the old bridge. Each helm turns as your divided company approaches.",
  "The road ends at a chapel built upside-down into the cliff. Something inside knows every hero's true name.",
  "A wounded courier offers two seals: one can save the valley, the other can secure a team's victory.",
  "The dead river begins to flow uphill. Beneath its surface, an army marches toward tomorrow.",
  "At the final gate, the rival banners must share one key—or decide who will carry the crown beyond it.",
  "The orchard grows iron fruit overnight. Inside each one waits a memory stolen from a living hero.",
  "A bridge made from sleeping giants crosses the chasm. The safest step may wake the oldest among them.",
  "The company finds its own camp abandoned ten years in the future, with one unfamiliar grave beside the fire.",
  "A masked court offers safe passage if one banner publicly betrays the other before sunset.",
  "The fortress bells answer in a language only the newest hero understands—and the message is a warning."
];

export const EVENTS = [
  "World Event · The moon loses a sliver",
  "World Event · A forgotten oath awakens",
  "World Event · The enemy hears your plans",
  "World Event · The road changes behind you",
  "World Event · Dawn arrives one hour early",
  "World Event · Every shadow points north",
  "World Event · The dead remember their banners",
  "World Event · Iron begins to whisper",
  "World Event · A second moon rises",
  "World Event · The gate demands a name"
];
