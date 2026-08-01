import type { ActionCard } from './types';

export declare function isTestModeEnabled(value: unknown): boolean;
export declare function calculateRuntimePityCost(card: Omit<ActionCard, 'pityCost'> | ActionCard, testMode?: boolean): number;
