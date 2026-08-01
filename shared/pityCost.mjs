export function isTestModeEnabled(value) {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

export function calculateRuntimePityCost(card, testMode = false) {
  if (testMode) return 0;
  const storedCost = Number(card?.pityCost);
  if (Number.isFinite(storedCost) && storedCost >= 0) return Math.min(8, Math.floor(storedCost));
  if (card?.effect === 'none') return 0;
  if (!card?.unique) return Math.min(5, Math.max(3, Number(card?.value) || 0));
  if (card?.effect === 'damage') return Math.min(8, 2 + (Number(card.value) || 0) + (card.ignoresShield ? 1 : 0));
  if (card?.effect === 'aoe') return Math.min(8, 3 + (Number(card.value) || 0) + (card.ignoresShield ? 1 : 0));
  if (card?.effect === 'heal' || card?.effect === 'guard') return Math.min(7, 2 + (Number(card.value) || 0));
  if (['revive', 'skip-enemy', 'steal-card'].includes(card?.supportType || '')) return 7;
  if (['purge-card', 'advance-ally', 'dispel-enemy'].includes(card?.supportType || '')) return 6;
  if (card?.supportType === 'shield-to-attack') return 6;
  return Math.min(6, 3 + (Number(card?.value) || 0));
}
