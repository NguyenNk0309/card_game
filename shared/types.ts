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
  | "steal-card"
  | "zero-pity"
  | "shield-break"
  | "piercing-attack"
  | "marked-target"
  | "discard-random-card"
  | "steal-gold";
export type FailureEffect = "self-damage" | "team-damage" | "lose-shield" | "enemy-shield";
export type TimedEffectKind = "shield" | "attackBuff" | "diceBuff" | "dicePenalty";

export type TimedEffect = {
  kind: TimedEffectKind;
  value: number;
  expiresAfterTurn: number;
};

export type PurgedCard = {
  cardId: string;
  returnAfterPhase: number;
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
  external?: boolean;
  shopOfferId?: string;
};

export type ShopCategory = "potion" | "item" | "external";

export type ShopInventoryEntry = {
  itemId: string;
  quantity: number;
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
  randomHero?: boolean;
  hero: Hero;
  skillDeck: ActionCard[];
};

export type PlayerLifeEvent = {
  id: string;
  kind: "defeat" | "revive";
  playerId: string;
  playerName: string;
  reason: string;
  source?: "card" | "world-event" | "system";
};

export type GameNotice = {
  id: string;
  kind: "card-transform" | "phase-start" | "shop-use";
  title: string;
  detail: string;
  actorId?: string;
  shopOfferId?: string;
};

export type GameOutcome = {
  id?: string;
  success: boolean;
  total: number;
  target: number;
  label: string;
  detail?: string;
  kind?: "card" | "discard" | "skip" | "timeout" | "forced-skip" | "system";
  actorId?: string;
  actorName?: string;
  cardName?: string;
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
  lifeEvents?: PlayerLifeEvent[];
  notices?: GameNotice[];
  alternateRoll?: number;
  initialRoll?: number;
  rollMode?: "additional-die" | "lucky-die";
  goldBefore?: number;
  goldChange?: number;
  goldAfter?: number;
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
  failureDetail?: string;
  alternateRoll?: number;
  initialRoll?: number;
  rollMode?: "additional-die" | "lucky-die";
  goldBefore?: number;
  goldChange?: number;
  goldAfter?: number;
  createdAt: number;
};

export type WorldEventKey =
  | "legacy-world-event"
  | "shattered-tribute"
  | "shifting-arsenal"
  | "first-blood"
  | "unstable-wards"
  | "broken-formation"
  | "arcane-static"
  | "supply-rot"
  | "gravewind"
  | "eclipse-of-fortune"
  | "shieldquake"
  | "severed-oaths"
  | "time-fracture"
  | "crimson-debt"
  | "final-collapse"
  | "the-last-cards"
  | "sudden-death";

export type WorldEventIntensity = "Opening" | "Minor" | "Moderate" | "Strong" | "Severe" | "Catastrophic";

export type WorldEventPlayerResult = {
  playerId: string;
  playerName: string;
  team: TeamId;
  publicSummary: string;
  privateSummary?: string;
  hpChange: number;
  shieldChange: number;
  pityChange: number;
  attackBonusChange: number;
  diceBonusChange: number;
  dicePenaltyChange: number;
  skipTurnChange: number;
  destroyedCardCount: number;
  discardedCardCount: number;
  redrawnCardCount?: number;
  privateCardIds?: string[];
  privateCardNames?: string[];
  autoResolved?: boolean;
};

export type PendingWorldEvent = {
  id: string;
  eventKey: WorldEventKey;
  phase: number;
  turn: number;
  level: number;
  intensity: WorldEventIntensity;
  title: string;
  description: string;
  fullDescription: string;
  status: "pending";
  requiredPlayerIds: string[];
  submittedPlayerIds: string[];
  autoResolvedPlayerIds: string[];
  startedAt: number;
  deadlineAt: number;
  results?: WorldEventPlayerResult[];
};

export type WorldEventOutcome = {
  id: string;
  eventKey: WorldEventKey;
  phase: number;
  turn: number;
  level: number;
  intensity: WorldEventIntensity;
  title: string;
  description: string;
  fullDescription: string;
  interactive: boolean;
  startedAt: number;
  resolvedAt: number;
  results: WorldEventPlayerResult[];
  teamSummaries: { team: TeamId; summary: string }[];
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
  goldUnits: number;
  goldenShield: number;
  shopInventory: ShopInventoryEntry[];
  shopPurchases: Record<string, number>;
  externalCardsPurchased: number;
  shopShieldUntilTurn: number;
  shopAttackBonus: number;
  shopDiceBonus: number;
  shopFreePity: boolean;
  additionalDieActive: boolean;
  luckyDieActive: boolean;
  piercingAttackActive: boolean;
  markedTargetId: string;
  markedTargetBonus: number;
  reviveIn: number;
  passiveReviveUsed: boolean;
  sanguineRecompense: boolean;
  skipTurns: number;
  completedPlayerTurns: number;
  zeroPityUntilTurn: number;
  timedEffects: TimedEffect[];
  borrowedCards: { cardId: string; ownerId: string; borrowedAtTurn: number; expiresAfterBorrowerTurn?: number; expiresAfterOwnerTurn?: number }[];
  purgedCards: PurgedCard[];
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
  maxTurns: number; // 0 means unlimited.
  maxPhases: number; // 0 means unlimited.
  ended: boolean;
  endReason: string | null;
  winnerTeam: TeamId | null;
  history: GameHistoryEntry[];
  worldEvent: WorldEventOutcome | null;
  worldEventHistory: WorldEventOutcome[];
  pendingWorldEvent: PendingWorldEvent | null;
  worldEventPlan?: Partial<Record<number, WorldEventKey>>;
  turnOrder?: string[];
  roundNumber?: number;
  roundOrder?: string[];
  actedThisRound?: string[];
};

export type SharedRoomState = {
  roomId: string;
  createdAt: number;
  expiresAt: number;
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
