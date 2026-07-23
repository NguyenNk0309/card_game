import type { ActionCard, Hero, Realm } from "@/shared/types";

export const HERO_TEMPLATES: Omit<Hero, "id" | "team" | "isYou">[] = [
  { name: "Elara Voss", title: "The Lantern-Bound", role: "Warden", skill: "Stand Together", skillText: "+2 when another hero is wounded.", hp: 9, maxHp: 9, color: "#d5b56b", initials: "EV" },
  { name: "Thorne Vale", title: "Last of the Briar", role: "Ranger", skill: "Marked Trail", skillText: "Reveal the danger on a failed scout.", hp: 8, maxHp: 8, color: "#82a88a", initials: "TV" },
  { name: "Mira Ash", title: "Cinder-Tongued", role: "Arcanist", skill: "Borrowed Flame", skillText: "Turn one die into a 12 each chapter.", hp: 6, maxHp: 6, color: "#bd705c", initials: "MA" },
  { name: "Brother Orren", title: "The Unshriven", role: "Votary", skill: "Shared Burden", skillText: "Take an ally's wound to gain 2 influence.", hp: 10, maxHp: 10, color: "#789bad", initials: "BO" },
  { name: "Nyx Calder", title: "Whisper in Iron", role: "Scoundrel", skill: "Quiet Knife", skillText: "+3 when the team chooses subtlety.", hp: 7, maxHp: 7, color: "#9a83b7", initials: "NC" },
  { name: "Bram Coalhand", title: "Oathbreaker Smith", role: "Bulwark", skill: "Hold the Line", skillText: "Reduce world doom gained by 3.", hp: 12, maxHp: 12, color: "#c98b58", initials: "BC" },
  { name: "Sable Fen", title: "Marsh-Seer", role: "Oracle", skill: "A Glimpse Ahead", skillText: "Reroll the lowest die once per chapter.", hp: 6, maxHp: 6, color: "#6aa8a5", initials: "SF" },
  { name: "Kael Rook", title: "Bannerless", role: "Duelist", skill: "Riposte", skillText: "Gain 2 influence after a risky success.", hp: 8, maxHp: 8, color: "#a96161", initials: "KR" },
  { name: "Ione Mire", title: "Keeper of Names", role: "Chronicler", skill: "True Account", skillText: "A story refresh costs no momentum.", hp: 7, maxHp: 7, color: "#bd9f76", initials: "IM" },
  { name: "Dagan Flint", title: "Grave Company", role: "Vanguard", skill: "No One Left", skillText: "+1 for every hero below half health.", hp: 11, maxHp: 11, color: "#768493", initials: "DF" }
];

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
