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
  { id: "stand", name: "Stand as One", type: "Spirit", description: "Link your oaths. Safer for the realm; both teams benefit.", bonus: 3, risk: 0 },
  { id: "flank", name: "Through the Ruin", type: "Wit", description: "Split the party and strike from the forgotten passage.", bonus: 5, risk: 3 },
  { id: "bargain", name: "A Dangerous Bargain", type: "Spirit", description: "Offer the warden a secret. High influence, uncertain cost.", bonus: 6, risk: 5 },
  { id: "force", name: "Break Their Line", type: "Might", description: "Meet steel with steel before the storm closes in.", bonus: 4, risk: 4 },
  { id: "scout", name: "Read the Ash", type: "Wit", description: "Search for signs and lower the next chapter's target.", bonus: 2, risk: 1 }
];

export const REALMS: Realm[] = [
  { id: "moonfall", name: "Moonfall Citadel", region: "The Weeping March", weather: "Black rain", objective: "Seal the starless gate before the fifth bell.", threat: "The Hollow Warden", accent: "#a8c6d1", sceneClass: "scene-moonfall" },
  { id: "embercrag", name: "Embercrag Bastion", region: "The Glass Frontier", weather: "Cinder wind", objective: "Recover the furnace-heart before the mountain wakes.", threat: "The Ashen Choir", accent: "#d4935a", sceneClass: "scene-ember" },
  { id: "fogvale", name: "Fogvale Abbey", region: "The Drowned Lowlands", weather: "Living fog", objective: "Name the saint buried beneath the drowned cloister.", threat: "The Bell Without a Tongue", accent: "#84afa2", sceneClass: "scene-fog" }
];

export const STORY_BEATS = [
  "A procession of empty armor kneels across the old bridge. Each helm turns as your divided company approaches.",
  "The road ends at a chapel built upside-down into the cliff. Something inside knows every hero's true name.",
  "A wounded courier offers two seals: one can save the valley, the other can secure a team's victory.",
  "The dead river begins to flow uphill. Beneath its surface, an army marches toward tomorrow.",
  "At the final gate, the rival banners must share one key—or decide who will carry the crown beyond it."
];

export const EVENTS = [
  "World Event · The moon loses a sliver",
  "World Event · A forgotten oath awakens",
  "World Event · The enemy hears your plans",
  "World Event · The road changes behind you",
  "World Event · Dawn arrives one hour early"
];
