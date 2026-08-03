import type { ActionCard, PlayerRunState, PlayerSession } from './types';

export const DAGAN_FLINT_NAME: 'Dagan Flint';
export const DAGAN_FLINT_PASSIVE_DAMAGE_BONUS: 2;
export const DAGAN_FLINT_SPECIAL_CARDS: readonly Omit<ActionCard, 'unique'>[];

export function getDaganFlintPassiveDamageBonus(
  actor: PlayerSession,
  card: Pick<ActionCard, 'effect'>,
  state: PlayerRunState
): number;
export function normalizeDaganFlintCards(players: PlayerSession[]): boolean;
