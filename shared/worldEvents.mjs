const definition = (event) => Object.freeze({
  ...event,
  description: event.shortDescription,
  metadata: Object.freeze(event.metadata)
});

export const WORLD_EVENT_DEFINITIONS = Object.freeze({
  'shattered-tribute': definition({
    key: 'shattered-tribute', phase: 3, level: 1, intensity: 'Opening', title: 'Shattered Tribute', interactive: true,
    shortDescription: 'Every living player permanently sacrifices two eligible owned cards and draws replacements when possible.',
    fullDescription: 'Every living player chooses two owned cards from their current hand. Those cards permanently move to that player\'s graveyard, and replacement cards are drawn into the vacated hand positions when possible. A player with fewer than two eligible cards chooses every eligible card. Borrowed cards cannot be selected.',
    metadata: { tone: 'opening', icon: 'tribute', privacy: 'private-choice' }
  }),
  'shifting-arsenal': definition({
    key: 'shifting-arsenal', phase: 7, level: 2, intensity: 'Minor', title: 'Shifting Arsenal', interactive: false,
    shortDescription: 'Every living player reshuffles their owned hand into draw and redraws the same number of owned cards.',
    fullDescription: 'For every living player, owned cards in hand return to the draw pile. The resulting draw pile is shuffled and the same number of owned cards is redrawn. Borrowed cards remain in hand and retain their ownership.',
    metadata: { tone: 'minor', icon: 'shuffle', privacy: 'private-cards' }
  }),
  'first-blood': definition({
    key: 'first-blood', phase: 7, level: 2, intensity: 'Minor', title: 'First Blood', interactive: false,
    shortDescription: 'Every living player loses 1 HP, ignoring shield.',
    fullDescription: 'Every living player loses 1 HP. Shield is ignored. Defeated players are detected after everyone is affected, then Sable Fen\'s Second Sight passive resolves once where eligible.',
    metadata: { tone: 'minor', icon: 'damage', privacy: 'public' }
  }),
  'unstable-wards': definition({
    key: 'unstable-wards', phase: 7, level: 2, intensity: 'Minor', title: 'Unstable Wards', interactive: false,
    shortDescription: 'Living players lose up to 2 shield, or gain 1 pity if they have no shield.',
    fullDescription: 'Every living player with shield loses up to 2 shield and the matching timed shield value. A living player with no shield gains 1 pity point instead. A player never receives both effects.',
    metadata: { tone: 'minor', icon: 'shield', privacy: 'public' }
  }),
  'broken-formation': definition({
    key: 'broken-formation', phase: 12, level: 3, intensity: 'Moderate', title: 'Broken Formation', interactive: false,
    shortDescription: 'The living-player order is randomized for phase 12 only.',
    fullDescription: 'The server shuffles all living players into a new phase-12 turn order. Character Speed is unchanged, and normal Speed-based order returns when phase 13 begins.',
    metadata: { tone: 'moderate', icon: 'order', privacy: 'public' }
  }),
  'arcane-static': definition({
    key: 'arcane-static', phase: 12, level: 3, intensity: 'Moderate', title: 'Arcane Static', interactive: false,
    shortDescription: 'Every living player receives -1 to their next d20 result.',
    fullDescription: 'Every living player receives a timed penalty of 1 to their next d20 result. It expires after that player\'s next completed turn, including a played card, discard, skip, cancellation, forced skip, or timeout.',
    metadata: { tone: 'moderate', icon: 'dice', privacy: 'public' }
  }),
  'supply-rot': definition({
    key: 'supply-rot', phase: 12, level: 3, intensity: 'Moderate', title: 'Supply Rot', interactive: false,
    shortDescription: 'Every living player discards and replaces one random eligible owned hand card.',
    fullDescription: 'For every living player, one random owned card in hand moves to discard and a replacement is drawn into the same hand position when possible. Common and unique owned cards are eligible; borrowed cards are excluded. Only the owner sees the card identity.',
    metadata: { tone: 'moderate', icon: 'discard', privacy: 'private-cards' }
  }),
  gravewind: definition({
    key: 'gravewind', phase: 17, level: 4, intensity: 'Strong', title: 'Gravewind', interactive: false,
    shortDescription: 'Every living player permanently loses one random common owned card.',
    fullDescription: 'Every living player permanently loses one random common owned card. The search uses hand first, then draw pile, then discard pile. Unique, borrowed, and already-graveyard cards are excluded. A destroyed hand card is replaced when possible. Only the owner sees its identity.',
    metadata: { tone: 'strong', icon: 'graveyard', privacy: 'private-cards' }
  }),
  'eclipse-of-fortune': definition({
    key: 'eclipse-of-fortune', phase: 17, level: 4, intensity: 'Strong', title: 'Eclipse of Fortune', interactive: false,
    shortDescription: 'Every living player must pay 2 pity or lose 1 HP for each unpaid point.',
    fullDescription: 'Every living player loses up to 2 pity points. For each point they cannot pay, they lose 1 HP ignoring shield. Defeats and Sable Fen\'s passive resolve after every player is affected.',
    metadata: { tone: 'strong', icon: 'pity', privacy: 'public' }
  }),
  shieldquake: definition({
    key: 'shieldquake', phase: 17, level: 4, intensity: 'Strong', title: 'Shieldquake', interactive: false,
    shortDescription: 'Every living player loses all shield and 1 HP.',
    fullDescription: 'Every living player loses all shield and all matching timed shield effects, then loses 1 HP ignoring shield. Defeats and Sable Fen\'s passive resolve after everyone is affected.',
    metadata: { tone: 'strong', icon: 'shield-break', privacy: 'public' }
  }),
  'severed-oaths': definition({
    key: 'severed-oaths', phase: 22, level: 5, intensity: 'Severe', title: 'Severed Oaths', interactive: false,
    shortDescription: 'All existing combat bonuses are cleared and every living player receives -2 to their next d20 result.',
    fullDescription: 'Every living player loses all shield, attack bonuses, d20 bonuses, and d20 penalties together with their matching timed effects. Each then receives a fresh timed penalty of 2 to their next d20 result.',
    metadata: { tone: 'severe', icon: 'sever', privacy: 'public' }
  }),
  'time-fracture': definition({
    key: 'time-fracture', phase: 22, level: 5, intensity: 'Severe', title: 'Time Fracture', interactive: false,
    shortDescription: 'Each team\'s fastest survivor is skipped, or a lone survivor receives -3 to their next d20 result.',
    fullDescription: 'For each team with at least two living players, the fastest player has their next turn skipped; Speed ties use earlier join time. A team with exactly one living player does not skip that player and instead gives them a timed penalty of 3 to their next d20 result.',
    metadata: { tone: 'severe', icon: 'time', privacy: 'public' }
  }),
  'crimson-debt': definition({
    key: 'crimson-debt', phase: 22, level: 5, intensity: 'Severe', title: 'Crimson Debt', interactive: false,
    shortDescription: 'Every living player loses 2 HP and up to 2 pity points.',
    fullDescription: 'Every living player loses 2 HP ignoring shield and loses up to 2 pity points. A player with no pity still loses the full 2 HP. Defeats and Sable Fen\'s passive resolve after everyone is affected.',
    metadata: { tone: 'severe', icon: 'debt', privacy: 'public' }
  }),
  'final-collapse': definition({
    key: 'final-collapse', phase: 27, level: 6, intensity: 'Catastrophic', title: 'Final Collapse', interactive: false,
    shortDescription: 'Every living player loses all shield and takes at least 2 damage based on maximum HP.',
    fullDescription: 'Every living player loses all shield, then takes damage equal to 25% of maximum HP rounded upward, with a minimum of 2 damage. Damage ignores shield. Defeats and Sable Fen\'s passive resolve after everyone is affected.',
    metadata: { tone: 'catastrophic', icon: 'collapse', privacy: 'public' }
  }),
  'the-last-cards': definition({
    key: 'the-last-cards', phase: 27, level: 6, intensity: 'Catastrophic', title: 'The Last Cards', interactive: false,
    shortDescription: 'Every living player permanently loses up to two random common owned cards without dropping below four reusable cards.',
    fullDescription: 'Every living player permanently loses up to two random common owned cards from hand, draw pile, or discard pile. Unique, borrowed, and graveyard cards are excluded. A player is never reduced below four owned reusable cards, and destroyed hand cards are replaced when possible. Only the owner sees card identities.',
    metadata: { tone: 'catastrophic', icon: 'cards', privacy: 'private-cards' }
  }),
  'sudden-death': definition({
    key: 'sudden-death', phase: 27, level: 6, intensity: 'Catastrophic', title: 'Sudden Death', interactive: false,
    shortDescription: 'Living players are capped at half HP, lose all shield, and gain +2 next-attack damage.',
    fullDescription: 'Every living player\'s current HP is reduced to no more than half maximum HP rounded upward, without reducing a living player below 1. All shield is removed, and a timed attack bonus of 2 is applied through the existing next-successful-damage behavior.',
    metadata: { tone: 'catastrophic', icon: 'sudden-death', privacy: 'public' }
  })
});

export const WORLD_EVENT_SCHEDULE = Object.freeze([
  Object.freeze({ phase: 3, level: 1, intensity: 'Opening', selection: 'fixed', eventKeys: Object.freeze(['shattered-tribute']) }),
  Object.freeze({ phase: 7, level: 2, intensity: 'Minor', selection: 'random', eventKeys: Object.freeze(['shifting-arsenal', 'first-blood', 'unstable-wards']) }),
  Object.freeze({ phase: 12, level: 3, intensity: 'Moderate', selection: 'random', eventKeys: Object.freeze(['broken-formation', 'arcane-static', 'supply-rot']) }),
  Object.freeze({ phase: 17, level: 4, intensity: 'Strong', selection: 'random', eventKeys: Object.freeze(['gravewind', 'eclipse-of-fortune', 'shieldquake']) }),
  Object.freeze({ phase: 22, level: 5, intensity: 'Severe', selection: 'random', eventKeys: Object.freeze(['severed-oaths', 'time-fracture', 'crimson-debt']) }),
  Object.freeze({ phase: 27, level: 6, intensity: 'Catastrophic', selection: 'random', eventKeys: Object.freeze(['final-collapse', 'the-last-cards', 'sudden-death']) })
]);

export const WORLD_EVENT_PHASES = Object.freeze(WORLD_EVENT_SCHEDULE.map((entry) => entry.phase));

export function isWorldEventPhase(phase) {
  return WORLD_EVENT_PHASES.includes(Number(phase));
}

export function getWorldEventScheduleEntry(phase) {
  return WORLD_EVENT_SCHEDULE.find((entry) => entry.phase === Number(phase)) || null;
}

export function getNextWorldEventPhase(phase) {
  return WORLD_EVENT_PHASES.find((candidate) => candidate > Number(phase)) ?? null;
}

export function getPreviousWorldEventPhase(phase) {
  return [...WORLD_EVENT_PHASES].reverse().find((candidate) => candidate < Number(phase)) ?? null;
}

export function getWorldEventDefinition(key) {
  return WORLD_EVENT_DEFINITIONS[key] || null;
}

export function getWorldEventsForPhase(phase) {
  const entry = getWorldEventScheduleEntry(phase);
  return entry ? entry.eventKeys.map((key) => getWorldEventDefinition(key)).filter(Boolean) : [];
}

export function describeWorldEventScheduleEntry(entry) {
  if (!entry) return '';
  const selection = entry.selection === 'fixed' ? 'Fixed event' : 'Randomly selects one of three events';
  return `Phase ${entry.phase} · Level ${entry.level} · ${entry.intensity} · ${selection}`;
}
