export type TeamId = "veil" | "ember";
export type CardEffect = "heal" | "damage" | "aoe" | "guard" | "support" | "none";
export type CardTarget = "self" | "ally" | "defeated-ally" | "all-allies" | "enemy" | "all-enemies" | "player";
export type SupportType =
  | "attack"
  | "shield"
  | "healing"
  | "dice"
  | "enemy-dice"
  | "delay-enemy"
  | "advance-ally"
  | "dispel-enemy"
  | "revive"
  | "skip-enemy"
  | "purge-card"
  | "steal-card";
export type FailureEffect = "self-damage" | "team-damage" | "lose-shield" | "enemy-shield";

export type Hero = {
  id: string;
  name: string;
  title: string;
  role: string;
  classId: string;
  className: string;
  passiveName: string;
  passiveText: string;
  skill: string;
  skillText: string;
  summary: string;
  strength: string;
  weakness: string;
  impact: string;
  hp: number;
  maxHp: number;
  speed: number;
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
  effect: CardEffect;
  target: CardTarget;
  value: number;
  supportType?: SupportType;
  ignoresShield?: boolean;
  failureEffect?: FailureEffect;
  failureValue?: number;
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
  kind?: "card" | "discard" | "skip" | "timeout" | "forced-skip" | "system";
  actorName?: string;
  cardName?: string;
  cardType?: ActionCard["type"];
  effect?: CardEffect;
  targetName?: string;
  roll?: number;
  bonus?: number;
  doomChange?: number;
  influenceChange?: number;
  amount?: number;
  defeated?: boolean;
  nextTarget?: number;
  diceBuff?: number;
  dicePenalty?: number;
  failureDetail?: string;
  supportType?: SupportType;
  targetIds?: string[];
};

export type GameHistoryEntry = {
  id: string;
  turn: number;
  kind: CardEffect | "discard" | "skip" | "timeout" | "forced-skip" | "world" | "system";
  actorName: string;
  actorTeam?: TeamId;
  targetName?: string;
  cardName?: string;
  message: string;
  success: boolean;
  amount?: number;
  diceRoll?: number;
  diceTarget?: number;
  diceBonus?: number;
  dicePenalty?: number;
  diceTotal?: number;
  createdAt: number;
};

export type WorldEventOutcome = {
  id: string;
  turn: number;
  level: number;
  title: string;
  description: string;
  affectedTeam?: TeamId;
};

export type PlayerRunState = {
  sessionId: string;
  hp: number;
  maxHp: number;
  shield: number;
  attackBuff: number;
  diceBuff: number;
  dicePenalty: number;
  reviveIn: number;
  passiveReviveUsed: boolean;
  skipTurns: number;
  borrowedCards: { cardId: string; ownerId: string; borrowedAtTurn: number }[];
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
  winnerTeam: TeamId | null;
  history: GameHistoryEntry[];
  worldEvent: WorldEventOutcome | null;
  turnOrder?: string[];
  roundNumber?: number;
  roundOrder?: string[];
  actedThisRound?: string[];
};

export type SharedRoomState = {
  players: PlayerSession[];
  phase: "lobby" | "game";
  game: SyncedGameState | null;
  revision: number;
  serverNow: number;
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
