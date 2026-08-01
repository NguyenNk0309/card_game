import type { ActionCard, CardTarget } from "@/shared/types";

export type CardArtwork = {
  alt: string;
  character?: string;
  kind: "scene";
  scene?: string;
  target: CardTarget;
};

const scene = (name: string, alt: string, target: CardTarget): CardArtwork => ({
  alt,
  kind: "scene",
  scene: `/art/cards/common/${name}.webp`,
  target,
});

const specialScene = (
  name: string,
  character: string,
  target: CardTarget,
  alt: string,
): CardArtwork => ({
  alt,
  character,
  kind: "scene",
  scene: `/art/cards/special/${name}.webp`,
  target,
});

const COMMON_ARTWORK: Record<string, CardArtwork> = {
  "slash": scene("slash", "An oathbound warrior slashes one enemy in a ruined gothic city.", "enemy"),
  "heavy blow": scene("heavy-blow", "An oathbound warrior lands a heavy blow on one enemy.", "enemy"),
  "brace": scene("brace", "An oathbound warrior braces behind a shield.", "self"),
  "second wind": scene("second-wind", "A wounded oathbound warrior recovers strength on the battlefield.", "self"),
  "lost momentum": scene("lost-momentum", "An exhausted warrior kneels after losing momentum.", "self"),
  "broken plan": scene("broken-plan", "A warrior studies a shattered battle plan with no active effect.", "self"),
  "empty gesture": scene("empty-gesture", "A warrior makes a powerless gesture in a ruined city.", "self"),
};

const SPECIAL_ARTWORK: Record<string, CardArtwork> = {
  "ev-aegis": specialScene("ev-aegis", "Elara Voss", "all-allies", "Elara raises her lantern to shield every ally."),
  "ev-ward": specialScene("ev-ward", "Elara Voss", "ally", "Elara braces behind her ward to shield one ally."),
  "ev-command": specialScene("ev-command", "Elara Voss", "ally", "Elara signals an ally into a rescue formation."),
  "tv-mark": specialScene("tv-mark", "Thorne Vale", "enemy", "Thorne looses a marked arrow at one enemy."),
  "tv-pierce": specialScene("tv-pierce", "Thorne Vale", "enemy", "Thorne fires a piercing arrow through one enemy's defense."),
  "tv-hunt": specialScene("tv-hunt", "Thorne Vale", "ally", "Thorne places a hunter's mark on one ally."),
  "ma-inferno": specialScene("ma-inferno", "Mira Ash", "all-enemies", "Mira surrounds the enemy line with an inferno."),
  "ma-comet": specialScene("ma-comet", "Mira Ash", "all-enemies", "Mira calls an ash comet onto every enemy."),
  "ma-gravity": specialScene("ma-gravity", "Mira Ash", "enemy", "Mira binds one enemy with a gravity hex."),
  "bo-prayer": specialScene("bo-prayer", "Brother Orren", "ally", "Brother Orren restores one living ally with prayer."),
  "bo-blessing": specialScene("bo-blessing", "Brother Orren", "all-allies", "Brother Orren shares a restorative blessing with every ally."),
  "bo-return": specialScene("bo-return", "Brother Orren", "defeated-ally", "Brother Orren kneels beside a defeated ally returning to life."),
  "nc-knife": specialScene("nc-knife", "Nyx Calder", "enemy", "Nyx strikes one enemy with a quiet knife."),
  "nc-execute": specialScene("nc-execute", "Nyx Calder", "enemy", "Nyx executes a shield-piercing cross strike on one enemy."),
  "nc-pilfer": specialScene("nc-pilfer", "Nyx Calder", "enemy", "Nyx steals a card from one enemy hand."),
  "bc-fortress": specialScene("bc-fortress", "Bram Coalhand", "ally", "Bram becomes a living fortress for one ally."),
  "bc-temper": specialScene("bc-temper", "Bram Coalhand", "all-allies", "Bram tempers armor for every ally."),
  "bc-march": specialScene("bc-march", "Bram Coalhand", "all-allies", "Bram leads every ally in a fortified march."),
  "sf-favor": specialScene("sf-favor", "Sable Fen", "ally", "Sable reveals a favorable omen for one ally's next card."),
  "sf-hex": specialScene("sf-hex", "Sable Fen", "enemy", "Sable casts a dark omen over one enemy's next roll."),
  "sf-stolen": specialScene("sf-stolen", "Sable Fen", "enemy", "Sable steals the moment of one enemy's next turn."),
  "kr-riposte": specialScene("kr-riposte", "Kael Rook", "enemy", "Kael answers one enemy with a heavy riposte."),
  "kr-duel": specialScene("kr-duel", "Kael Rook", "enemy", "Kael lunges at one challenged enemy."),
  "kr-break": specialScene("kr-break", "Kael Rook", "enemy", "Kael breaks one enemy's stance and shield."),
  "im-command": specialScene("im-command", "Ione Mire", "all-allies", "Ione directs every ally forward across the flooded Drowned Road."),
  "im-focus": specialScene("im-focus", "Ione Mire", "all-allies", "Ione focuses every ally around a drowned tactical map and bone die."),
  "im-purge": specialScene("im-purge", "Ione Mire", "enemy", "Ione extracts one enemy card and seals it inside a flooded archive vault."),
  "df-none": specialScene("df-none", "Dagan Flint", "all-enemies", "Dagan cleaves through every enemy while wounded."),
  "df-cleave": specialScene("df-cleave", "Dagan Flint", "enemy", "Dagan cleaves one enemy with a heavy axe."),
  "df-frenzy": specialScene("df-frenzy", "Dagan Flint", "self", "Dagan enters a blood frenzy to empower his next attacks."),
};

export function getCardArtwork(card: ActionCard): CardArtwork {
  if (card.unique) return SPECIAL_ARTWORK[card.id] ?? {
    alt: `Artwork is not yet available for ${card.name}.`,
    kind: "scene",
    target: card.target,
  };
  return COMMON_ARTWORK[card.name.toLowerCase()] ?? {
    alt: `Artwork is not yet available for ${card.name}.`,
    kind: "scene",
    target: card.target,
  };
}

export const CARD_ARTWORK_KEYS = {
  common: Object.keys(COMMON_ARTWORK),
  special: Object.keys(SPECIAL_ARTWORK),
};

const preloadedCardArtwork = new Map<string, HTMLImageElement>();

export function preloadCardArtwork(cards: readonly ActionCard[]) {
  if (typeof Image === "undefined") return;
  for (const card of cards) {
    const source = getCardArtwork(card).scene;
    if (!source || preloadedCardArtwork.has(source)) continue;
    const image = new Image();
    image.decoding = "async";
    image.src = source;
    preloadedCardArtwork.set(source, image);
    void image.decode().catch(() => undefined);
  }
}
