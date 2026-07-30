const definition = (event) => Object.freeze({
  ...event,
  description: event.shortDescription,
  metadata: Object.freeze(event.metadata)
});

export const WORLD_EVENT_DEFINITIONS = Object.freeze({
  'shattered-tribute': definition({
    key: 'shattered-tribute', phase: 3, level: 1, intensity: 'Opening', title: 'Shattered Tribute', interactive: true,
    shortDescription: 'Each living player sacrifices 2 owned common cards from hand, draw, or discard.',
    fullDescription: 'Choose 2 owned common cards, or all available; they enter graveyard, and removed hand cards are replaced. Special and borrowed cards are excluded.',
    metadata: { tone: 'opening', icon: 'tribute', privacy: 'private-choice' }
  }),
  'shifting-arsenal': definition({
    key: 'shifting-arsenal', phase: 7, level: 2, intensity: 'Minor', title: 'Shifting Arsenal', interactive: false,
    shortDescription: 'Each living player shuffles and redraws their owned hand.',
    fullDescription: 'Owned hand cards shuffle into draw and redraw; borrowed cards stay.',
    metadata: { tone: 'minor', icon: 'shuffle', privacy: 'private-cards' }
  }),
  'first-blood': definition({
    key: 'first-blood', phase: 7, level: 2, intensity: 'Minor', title: 'First Blood', interactive: false,
    shortDescription: 'Every living player loses 1 HP, ignoring shield.',
    fullDescription: 'Each living player loses 1 HP, ignoring shield.',
    metadata: { tone: 'minor', icon: 'damage', privacy: 'public' }
  }),
  'unstable-wards': definition({
    key: 'unstable-wards', phase: 7, level: 2, intensity: 'Minor', title: 'Unstable Wards', interactive: false,
    shortDescription: 'Each living player loses up to 2 shield, or gains 1 pity if they have none.',
    fullDescription: 'Lose up to 2 shield; gain 1 pity instead if shield is 0.',
    metadata: { tone: 'minor', icon: 'shield', privacy: 'public' }
  }),
  'broken-formation': definition({
    key: 'broken-formation', phase: 12, level: 3, intensity: 'Moderate', title: 'Broken Formation', interactive: false,
    shortDescription: 'Living-player order is randomized for phase 12.',
    fullDescription: 'Phase 12 turn order is shuffled; Speed order returns in phase 13.',
    metadata: { tone: 'moderate', icon: 'order', privacy: 'public' }
  }),
  'arcane-static': definition({
    key: 'arcane-static', phase: 12, level: 3, intensity: 'Moderate', title: 'Arcane Static', interactive: false,
    shortDescription: 'Each living player gets -1 on their next d20.',
    fullDescription: 'Each living player gets -1 on their next d20; it expires when their next turn ends.',
    metadata: { tone: 'moderate', icon: 'dice', privacy: 'public' }
  }),
  'supply-rot': definition({
    key: 'supply-rot', phase: 12, level: 3, intensity: 'Moderate', title: 'Supply Rot', interactive: false,
    shortDescription: 'Each living player discards and replaces 1 random owned hand card.',
    fullDescription: 'Each living player replaces 1 random owned hand card; borrowed cards are excluded.',
    metadata: { tone: 'moderate', icon: 'discard', privacy: 'private-cards' }
  }),
  gravewind: definition({
    key: 'gravewind', phase: 17, level: 4, intensity: 'Strong', title: 'Gravewind', interactive: false,
    shortDescription: 'Each living player permanently loses 1 random owned common card.',
    fullDescription: 'Each living player loses 1 random owned common card; specials and borrowed cards are excluded.',
    metadata: { tone: 'strong', icon: 'graveyard', privacy: 'private-cards' }
  }),
  'eclipse-of-fortune': definition({
    key: 'eclipse-of-fortune', phase: 17, level: 4, intensity: 'Strong', title: 'Eclipse of Fortune', interactive: false,
    shortDescription: 'Each living player pays up to 2 pity; each missing point costs 1 HP, ignoring shield.',
    fullDescription: 'Lose up to 2 pity; each missing point costs 1 HP, ignoring shield.',
    metadata: { tone: 'strong', icon: 'pity', privacy: 'public' }
  }),
  shieldquake: definition({
    key: 'shieldquake', phase: 17, level: 4, intensity: 'Strong', title: 'Shieldquake', interactive: false,
    shortDescription: 'Each living player loses all shield and 1 HP.',
    fullDescription: 'Each living player loses all shield and 1 HP.',
    metadata: { tone: 'strong', icon: 'shield-break', privacy: 'public' }
  }),
  'severed-oaths': definition({
    key: 'severed-oaths', phase: 22, level: 5, intensity: 'Severe', title: 'Severed Oaths', interactive: false,
    shortDescription: 'Clear every living player\'s combat modifiers, then give each -2 on their next d20.',
    fullDescription: 'Clear shield, attack bonuses, and d20 modifiers; then apply -2 to the next d20.',
    metadata: { tone: 'severe', icon: 'sever', privacy: 'public' }
  }),
  'time-fracture': definition({
    key: 'time-fracture', phase: 22, level: 5, intensity: 'Severe', title: 'Time Fracture', interactive: false,
    shortDescription: 'Each team\'s fastest survivor skips their next turn; a lone survivor gets -3 d20 instead.',
    fullDescription: 'Each team\'s fastest survivor skips a turn; a lone survivor gets -3 d20 instead.',
    metadata: { tone: 'severe', icon: 'time', privacy: 'public' }
  }),
  'crimson-debt': definition({
    key: 'crimson-debt', phase: 22, level: 5, intensity: 'Severe', title: 'Crimson Debt', interactive: false,
    shortDescription: 'Each living player loses 2 HP, ignoring shield, and up to 2 pity.',
    fullDescription: 'Each living player loses 2 HP, ignoring shield, and up to 2 pity.',
    metadata: { tone: 'severe', icon: 'debt', privacy: 'public' }
  }),
  'final-collapse': definition({
    key: 'final-collapse', phase: 27, level: 6, intensity: 'Catastrophic', title: 'Final Collapse', interactive: false,
    shortDescription: 'Each living player loses all shield, then takes 25% max-HP damage (minimum 2).',
    fullDescription: 'Lose all shield, then take 25% max-HP damage rounded up (minimum 2).',
    metadata: { tone: 'catastrophic', icon: 'collapse', privacy: 'public' }
  }),
  'the-last-cards': definition({
    key: 'the-last-cards', phase: 27, level: 6, intensity: 'Catastrophic', title: 'The Last Cards', interactive: false,
    shortDescription: 'Each living player permanently loses up to 2 random owned common cards, stopping at 4 reusable cards.',
    fullDescription: 'Lose up to 2 random owned common cards, but keep at least 4 reusable cards.',
    metadata: { tone: 'catastrophic', icon: 'cards', privacy: 'private-cards' }
  }),
  'sudden-death': definition({
    key: 'sudden-death', phase: 27, level: 6, intensity: 'Catastrophic', title: 'Sudden Death', interactive: false,
    shortDescription: 'Living players drop to at most half HP, lose all shield, and gain +2 next-attack damage.',
    fullDescription: 'Cap HP at half, lose all shield, and gain +2 next-attack damage.',
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
