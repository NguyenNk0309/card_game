import { ACTION_CARDS, EVENTS, HERO_TEMPLATES, REALMS, STORY_BEATS } from "./catalog";
import type { ActionCard, Adventure, CharacterOption, Hero, PlayerRunState, PlayerSession, SyncedGameState, TeamId } from "@/shared/types";

const pick = <T,>(items: T[], index = Math.floor(Math.random() * items.length)) =>
  items[Math.abs(index) % items.length];

export function createSeed() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function createAdventure(seed = createSeed()): Adventure {
  const key = [...seed].reduce((total, char) => total + char.charCodeAt(0), 0);
  const realm = pick(REALMS, key);
  return {
    seed,
    realm,
    chapter: 1,
    maxChapters: 10,
    story: pick(STORY_BEATS, key + 1),
    event: pick(EVENTS, key + 2),
    target: 13 + (key % 4),
    worldDoom: 18,
    veilInfluence: 0,
    emberInfluence: 0
  };
}

export function createParty(size = 6): Hero[] {
  return HERO_TEMPLATES.slice(0, Math.min(10, Math.max(2, size))).map((hero, index) => ({
    ...hero,
    id: `hero-${index + 1}`,
    team: (index % 2 === 0 ? "veil" : "ember") as TeamId,
    isYou: index === 0
  }));
}

const shuffle = <T,>(items: T[]) => {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
};

export function createSkillDeck(hero: Omit<Hero, "id" | "team" | "isYou">, heroIndex: number): ActionCard[] {
  const types: ActionCard["type"][] = ["Spirit", "Wit", "Might"];
  const signatureType = types[heroIndex % types.length];
  const roleType = types[(heroIndex + 1) % types.length];
  const oathType = types[(heroIndex + 2) % types.length];
  const prefix = hero.initials.toLowerCase();
  const signatureEffects: ActionCard["effect"][] = ["guard", "damage", "support", "heal", "damage"];
  const signatureTargets: ActionCard["target"][] = ["ally", "enemy", "none", "ally", "enemy"];
  const uniqueCards: ActionCard[] = [
    {
      id: `${prefix}-signature`,
      name: hero.skill,
      type: signatureType,
      description: hero.skillText,
      bonus: 5 + (heroIndex % 2),
      risk: 2,
      effect: signatureEffects[heroIndex % signatureEffects.length],
      target: signatureTargets[heroIndex % signatureTargets.length],
      value: 3 + (heroIndex % 2),
      unique: true
    },
    {
      id: `${prefix}-role`,
      name: `${hero.role}'s Instinct`,
      type: roleType,
      description: `Use ${hero.role.toLowerCase()} training to protect an ally and shape the next encounter.`,
      bonus: 4,
      risk: 1,
      effect: "guard",
      target: "ally",
      value: 3,
      unique: true
    },
    {
      id: `${prefix}-oath`,
      name: hero.title,
      type: oathType,
      description: "Invoke your hidden oath for greater influence, accepting a dangerous consequence on failure.",
      bonus: 7,
      risk: 5,
      effect: "check",
      target: "none",
      value: 0,
      unique: true
    },
    {
      id: `${prefix}-bond`,
      name: `${hero.name.split(" ")[0]}'s Lifeline`,
      type: "Spirit",
      description: "Turn a personal bond into healing for a wounded companion.",
      bonus: 4 + (heroIndex % 2),
      risk: 1,
      effect: "heal",
      target: "ally",
      value: 3 + (heroIndex % 3),
      unique: true
    },
    {
      id: `${prefix}-rival`,
      name: `${hero.role}'s Challenge`,
      type: "Might",
      description: "Challenge a rival hero directly and steal momentum for your banner.",
      bonus: 5,
      risk: 3,
      effect: "damage",
      target: "enemy",
      value: 3 + (heroIndex % 2),
      unique: true
    }
  ];

  const commonCards = ACTION_CARDS.map((card) => ({ ...card, id: `${prefix}-common-${card.id}` }));
  return [...uniqueCards, ...commonCards];
}

export function getCharacterOptions(): CharacterOption[] {
  return HERO_TEMPLATES.map((template, index) => {
    const hero: Hero = { ...template, id: `preview-${index}`, team: "veil" };
    return { hero, skillDeck: createSkillDeck(template, index) };
  });
}

export function createPlayerSession(
  displayName: string,
  seatIndex: number,
  heroName: string,
  sessionId?: string
): PlayerSession {
  const heroIndex = Math.max(0, HERO_TEMPLATES.findIndex((hero) => hero.name === heroName));
  const template = HERO_TEMPLATES[heroIndex];
  const team = (seatIndex % 2 === 0 ? "veil" : "ember") as TeamId;
  const id = sessionId ?? `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const hero: Hero = {
    ...template,
    id: `hero-${id}`,
    team
  };

  return {
    id,
    displayName,
    ready: false,
    joinedAt: Date.now(),
    hero,
    skillDeck: createSkillDeck(template, heroIndex)
  };
}

function createRunState(player: PlayerSession): PlayerRunState {
  const drawPile = shuffle(player.skillDeck.map((card) => card.id));
  return {
    sessionId: player.id,
    hp: player.hero.maxHp,
    maxHp: player.hero.maxHp,
    shield: 0,
    hand: drawPile.splice(0, 5),
    drawPile,
    discardPile: []
  };
}

export function createInitialGame(players: PlayerSession[], adventure = createAdventure(), turnSeconds = 30): SyncedGameState {
  const maxTurns = Math.max(36, players.length * 8);
  adventure.maxChapters = Math.ceil(maxTurns / players.length);
  const now = Date.now();
  return {
    adventure,
    activePlayerIndex: 0,
    completedTurns: 0,
    roll: null,
    outcome: null,
    playerStates: Object.fromEntries(players.map((player) => [player.id, createRunState(player)])),
    turnStartedAt: now,
    turnDeadline: now + turnSeconds * 1000,
    turnSeconds,
    maxTurns,
    ended: false,
    endReason: null
  };
}

export function nextStory(adventure: Adventure): Adventure {
  const key = Math.floor(Math.random() * STORY_BEATS.length);
  return {
    ...adventure,
    story: STORY_BEATS[key],
    event: EVENTS[(key + adventure.chapter) % EVENTS.length],
    target: 12 + Math.floor(Math.random() * 6)
  };
}

function drawReplacement(state: PlayerRunState, playedCardId: string): PlayerRunState {
  let drawPile = [...state.drawPile];
  let discardPile = [...state.discardPile, playedCardId];
  const hand = state.hand.filter((cardId) => cardId !== playedCardId);
  if (!drawPile.length) {
    drawPile = shuffle(discardPile);
    discardPile = [];
  }
  const replacement = drawPile.shift();
  return { ...state, drawPile, discardPile, hand: replacement ? [...hand, replacement] : hand };
}

function validTarget(card: ActionCard, active: PlayerSession, players: PlayerSession[], requestedId?: string) {
  const requested = players.find((player) => player.id === requestedId);
  if (card.target === "self" || card.target === "none") return active;
  if (card.target === "ally" && requested?.hero.team === active.hero.team) return requested;
  if (card.target === "enemy" && requested && requested.hero.team !== active.hero.team) return requested;
  if (card.target === "any" && requested) return requested;
  return card.target === "enemy"
    ? players.find((player) => player.hero.team !== active.hero.team) ?? active
    : players.find((player) => player.hero.team === active.hero.team) ?? active;
}

export function resolveCardTurn(
  game: SyncedGameState,
  players: PlayerSession[],
  cardId: string,
  targetId: string | undefined,
  roll: number
): SyncedGameState {
  const activePlayer = players[game.activePlayerIndex];
  if (!activePlayer) return game;
  const activeState = game.playerStates[activePlayer.id];
  const card = activePlayer.skillDeck.find((item) => item.id === cardId);
  if (!activeState || !card || !activeState.hand.includes(card.id)) return game;

  const nextCompletedTurns = game.completedTurns + 1;
  const completesChapter = nextCompletedTurns % players.length === 0;
  const resolved = resolveAction(game.adventure, card.id, roll, completesChapter, activePlayer.skillDeck, activePlayer.hero.team);
  const nextStates = Object.fromEntries(Object.entries(game.playerStates).map(([id, state]) => [id, { ...state, hand: [...state.hand], drawPile: [...state.drawPile], discardPile: [...state.discardPile] }]));
  const target = validTarget(card, activePlayer, players, targetId);
  const targetState = nextStates[target.id];
  let detail = resolved.success ? `${card.name} takes effect.` : `${card.name} fails and its risk feeds the realm.`;

  if (resolved.success && targetState) {
    if (card.effect === "heal") {
      const before = targetState.hp;
      targetState.hp = Math.min(targetState.maxHp, targetState.hp + card.value);
      if (card.id.includes("common-rally")) targetState.shield += 1;
      detail = `${target.displayName} recovers ${targetState.hp - before} health.`;
    } else if (card.effect === "damage") {
      const ignoresShield = card.id.includes("common-feint");
      const absorbed = ignoresShield ? 0 : Math.min(targetState.shield, card.value);
      targetState.shield -= absorbed;
      const damage = Math.max(0, card.value - absorbed);
      targetState.hp = Math.max(0, targetState.hp - damage);
      detail = `${target.displayName} takes ${damage} damage${absorbed ? ` (${absorbed} blocked)` : ""}.`;
    } else if (card.effect === "guard") {
      targetState.shield += card.value;
      detail = `${target.displayName} gains ${card.value} shield.`;
    } else if (card.effect === "support") {
      detail = `World Doom falls by ${card.value}.`;
    }
  }

  let adventure = resolved.adventure;
  if (resolved.success && card.effect === "support") {
    adventure = { ...adventure, worldDoom: Math.max(0, adventure.worldDoom - card.value) };
  }
  if (resolved.success && card.id.includes("common-ward")) {
    adventure = { ...adventure, worldDoom: Math.max(0, adventure.worldDoom - 1) };
  }

  nextStates[activePlayer.id] = drawReplacement(nextStates[activePlayer.id], card.id);
  const ended = nextCompletedTurns >= game.maxTurns || adventure.worldDoom >= 100;
  const nextIndex = ended ? game.activePlayerIndex : (game.activePlayerIndex + 1) % players.length;
  const now = Date.now();

  return {
    ...game,
    adventure,
    activePlayerIndex: nextIndex,
    completedTurns: nextCompletedTurns,
    roll,
    outcome: {
      success: resolved.success,
      total: resolved.total,
      target: game.adventure.target,
      label: resolved.success ? `${activePlayer.displayName} plays ${card.name}` : "The realm takes its due",
      detail
    },
    playerStates: nextStates,
    turnStartedAt: now,
    turnDeadline: ended ? 0 : now + game.turnSeconds * 1000,
    ended,
    endReason: ended ? (adventure.worldDoom >= 100 ? "World Doom consumed the realm." : "The final turn has been played.") : null
  };
}

export function resolveAction(
  adventure: Adventure,
  cardId: string,
  roll: number,
  advanceChapter = true,
  availableCards: ActionCard[] = ACTION_CARDS,
  team: TeamId = "veil"
) {
  const card = availableCards.find((item) => item.id === cardId) ?? availableCards[0] ?? ACTION_CARDS[0];
  const total = roll + card.bonus;
  const success = total >= adventure.target;
  const teamGain = success ? Math.max(2, Math.floor(total / 4)) : 1;
  const doomDelta = success ? -1 : Math.max(2, Math.ceil(card.risk / 2) + 1);
  const nextChapter = advanceChapter
    ? Math.min(adventure.maxChapters, adventure.chapter + 1)
    : adventure.chapter;
  const storyIndex = (nextChapter + roll + card.bonus) % STORY_BEATS.length;

  return {
    success,
    total,
    card,
    adventure: {
      ...adventure,
      chapter: nextChapter,
      story: advanceChapter ? STORY_BEATS[storyIndex] : adventure.story,
      event: advanceChapter ? EVENTS[(storyIndex + 1) % EVENTS.length] : adventure.event,
      target: 12 + ((roll + nextChapter) % 6),
      worldDoom: Math.min(100, Math.max(0, adventure.worldDoom + doomDelta)),
      veilInfluence: adventure.veilInfluence + (team === "veil" ? teamGain + (card.type === "Wit" ? 1 : 0) : 0),
      emberInfluence: adventure.emberInfluence + (team === "ember" ? teamGain + (card.type === "Might" ? 1 : 0) : 0)
    }
  };
}
