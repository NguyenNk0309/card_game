import type { ActionCard, PlayerRunState, PlayerSession, ShopCategory, SyncedGameState } from './types';

export type ShopOffer = {
  id: string;
  category: ShopCategory;
  name: string;
  description: string;
  basePriceUnits: number;
  repeatIncreaseUnits: number;
  purchaseLimit: number;
  amount?: number;
  card?: Omit<ActionCard, 'id'>;
};

export declare const MAX_GOLD_UNITS: number;
export declare const MAX_GOLD: number;
export declare const SHOP_INVENTORY_CAP: number;
export declare const MAX_EXTERNAL_CARDS: number;
export declare const PITY_EXCHANGE_GOLD_UNITS: number;
export declare const SHOP_CATALOG: readonly ShopOffer[];
export declare function getShopOffer(offerId: string): ShopOffer | undefined;
export declare function formatGoldUnits(units: number): string;
export declare function getShopPriceUnits(offer: ShopOffer, purchaseCount?: number): number;
export declare function normalizeShopState<T extends PlayerRunState>(state: T): T;
export declare function getInventoryQuantity(state: PlayerRunState, itemId: string): number;
export declare function getInventorySize(state: PlayerRunState): number;
export declare function purchaseShopOffer(game: SyncedGameState, players: PlayerSession[], playerId: string, offerId: string, now?: number): { ok: boolean; error?: string; offer?: ShopOffer; priceUnits?: number };
export declare function exchangePityForGold(game: SyncedGameState, players: PlayerSession[], playerId: string, now?: number): { ok: boolean; error?: string };
export declare function useShopItem(game: SyncedGameState, players: PlayerSession[], playerId: string, itemId: string, now?: number): { ok: boolean; error?: string; offer?: ShopOffer };
export declare function goldRewardUnitsForOutcome(outcome: unknown): number;
export declare function applyGoldReward(state: PlayerRunState, outcome: object): number;
export declare function reconcileShopTurn(previousGame: SyncedGameState, incomingGame: SyncedGameState, players: PlayerSession[], actor: PlayerSession): void;
export declare function stripShopCards(player: PlayerSession): PlayerSession;
export declare function initializeShopBattle(game: SyncedGameState, players: PlayerSession[]): void;
