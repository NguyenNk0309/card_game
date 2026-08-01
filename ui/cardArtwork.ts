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
  "ev-aegis": specialScene("ev-aegis", "Elara Voss", "all-allies", "Elara forms a Lantern Phalanx that shields every ally."),
  "ev-ward": specialScene("ev-ward", "Elara Voss", "ally", "Elara raises an Undying Ward around one ally."),
  "ev-command": specialScene("ev-command", "Elara Voss", "ally", "Elara issues a Rescue Order that moves one ally forward."),
  "tv-mark": specialScene("tv-mark", "Thorne Vale", "enemy", "Thorne fires a Deadeye Bolt at one enemy."),
  "tv-pierce": specialScene("tv-pierce", "Thorne Vale", "enemy", "Thorne fires an Armor-Piercing Bolt through one enemy's defense."),
  "tv-hunt": specialScene("tv-hunt", "Thorne Vale", "ally", "Thorne grants Predator's Boon to one ally."),
  "ma-inferno": specialScene("ma-inferno", "Mira Ash", "all-enemies", "Mira engulfs every enemy in a Wildfire Inferno."),
  "ma-comet": specialScene("ma-comet", "Mira Ash", "all-enemies", "Mira calls shield-piercing ashfall onto every enemy."),
  "ma-gravity": specialScene("ma-gravity", "Mira Ash", "enemy", "Mira binds one enemy with Gravitic Misfortune."),
  "bo-prayer": specialScene("bo-prayer", "Brother Orren", "ally", "Brother Orren restores one living ally through Graceful Renewal."),
  "bo-blessing": specialScene("bo-blessing", "Brother Orren", "all-allies", "Brother Orren shares restoration with every living ally."),
  "bo-return": specialScene("bo-return", "Brother Orren", "defeated-ally", "Brother Orren performs Immediate Resurrection beside a defeated ally."),
  "nc-knife": specialScene("nc-knife", "Nyx Calder", "enemy", "Nyx strikes through one enemy's shield with a veilpiercing knife."),
  "nc-execute": specialScene("nc-execute", "Nyx Calder", "enemy", "Nyx performs a Veilpiercing Execution on one enemy."),
  "nc-pilfer": specialScene("nc-pilfer", "Nyx Calder", "enemy", "Nyx borrows fate by stealing a card from one enemy hand."),
  "bc-fortress": specialScene("bc-fortress", "Bram Coalhand", "ally", "Bram raises a Two-Turn Bastion around one ally."),
  "bc-temper": specialScene("bc-temper", "Bram Coalhand", "all-allies", "Bram forms a Tempered Phalanx around every ally."),
  "bc-march": specialScene("bc-march", "Bram Coalhand", "self", "Bram turns half of his own bulwark into the edge of a blade."),
  "sf-favor": specialScene("sf-favor", "Sable Fen", "ally", "Sable foretells success for one ally's next card."),
  "sf-hex": specialScene("sf-hex", "Sable Fen", "enemy", "Sable foretells misfortune for one enemy's next roll."),
  "sf-stolen": specialScene("sf-stolen", "Sable Fen", "enemy", "Sable foretells a delay that cancels one enemy's next turn."),
  "kr-riposte": specialScene("kr-riposte", "Kael Rook", "enemy", "Kael answers one enemy with an Unshielded Riposte."),
  "kr-duel": specialScene("kr-duel", "Kael Rook", "enemy", "Kael enters a Baresteel Challenge against one enemy."),
  "kr-break": specialScene("kr-break", "Kael Rook", "enemy", "Kael breaks one enemy's buffs and shield."),
  "im-command": specialScene("im-command", "Ione Mire", "all-allies", "Ione issues an Assault Order to every living ally."),
  "im-focus": specialScene("im-focus", "Ione Mire", "all-allies", "Ione issues a Precision Order around a drowned tactical map."),
  "im-purge": specialScene("im-purge", "Ione Mire", "enemy", "Ione performs a Mirefield Seizure and seals one enemy card in a flooded archive."),
  "df-none": specialScene("df-none", "Dagan Flint", "all-enemies", "A bloodied Dagan launches an onslaught against every enemy."),
  "df-cleave": specialScene("df-cleave", "Dagan Flint", "enemy", "A bloodied Dagan cleaves one enemy with a heavy axe."),
  "df-frenzy": specialScene("df-frenzy", "Dagan Flint", "self", "Dagan enters Flintblood Fury to empower his next attack."),
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
