import { ACTION_CARDS, EVENTS, HERO_TEMPLATES, REALMS, STORY_BEATS } from "./catalog";
import type { ActionCard, Adventure, Hero, PlayerSession, TeamId } from "@/shared/types";

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

function createSkillDeck(hero: Omit<Hero, "id" | "team" | "isYou">, heroIndex: number): ActionCard[] {
  const types: ActionCard["type"][] = ["Spirit", "Wit", "Might"];
  const signatureType = types[heroIndex % types.length];
  const roleType = types[(heroIndex + 1) % types.length];
  const oathType = types[(heroIndex + 2) % types.length];

  return [
    {
      id: `signature-${hero.initials.toLowerCase()}`,
      name: hero.skill,
      type: signatureType,
      description: hero.skillText,
      bonus: 5 + (heroIndex % 2),
      risk: 2
    },
    {
      id: `role-${hero.initials.toLowerCase()}`,
      name: `${hero.role}'s Instinct`,
      type: roleType,
      description: `Use ${hero.role.toLowerCase()} training to protect an ally and shape the next encounter.`,
      bonus: 4,
      risk: 1
    },
    {
      id: `oath-${hero.initials.toLowerCase()}`,
      name: hero.title,
      type: oathType,
      description: "Invoke your hidden oath for greater influence, accepting a dangerous consequence on failure.",
      bonus: 7,
      risk: 5
    }
  ];
}

export function createPlayerSession(
  displayName: string,
  seatIndex: number,
  usedHeroNames: string[] = []
): PlayerSession {
  const available = HERO_TEMPLATES
    .map((hero, index) => ({ hero, index }))
    .filter(({ hero }) => !usedHeroNames.includes(hero.name));
  const choice = pick(available.length ? available : HERO_TEMPLATES.map((hero, index) => ({ hero, index })));
  const team = (seatIndex % 2 === 0 ? "veil" : "ember") as TeamId;
  const id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const hero: Hero = {
    ...choice.hero,
    id: `hero-${id}`,
    team
  };

  return {
    id,
    displayName,
    ready: false,
    joinedAt: Date.now(),
    hero,
    skillDeck: createSkillDeck(choice.hero, choice.index)
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

export function resolveAction(
  adventure: Adventure,
  cardId: string,
  roll: number,
  advanceChapter = true,
  availableCards: ActionCard[] = ACTION_CARDS
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
      veilInfluence: adventure.veilInfluence + (card.type === "Wit" ? teamGain + 1 : teamGain),
      emberInfluence: adventure.emberInfluence + (card.type === "Might" ? teamGain + 1 : teamGain)
    }
  };
}
