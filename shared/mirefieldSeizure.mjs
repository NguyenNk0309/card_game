export const MIREFIELD_SEIZURE_CARD = Object.freeze({
  id: 'im-purge',
  name: 'Mirefield Seizure',
  description: 'Move 1 random card from an enemy hand to their graveyard for 2 phases, preferring special cards; then return it to their draw pile.',
  bonus: 0,
  effect: 'support',
  target: 'enemy',
  value: 2,
  supportType: 'purge-card',
  failureEffect: 'enemy-shield',
  failureValue: 3,
  pityCost: 7
});

export function normalizeMirefieldSeizureCards(players) {
  let changed = false;
  for (const player of players || []) {
    player.skillDeck = (player.skillDeck || []).map((card) => {
      if (card.id !== MIREFIELD_SEIZURE_CARD.id) return card;
      const normalized = { ...card, ...MIREFIELD_SEIZURE_CARD, unique: true };
      if (JSON.stringify(card) !== JSON.stringify(normalized)) changed = true;
      return normalized;
    });
  }
  return changed;
}
