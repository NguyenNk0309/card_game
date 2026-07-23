export type TeamId = "veil" | "ember";
export type CardEffect = "check" | "heal" | "damage" | "guard" | "support";
export type CardTarget = "none" | "self" | "ally" | "enemy" | "any";

export type Hero = {
  id: string;
  name: string;
  title: string;
  role: string;
  skill: string;
  skillText: string;
  hp: number;
  maxHp: number;
  team: TeamId;
  color: string;
  initials: string;
  isYou?: boolean;
};

export type ActionCard = {
  id: string;
  name: string;
  type: "Might" | "Wit" | "Spirit";
  description: string;
  bonus: number;
  risk: number;
  effect: CardEffect;
  target: CardTarget;
  value: number;
  unique: boolean;
};

export type CharacterOption = {
  hero: Hero;
  skillDeck: ActionCard[];
};

export type PlayerSession = {
  id: string;
  displayName: string;
  ready: boolean;
  joinedAt: number;
  hero: Hero;
  skillDeck: ActionCard[];
};

export type GameOutcome = {
  success: boolean;
  total: number;
  target: number;
  label: string;
  detail?: string;
};

export type PlayerRunState = {
  sessionId: string;
  hp: number;
  maxHp: number;
  shield: number;
  drawPile: string[];
  hand: string[];
  discardPile: string[];
};

export type SyncedGameState = {
  adventure: Adventure;
  activePlayerIndex: number;
  completedTurns: number;
  roll: number | null;
  outcome: GameOutcome | null;
  playerStates: Record<string, PlayerRunState>;
  turnStartedAt: number;
  turnDeadline: number;
  turnSeconds: number;
  maxTurns: number;
  ended: boolean;
  endReason: string | null;
};

export type SharedRoomState = {
  players: PlayerSession[];
  phase: "lobby" | "game";
  game: SyncedGameState | null;
  revision: number;
};

export type Realm = {
  id: string;
  name: string;
  region: string;
  weather: string;
  objective: string;
  threat: string;
  accent: string;
  sceneClass: string;
};

export type Adventure = {
  seed: string;
  realm: Realm;
  chapter: number;
  maxChapters: number;
  story: string;
  event: string;
  target: number;
  worldDoom: number;
  veilInfluence: number;
  emberInfluence: number;
};
