export const PHASE_TIMELINE_LENGTH: 30;
export const UNLIMITED_BATTLE_PHASES: 0;
export const LAST_WORLD_EVENT_PHASE: 30;
export function getCurrentBattlePhase(completedPhases: number): number;
export function getVisualizedCompletedPhases(completedPhases: number): number;
export function getPhaseCountDenominator(currentPhase: number): "30" | "\u221e";
