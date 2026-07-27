export function visibleDiceModifier(value: number | undefined, affectedPlayerKey?: string | null, viewerKey?: string | null) {
  return affectedPlayerKey && viewerKey && affectedPlayerKey === viewerKey ? value ?? 0 : 0;
}
