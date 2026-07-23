import { ACTION_CARDS, EVENTS, HERO_TEMPLATES, REALMS, STORY_BEATS } from "./catalog";
import type { Adventure, Hero, TeamId } from "@/shared/types";

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
    maxChapters: 5,
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

export function nextStory(adventure: Adventure): Adventure {
  const key = Math.floor(Math.random() * STORY_BEATS.length);
  return {
    ...adventure,
    story: STORY_BEATS[key],
    event: EVENTS[(key + adventure.chapter) % EVENTS.length],
    target: 12 + Math.floor(Math.random() * 6)
  };
}

export function resolveAction(adventure: Adventure, cardId: string, roll: number) {
  const card = ACTION_CARDS.find((item) => item.id === cardId) ?? ACTION_CARDS[0];
  const total = roll + card.bonus;
  const success = total >= adventure.target;
  const teamGain = success ? Math.max(2, Math.floor(total / 4)) : 1;
  const doomDelta = success ? -Math.min(5, card.bonus) : card.risk + 4;
  const nextChapter = Math.min(adventure.maxChapters, adventure.chapter + 1);
  const storyIndex = (nextChapter + roll + card.bonus) % STORY_BEATS.length;

  return {
    success,
    total,
    card,
    adventure: {
      ...adventure,
      chapter: nextChapter,
      story: STORY_BEATS[storyIndex],
      event: EVENTS[(storyIndex + 1) % EVENTS.length],
      target: 12 + ((roll + nextChapter) % 6),
      worldDoom: Math.min(100, Math.max(0, adventure.worldDoom + doomDelta)),
      veilInfluence: adventure.veilInfluence + (card.type === "Wit" ? teamGain + 1 : teamGain),
      emberInfluence: adventure.emberInfluence + (card.type === "Might" ? teamGain + 1 : teamGain)
    }
  };
}
