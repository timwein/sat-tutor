const SM2_INTERVALS = [1, 3, 7, 21];

/**
 * Get the next review interval based on SM-2.
 * Returns -1 when the item is mastered (remove from queue).
 */
export function getNextInterval(currentInterval: number, isCorrect: boolean): number {
  if (!isCorrect) return 1;

  const currentIndex = SM2_INTERVALS.indexOf(currentInterval);

  if (currentIndex === -1) {
    // Non-standard interval — find the next standard step
    const nextIndex = SM2_INTERVALS.findIndex((i) => i > currentInterval);
    return nextIndex !== -1 ? SM2_INTERVALS[nextIndex] : -1;
  }

  if (currentIndex >= SM2_INTERVALS.length - 1) {
    return -1; // Mastered — remove from review queue
  }

  return SM2_INTERVALS[currentIndex + 1];
}

export function getNextReviewDate(intervalDays: number): string {
  const next = new Date();
  next.setDate(next.getDate() + intervalDays);
  return next.toISOString().split('T')[0];
}
