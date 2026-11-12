/** Rotates the throwing order so the drawn player leads, keeping everyone else in sequence. */
export function rotateToFirst<T>(order: T[], winnerIndex: number): T[] {
  return [...order.slice(winnerIndex), ...order.slice(0, winnerIndex)];
}

/** Uniformly picks who throws first. */
export function pickFirstIndex(count: number, random: () => number = Math.random): number {
  return Math.min(count - 1, Math.floor(random() * count));
}
