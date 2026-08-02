export type CardZoneChange = {
  slotIndex: number;
  discardedId?: string;
  drawnId?: string;
};

function unmatchedIndexes(source: string[], target: string[]) {
  const remaining = target.reduce((counts, cardId) => {
    counts.set(cardId, (counts.get(cardId) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());

  return source.flatMap((cardId, index) => {
    const available = remaining.get(cardId) ?? 0;
    if (available > 0) {
      remaining.set(cardId, available - 1);
      return [];
    }
    return [index];
  });
}

export function getCardZoneChanges(previousHand: string[], nextHand: string[], forcedDiscardSlots: number[] = []): CardZoneChange[] {
  const sameSize = previousHand.length === nextHand.length;
  const forcedIndexes = forcedDiscardSlots.filter((index) => index >= 0 && index < previousHand.length);
  const forced = new Set(forcedIndexes);
  const retainedPreviousHand = previousHand.filter((_, index) => !forced.has(index));
  const outgoingIndexes = sameSize
    ? previousHand.flatMap((cardId, index) => cardId !== nextHand[index] ? [index] : [])
    : unmatchedIndexes(previousHand, nextHand);
  const incomingIndexes = sameSize
    ? [...new Set([...outgoingIndexes, ...forcedIndexes.filter((index) => index < nextHand.length)])]
    : unmatchedIndexes(nextHand, retainedPreviousHand);
  const changedIndexes = [...new Set([...outgoingIndexes, ...incomingIndexes, ...forcedIndexes])].sort((left, right) => left - right);
  const outgoing = new Set(outgoingIndexes);
  const incoming = new Set(incomingIndexes);

  return changedIndexes.flatMap((slotIndex) => {
    const discardedId = outgoing.has(slotIndex) || forced.has(slotIndex) ? previousHand[slotIndex] : undefined;
    const drawnId = incoming.has(slotIndex) ? nextHand[slotIndex] : undefined;
    return discardedId || drawnId ? [{ slotIndex, discardedId, drawnId }] : [];
  });
}
