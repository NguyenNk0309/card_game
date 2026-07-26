export const ANIMATION_MANIFEST_VERSION = 1;
export const ANIMATION_MANIFEST_PATH = "public/pixel/animations.manifest.json";

export const HEROES = Object.freeze([
  { id: "elara-voss", name: "Elara Voss" },
  { id: "thorne-vale", name: "Thorne Vale" },
  { id: "mira-ash", name: "Mira Ash" },
  { id: "brother-orren", name: "Brother Orren" },
  { id: "nyx-calder", name: "Nyx Calder" },
  { id: "bram-coalhand", name: "Bram Coalhand" },
  { id: "sable-fen", name: "Sable Fen" },
  { id: "kael-rook", name: "Kael Rook" },
  { id: "ione-mire", name: "Ione Mire" },
  { id: "dagan-flint", name: "Dagan Flint" }
]);

export const CHARACTER_ANIMATIONS = Object.freeze([
  "idle",
  "enter",
  "slash",
  "heavy",
  "brace",
  "second-wind",
  "hurt",
  "shield-hit",
  "shield-break",
  "backlash",
  "defeat",
  "revive",
  "victory",
  "discard",
  "skip",
  "timeout",
  "forced-skip",
  "pity-success",
  "zero-pity-success",
  "cast"
]);

export const UNIQUE_CARD_IDS = Object.freeze([
  "ev-aegis",
  "ev-ward",
  "ev-command",
  "tv-mark",
  "tv-pierce",
  "tv-hunt",
  "ma-inferno",
  "ma-comet",
  "ma-gravity",
  "bo-prayer",
  "bo-blessing",
  "bo-return",
  "nc-knife",
  "nc-execute",
  "nc-pilfer",
  "bc-fortress",
  "bc-temper",
  "bc-march",
  "sf-favor",
  "sf-hex",
  "sf-stolen",
  "kr-riposte",
  "kr-duel",
  "kr-break",
  "im-command",
  "im-focus",
  "im-purge",
  "df-none",
  "df-cleave",
  "df-frenzy"
]);

export const COMMON_CARD_IDS = Object.freeze([
  "slash",
  "heavy",
  "brace",
  "second-wind",
  "empty-gesture",
  "broken-plan",
  "lost-momentum"
]);

export const CARD_OUTCOMES = Object.freeze(["success", "failure"]);

export const SHARED_VFX = Object.freeze([
  "neutral",
  "world",
  "damage",
  "heal",
  "shield-gain",
  "shield-loss",
  "shield-hit",
  "shield-break",
  "shield-pierce",
  "attack-buff",
  "dice-buff",
  "dice-penalty",
  "turn-skip",
  "turn-advance",
  "card-steal",
  "card-purge",
  "revival-pending",
  "revive",
  "dispel",
  "backlash",
  "pity-success",
  "zero-pity-success",
  "no-effect",
  "discard",
  "skip",
  "timeout",
  "forced-skip"
]);

export const WORLD_EVENTS = Object.freeze([
  { id: "chaos-convergence", name: "Chaos Convergence" },
  { id: "fractured-fate", name: "Fractured Fate" },
  { id: "crimson-world-pulse", name: "Crimson World Pulse" },
  { id: "unstable-arena-surge", name: "Unstable Arena Surge" }
]);

export const BATTLE_RESULTS = Object.freeze(["victory", "defeat"]);

export const EXPECTED_CLIP_GROUPS = Object.freeze({
  characters: Object.freeze(
    HEROES.flatMap((hero) =>
      CHARACTER_ANIMATIONS.map((animation) => `character.${hero.id}.${animation}`)
    )
  ),
  uniqueCards: Object.freeze(
    UNIQUE_CARD_IDS.flatMap((cardId) =>
      CARD_OUTCOMES.map((outcome) => `card.${cardId}.${outcome}`)
    )
  ),
  commonCards: Object.freeze(
    COMMON_CARD_IDS.flatMap((cardId) =>
      CARD_OUTCOMES.map((outcome) => `card.${cardId}.${outcome}`)
    )
  ),
  shared: Object.freeze(SHARED_VFX.map((kind) => `shared.${kind}`)),
  world: Object.freeze(WORLD_EVENTS.map((event) => `world.${event.id}`)),
  results: Object.freeze(BATTLE_RESULTS.map((result) => `result.${result}`))
});

export const EXPECTED_CLIP_IDS = Object.freeze(
  Object.values(EXPECTED_CLIP_GROUPS).flat()
);
