import { getDaganFlintPassiveDamageBonus } from './daganFlint.mjs';

const isAttackCard = (card) => card?.effect === 'damage' || card?.effect === 'aoe';

function templateCardId(cardId) {
  const id = String(cardId || '');
  const separator = id.lastIndexOf('::');
  return separator >= 0 ? id.slice(separator + 2) : id;
}

export function getPassiveDiceBonus(player, card, state) {
  void card;
  void state;
  return player?.hero?.name === 'Ione Mire' ? 1 : 0;
}

export function getThorneValePassiveDamageBonus(player, card, state) {
  if (player?.hero?.name !== 'Thorne Vale' || card?.effect !== 'damage') return 0;
  return state?.thorneDeadeyeCharge ? 1 : 0;
}

export function thorneValeConsumesPassiveCharge(player, card, state, success, hasValidTarget) {
  return player?.hero?.name === 'Thorne Vale'
    && card?.effect === 'damage'
    && Boolean(state?.thorneDeadeyeCharge)
    && Boolean(success)
    && Boolean(hasValidTarget);
}

export function completeThorneValePassiveTurn(player, state, consumedCharge = false) {
  if (player?.hero?.name !== 'Thorne Vale' || !state) return false;
  const previousCharge = Boolean(state.thorneDeadeyeCharge);
  state.thorneDeadeyeCharge = consumedCharge ? false : true;
  return previousCharge !== state.thorneDeadeyeCharge;
}

export function reconcileThorneValePassive(previousGame, incomingGame, actor, players) {
  if (actor?.hero?.name !== 'Thorne Vale') return;
  const previousState = previousGame?.playerStates?.[actor.id];
  const incomingState = incomingGame?.playerStates?.[actor.id];
  const outcome = incomingGame?.outcome;
  if (!previousState || !incomingState) return;
  if (outcome?.kind !== 'card') {
    incomingState.thorneDeadeyeCharge = Boolean(previousState.thorneDeadeyeCharge);
    return;
  }
  const card = players.flatMap((player) => player.skillDeck || []).find((item) => item.id === outcome.cardId);
  const consumedCharge = thorneValeConsumesPassiveCharge(
    actor,
    card,
    previousState,
    outcome.success,
    Array.isArray(outcome.targetIds) && outcome.targetIds.length > 0
  );
  incomingState.thorneDeadeyeCharge = consumedCharge ? false : true;
}

export function getMiraAshPassiveDamageBonus(player, card) {
  return player?.hero?.name === 'Mira Ash' && card?.effect === 'aoe' ? 1 : 0;
}

export function getKaelRookPassiveDamageBonus(player, card, state, targetState) {
  if (player?.hero?.name !== 'Kael Rook' || !isAttackCard(card) || Number(state?.shield) > 0) return 0;
  return templateCardId(card?.id) === 'kr-duel' && Number(targetState?.shield) === 0 ? 2 : 1;
}

export function getCharacterAttackPassiveDamageBonus(player, card, state, targetState) {
  return getThorneValePassiveDamageBonus(player, card, state)
    + getMiraAshPassiveDamageBonus(player, card)
    + getDaganFlintPassiveDamageBonus(player, card, state)
    + getKaelRookPassiveDamageBonus(player, card, state, targetState);
}

export function passiveAttackIgnoresShield(player, card) {
  return player?.hero?.name === 'Nyx Calder' && isAttackCard(card);
}

export function getPassiveHealingBonus(player, card) {
  return player?.hero?.name === 'Brother Orren' && card?.effect === 'heal' ? 1 : 0;
}

export function getPassiveGuardBonus(player, card) {
  return player?.hero?.name === 'Elara Voss' && card?.effect === 'guard' ? 1 : 0;
}

export function getPassiveGuardDurationTurns(player, card) {
  return player?.hero?.name === 'Bram Coalhand' && card?.effect === 'guard' ? 2 : 1;
}
