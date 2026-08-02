import type { ActionCard, PlayerSession, SyncedGameState } from './types';

export const LIORA_VENN_NAME: 'Liora Venn';
export const LIORA_VENN_HEALTH_COST: 3;
export const LIORA_VENN_MINIMUM_HP: 4;
export const LIORA_VENN_SPECIAL_CARDS: readonly Omit<ActionCard, 'unique'>[];

export function templateCardId(cardId: string): string;
export function isLioraVennHealthExchangeCard(card?: Pick<ActionCard, 'id'> | null): boolean;
export function canPayLioraVennHealthCost(card: Pick<ActionCard, 'id'>, hp: number | undefined): boolean;
export function normalizeLioraVennCards(players: PlayerSession[]): boolean;
export function reconcileLioraVennImpact(
  previousGame: SyncedGameState,
  incomingGame: SyncedGameState,
  actor: PlayerSession,
  players: PlayerSession[]
): string;
