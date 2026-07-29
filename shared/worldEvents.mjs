const definition = (event) => Object.freeze({
  ...event,
  description: event.shortDescription,
  metadata: Object.freeze(event.metadata)
});

export const WORLD_EVENT_DEFINITIONS = Object.freeze({
  'shattered-tribute': definition({
    key: 'shattered-tribute', phase: 3, level: 1, intensity: 'Opening', title: 'Shattered Tribute', interactive: true,
    shortDescription: 'Each living player sacrifices 2 owned common cards from hand, draw, or discard.',
    fullDescription: 'Choose 2 owned common cards from hand, draw, or discard; they move permanently to graveyard. Replace only cards removed from hand, using normal discard recycling if draw is empty. Choose all eligible cards if fewer than 2. Special and borrowed cards cannot be chosen.',
    metadata: { tone: 'opening', icon: 'tribute', privacy: 'private-choice' }
  }),
  'shifting-arsenal': definition({
    key: 'shifting-arsenal', phase: 7, level: 2, intensity: 'Minor', title: 'Shifting Arsenal', interactive: false,
    shortDescription: 'Each living player shuffles their owned hand into draw, then redraws the same number.',
    fullDescription: 'Owned hand cards return to draw, the pile shuffles, and the same number are redrawn. Borrowed cards stay in hand.',
    metadata: { tone: 'minor', icon: 'shuffle', privacy: 'private-cards' }
  }),
  'first-blood': definition({
    key: 'first-blood', phase: 7, level: 2, intensity: 'Minor', title: 'First Blood', interactive: false,
    shortDescription: 'Every living player loses 1 HP, ignoring shield.',
    fullDescription: 'Each living player loses 1 HP, ignoring shield. Defeats and eligible Sable Fen revives resolve afterward.',
    metadata: { tone: 'minor', icon: 'damage', privacy: 'public' }
  }),
  'unstable-wards': definition({
    key: 'unstable-wards', phase: 7, level: 2, intensity: 'Minor', title: 'Unstable Wards', interactive: false,
    shortDescription: 'Each living player loses up to 2 shield, or gains 1 pity if they have none.',
    fullDescription: 'Living players with shield lose up to 2; those with none gain 1 pity instead.',
    metadata: { tone: 'minor', icon: 'shield', privacy: 'public' }
  }),
  'broken-formation': definition({
    key: 'broken-formation', phase: 12, level: 3, intensity: 'Moderate', title: 'Broken Formation', interactive: false,
    shortDescription: 'Living-player order is randomized for phase 12.',
    fullDescription: 'Living-player order is shuffled for phase 12. Normal Speed order returns in phase 13.',
    metadata: { tone: 'moderate', icon: 'order', privacy: 'public' }
  }),
  'arcane-static': definition({
    key: 'arcane-static', phase: 12, level: 3, intensity: 'Moderate', title: 'Arcane Static', interactive: false,
    shortDescription: 'Each living player gets -1 on their next d20.',
    fullDescription: 'Each living player gets -1 on their next d20. It expires when that player\'s next turn ends, even by discard, skip, or timeout.',
    metadata: { tone: 'moderate', icon: 'dice', privacy: 'public' }
  }),
  'supply-rot': definition({
    key: 'supply-rot', phase: 12, level: 3, intensity: 'Moderate', title: 'Supply Rot', interactive: false,
    shortDescription: 'Each living player discards and replaces 1 random owned hand card.',
    fullDescription: 'Each living player discards 1 random owned hand card and draws into the same slot when possible. Borrowed cards are excluded; only the owner sees the card.',
    metadata: { tone: 'moderate', icon: 'discard', privacy: 'private-cards' }
  }),
  gravewind: definition({
    key: 'gravewind', phase: 17, level: 4, intensity: 'Strong', title: 'Gravewind', interactive: false,
    shortDescription: 'Each living player permanently loses 1 random owned common card.',
    fullDescription: 'Each living player permanently loses 1 random owned common card, searched hand first, then draw, then discard. Special and borrowed cards are excluded; a removed hand card is replaced when possible. Only its owner sees the card.',
    metadata: { tone: 'strong', icon: 'graveyard', privacy: 'private-cards' }
  }),
  'eclipse-of-fortune': definition({
    key: 'eclipse-of-fortune', phase: 17, level: 4, intensity: 'Strong', title: 'Eclipse of Fortune', interactive: false,
    shortDescription: 'Each living player pays up to 2 pity; each missing point costs 1 HP, ignoring shield.',
    fullDescription: 'Each living player loses up to 2 pity. Each unpaid point costs 1 HP, ignoring shield. Defeats and eligible Sable Fen revives resolve afterward.',
    metadata: { tone: 'strong', icon: 'pity', privacy: 'public' }
  }),
  shieldquake: definition({
    key: 'shieldquake', phase: 17, level: 4, intensity: 'Strong', title: 'Shieldquake', interactive: false,
    shortDescription: 'Each living player loses all shield and 1 HP.',
    fullDescription: 'Each living player loses all shield, then loses 1 HP ignoring shield. Defeats and eligible Sable Fen revives resolve afterward.',
    metadata: { tone: 'strong', icon: 'shield-break', privacy: 'public' }
  }),
  'severed-oaths': definition({
    key: 'severed-oaths', phase: 22, level: 5, intensity: 'Severe', title: 'Severed Oaths', interactive: false,
    shortDescription: 'Clear every living player\'s combat modifiers, then give each -2 on their next d20.',
    fullDescription: 'Each living player loses all shield, attack bonuses, and d20 modifiers, then gets -2 on their next d20.',
    metadata: { tone: 'severe', icon: 'sever', privacy: 'public' }
  }),
  'time-fracture': definition({
    key: 'time-fracture', phase: 22, level: 5, intensity: 'Severe', title: 'Time Fracture', interactive: false,
    shortDescription: 'Each team\'s fastest survivor skips their next turn; a lone survivor gets -3 d20 instead.',
    fullDescription: 'On teams with 2+ survivors, the fastest skips their next turn; Speed ties use join order. A lone survivor gets -3 on their next d20 instead.',
    metadata: { tone: 'severe', icon: 'time', privacy: 'public' }
  }),
  'crimson-debt': definition({
    key: 'crimson-debt', phase: 22, level: 5, intensity: 'Severe', title: 'Crimson Debt', interactive: false,
    shortDescription: 'Each living player loses 2 HP, ignoring shield, and up to 2 pity.',
    fullDescription: 'Each living player loses 2 HP, ignoring shield, and up to 2 pity. The HP loss applies even at 0 pity; defeats and eligible Sable Fen revives resolve afterward.',
    metadata: { tone: 'severe', icon: 'debt', privacy: 'public' }
  }),
  'final-collapse': definition({
    key: 'final-collapse', phase: 27, level: 6, intensity: 'Catastrophic', title: 'Final Collapse', interactive: false,
    shortDescription: 'Each living player loses all shield, then takes 25% max-HP damage (minimum 2).',
    fullDescription: 'Each living player loses all shield, then takes 25% max-HP damage rounded up (minimum 2), ignoring shield. Defeats and eligible Sable Fen revives resolve afterward.',
    metadata: { tone: 'catastrophic', icon: 'collapse', privacy: 'public' }
  }),
  'the-last-cards': definition({
    key: 'the-last-cards', phase: 27, level: 6, intensity: 'Catastrophic', title: 'The Last Cards', interactive: false,
    shortDescription: 'Each living player permanently loses up to 2 random owned common cards, stopping at 4 reusable cards.',
    fullDescription: 'Each living player permanently loses up to 2 random owned common cards from hand, draw, or discard, but keeps at least 4 reusable cards. Special and borrowed cards are excluded; removed hand cards are replaced when possible. Only the owner sees them.',
    metadata: { tone: 'catastrophic', icon: 'cards', privacy: 'private-cards' }
  }),
  'sudden-death': definition({
    key: 'sudden-death', phase: 27, level: 6, intensity: 'Catastrophic', title: 'Sudden Death', interactive: false,
    shortDescription: 'Living players drop to at most half HP, lose all shield, and gain +2 next-attack damage.',
    fullDescription: 'Living players are capped at half max HP rounded up (minimum 1), lose all shield, and gain +2 damage on their next successful attack.',
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
