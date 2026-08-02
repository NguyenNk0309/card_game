import type { ActionCard, PlayerSession } from './types';

export const MIREFIELD_SEIZURE_CARD: Readonly<Omit<ActionCard, 'unique'>>;
export function normalizeMirefieldSeizureCards(players: PlayerSession[]): boolean;
