import { getCharacterAttackPassiveDamageBonus, passiveAttackIgnoresShield } from './characterPassives.mjs';

export const BULWARK_TO_BLADE_CARD = Object.freeze({
  id: 'bc-march',
  name: 'Bulwark to Blade',
  description: 'Remove all your current shield, then deal that much damage to one living enemy.',
  bonus: 0,
  effect: 'damage',
  target: 'enemy',
  value: 0,
  failureEffect: 'lose-shield',
  failureValue: 4,
  pityCost: 7,
  unique: true
});

export function normalizeBulwarkToBladeCards(players) {
  let changed = false;
  for (const player of players || []) {
    player.skillDeck = (player.skillDeck || []).map((card) => {
      if (card.id !== BULWARK_TO_BLADE_CARD.id) return card;
      const normalized = { ...card, ...BULWARK_TO_BLADE_CARD };
      delete normalized.supportType;
      if (JSON.stringify(card) !== JSON.stringify(normalized)) changed = true;
      return normalized;
    });
  }
  return changed;
}

function removeTimedEffectAmount(state, kind, amount) {
  let remaining = Math.max(0, amount);
  state[kind] = Math.max(0, (state[kind] || 0) - remaining);
  state.timedEffects = (state.timedEffects || []).map((effect) => {
    if (effect.kind !== kind || remaining <= 0) return effect;
    const removed = Math.min(effect.value, remaining);
    remaining -= removed;
    return { ...effect, value: effect.value - removed };
  }).filter((effect) => effect.value > 0);
}

export function reconcileBulwarkToBladeImpact(previousGame, incomingGame, actor, players) {
  const outcome = incomingGame?.outcome;
  if (!previousGame || !incomingGame || !actor || outcome?.kind !== 'card') return '';
  const card = (players || []).flatMap((player) => player.skillDeck || []).find((item) => item.id === outcome.cardId)
    || (players || []).flatMap((player) => player.skillDeck || []).find((item) => item.name === outcome.cardName);
  if (card?.id !== BULWARK_TO_BLADE_CARD.id) return '';

  outcome.effect = 'damage';
  delete outcome.supportType;
  if (!outcome.success) return '';

  const targetIds = Array.isArray(outcome.targetIds) ? outcome.targetIds : [];
  const target = targetIds.length === 1 ? (players || []).find((player) => player.id === targetIds[0]) : null;
  const previousActorState = previousGame.playerStates?.[actor.id];
  const incomingActorState = incomingGame.playerStates?.[actor.id];
  const previousTargetState = target && previousGame.playerStates?.[target.id];
  const incomingTargetState = target && incomingGame.playerStates?.[target.id];
  if (!target || target.hero?.team === actor.hero?.team || !(previousTargetState?.hp > 0)) return 'Choose one living enemy for Bulwark to Blade.';
  if (!previousActorState || !incomingActorState || !incomingTargetState) return 'The Bulwark to Blade update is incomplete.';

  const sacrificedShield = Math.max(0, Number(previousActorState.shield) || 0);
  const attackBonus = Math.max(0, Number(previousActorState.attackBuff) || 0);
  const passiveBonus = getCharacterAttackPassiveDamageBonus(actor, card, previousActorState, previousTargetState);
  const power = sacrificedShield + attackBonus + passiveBonus;
  const ignoresShield = Boolean(card.ignoresShield || passiveAttackIgnoresShield(actor, card));
  const blocked = ignoresShield ? 0 : Math.min(Math.max(0, Number(previousTargetState.shield) || 0), power);
  const damage = Math.max(0, power - blocked);

  incomingActorState.shield = sacrificedShield;
  incomingActorState.timedEffects = [
    ...(incomingActorState.timedEffects || []).filter((effect) => effect.kind !== 'shield'),
    ...(previousActorState.timedEffects || []).filter((effect) => effect.kind === 'shield').map((effect) => ({ ...effect }))
  ];
  removeTimedEffectAmount(incomingActorState, 'shield', sacrificedShield);
  incomingActorState.attackBuff = attackBonus;
  incomingActorState.timedEffects = [
    ...(incomingActorState.timedEffects || []).filter((effect) => effect.kind !== 'attackBuff'),
    ...(previousActorState.timedEffects || []).filter((effect) => effect.kind === 'attackBuff').map((effect) => ({ ...effect }))
  ];
  removeTimedEffectAmount(incomingActorState, 'attackBuff', attackBonus);

  incomingTargetState.hp = Math.max(0, previousTargetState.hp - damage);
  incomingTargetState.shield = Math.max(0, Number(previousTargetState.shield) || 0);
  incomingTargetState.timedEffects = [
    ...(incomingTargetState.timedEffects || []).filter((effect) => effect.kind !== 'shield'),
    ...(previousTargetState.timedEffects || []).filter((effect) => effect.kind === 'shield').map((effect) => ({ ...effect }))
  ];
  removeTimedEffectAmount(incomingTargetState, 'shield', blocked);

  const defeated = previousTargetState.hp > 0 && incomingTargetState.hp === 0;
  if (defeated && target.hero?.name === 'Sable Fen' && !previousTargetState.passiveReviveUsed) {
    incomingTargetState.hp = Math.max(1, Math.ceil((incomingTargetState.maxHp || previousTargetState.maxHp || target.hero.maxHp) / 2));
    incomingTargetState.passiveReviveUsed = true;
    incomingTargetState.reviveIn = 0;
  }

  const detail = `${actor.displayName} removed ${sacrificedShield} shield. ${target.displayName} lost ${damage} HP${blocked ? ` (${blocked} blocked by shield)` : ''}${defeated ? ' and was defeated' : ''}.`;
  outcome.targetIds = [target.id];
  outcome.targetName = target.displayName;
  outcome.amount = damage;
  outcome.defeated = defeated;
  outcome.detail = detail;
  const historyEntry = [...(incomingGame.history || [])].reverse().find((entry) => entry.cardName === card.name && entry.actorName === actor.displayName);
  if (historyEntry) {
    historyEntry.kind = 'damage';
    historyEntry.targetName = target.displayName;
    historyEntry.amount = damage;
    historyEntry.success = true;
    historyEntry.message = `${actor.displayName} used ${card.name} — ${detail}`;
    delete historyEntry.failureDetail;
  }
  if (incomingGame.adventure) {
    incomingGame.adventure.veilInfluence = Number(previousGame.adventure?.veilInfluence || 0) + (actor.hero?.team === 'veil' ? damage : 0);
    incomingGame.adventure.emberInfluence = Number(previousGame.adventure?.emberInfluence || 0) + (actor.hero?.team === 'ember' ? damage : 0);
  }
  return '';
}
