export const PHASE_TIMELINE_LENGTH = 30;
export const UNLIMITED_BATTLE_PHASES = 0;
export const LAST_WORLD_EVENT_PHASE = 30;

function normalizeCompletedPhases(completedPhases) {
  const value = Math.floor(Number(completedPhases));
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function getCurrentBattlePhase(completedPhases) {
  return normalizeCompletedPhases(completedPhases) + 1;
}

export function getVisualizedCompletedPhases(completedPhases) {
  return Math.min(PHASE_TIMELINE_LENGTH, normalizeCompletedPhases(completedPhases));
}

export function getPhaseCountDenominator(currentPhase) {
  return Number(currentPhase) > PHASE_TIMELINE_LENGTH ? "\u221e" : String(PHASE_TIMELINE_LENGTH);
}
