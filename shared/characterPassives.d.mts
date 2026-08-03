import type { ActionCard, PlayerRunState, PlayerSession, SyncedGameState } from './types';

export function getPassiveDiceBonus(player: PlayerSession, card: ActionCard, state: PlayerRunState): number;
export function getThorneValePassiveDamageBonus(player: PlayerSession, card: ActionCard, state: PlayerRunState): number;
export function thorneValeConsumesPassiveCharge(player: PlayerSession, card: ActionCard | undefined, state: PlayerRunState, success: boolean, hasValidTarget: boolean): boolean;
export function completeThorneValePassiveTurn(player: PlayerSession, state: PlayerRunState, consumedCharge?: boolean): boolean;
export function reconcileThorneValePassive(previousGame: SyncedGameState, incomingGame: SyncedGameState, actor: PlayerSession, players: PlayerSession[]): void;
export function getMiraAshPassiveDamageBonus(player: PlayerSession, card: ActionCard): number;
export function getKaelRookPassiveDamageBonus(player: PlayerSession, card: ActionCard, state: PlayerRunState, targetState: PlayerRunState): number;
export function getCharacterAttackPassiveDamageBonus(player: PlayerSession, card: ActionCard, state: PlayerRunState, targetState: PlayerRunState): number;
export function passiveAttackIgnoresShield(player: PlayerSession, card: ActionCard): boolean;
export function getPassiveHealingBonus(player: PlayerSession, card: ActionCard): number;
export function getPassiveGuardBonus(player: PlayerSession, card: ActionCard): number;
export function getPassiveGuardDurationTurns(player: PlayerSession, card: ActionCard): number;
