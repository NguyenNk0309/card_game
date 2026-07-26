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
export type TimedEffectKind = "shield" | "attackBuff" | "diceBuff" | "dicePenalty";

export type TimedEffect = {
  kind: TimedEffectKind;
  value: number;
  expiresAfterTurn: number;
};

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
  pityCost: number;
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

export type GameImpactKind =
  | "damage"
  | "heal"
  | "shield"
  | "shield-loss"
  | "attack-buff"
  | "dice-buff"
  | "dice-penalty"
  | "turn-advance"
  | "turn-delay"
  | "skip-turn"
  | "revive-pending"
  | "revive"
  | "dispel"
  | "card-purge"
  | "card-steal"
  | "none";

export type GameTargetImpact = {
  targetId: string;
  kind: GameImpactKind;
  amount?: number;
  hpBefore?: number;
  hpAfter?: number;
  shieldBefore?: number;
  shieldAfter?: number;
  blocked?: number;
  defeated?: boolean;
  cardId?: string;
};

export type GameOutcome = {
  success: boolean;
  total: number;
  target: number;
  label: string;
  detail?: string;
  kind?: "card" | "discard" | "skip" | "timeout" | "forced-skip" | "system";
  actorId?: string;
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
  resolution?: "roll" | "pity";
  cardId?: string;
  pityCost?: number;
  pityBefore?: number;
  pityAfter?: number;
  failureDetail?: string;
  supportType?: SupportType;
  targetIds?: string[];
  impacts?: GameTargetImpact[];
};

export type GameHistoryEntry = {
  id: string;
  turn: number;
  phase?: number;
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
  resolution?: "roll" | "pity";
  pityCost?: number;
  pityBefore?: number;
  pityAfter?: number;
  createdAt: number;
};

export type WorldEventOutcome = {
  id: string;
  turn: number;
  level: number;
  title: string;
  description: string;
  affectedTeam?: TeamId;
  results?: GameTargetImpact[];
};

export type PlayerRunState = {
  sessionId: string;
  hp: number;
  maxHp: number;
  shield: number;
  attackBuff: number;
  diceBuff: number;
  dicePenalty: number;
  pityPoints: number;
  reviveIn: number;
  passiveReviveUsed: boolean;
  skipTurns: number;
  completedPlayerTurns: number;
  timedEffects: TimedEffect[];
  borrowedCards: { cardId: string; ownerId: string; borrowedAtTurn: number; expiresAfterOwnerTurn?: number }[];
  cardUses: Record<string, number>;
  drawPile: string[];
  hand: string[];
  discardPile: string[];
  graveyard: string[];
};

export type SyncedGameState = {
  adventure: Adventure;
  activePlayerIndex: number;
  completedTurns: number;
  completedPhases: number;
  roll: number | null;
  outcome: GameOutcome | null;
  playerStates: Record<string, PlayerRunState>;
  turnStartedAt: number;
  turnDeadline: number;
  turnSeconds: number;
  maxTurns: number;
  maxPhases: number;
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
  viewerSessionId?: string;
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
