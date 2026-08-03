export const DAGAN_FLINT_NAME = 'Dagan Flint';
export const DAGAN_FLINT_PASSIVE_DAMAGE_BONUS = 2;

export const DAGAN_FLINT_SPECIAL_CARDS = Object.freeze([
  Object.freeze({
    id: 'df-none',
    name: 'Bloodied Onslaught',
    description: 'Deal 3 damage to every living enemy (5 while Dagan is at half HP or lower).',
    bonus: 0,
    effect: 'aoe',
    target: 'all-enemies',
    value: 3,
    failureEffect: 'self-damage',
    failureValue: 2,
    pityCost: 7
  }),
  Object.freeze({
    id: 'df-cleave',
    name: 'Bloodied Cleave',
    description: 'Deal 3 damage to one living enemy (5 while Dagan is at half HP or lower).',
    bonus: 0,
    effect: 'damage',
    target: 'enemy',
    value: 3,
    failureEffect: 'self-damage',
    failureValue: 2,
    pityCost: 7
  }),
  Object.freeze({
    id: 'df-frenzy',
    name: 'Flintblood Fury',
    description: 'Gain +3 attack damage; expires at the end of your next turn.',
    bonus: 0,
    effect: 'support',
    target: 'self',
    value: 3,
    supportType: 'attack',
    failureEffect: 'self-damage',
    failureValue: 2,
    pityCost: 6
  })
]);

function templateCardId(cardId) {
  const id = String(cardId || '');
  const separator = id.lastIndexOf('::');
  return separator >= 0 ? id.slice(separator + 2) : id;
}

export function getDaganFlintPassiveDamageBonus(actor, card, state) {
  if (actor?.hero?.name !== DAGAN_FLINT_NAME || !['damage', 'aoe'].includes(card?.effect)) return 0;
  return state?.hp <= state?.maxHp / 2 ? DAGAN_FLINT_PASSIVE_DAMAGE_BONUS : 0;
}

export function normalizeDaganFlintCards(players) {
  const definitions = new Map(DAGAN_FLINT_SPECIAL_CARDS.map((card) => [card.id, card]));
  let changed = false;
  for (const player of players || []) {
    player.skillDeck = (player.skillDeck || []).map((card) => {
      const definition = definitions.get(templateCardId(card.id));
      if (!definition) return card;
      const normalized = { ...card, ...definition, id: card.id, unique: true };
      if (JSON.stringify(card) !== JSON.stringify(normalized)) changed = true;
      return normalized;
    });
  }
  return changed;
}
