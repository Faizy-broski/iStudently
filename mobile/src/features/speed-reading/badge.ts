/** Web getBadge: reader level from the best WPM. */
export function readingBadge(bestWpm: number): { key: 'jahbaz' | 'silver' | 'bronze' | 'beginner'; emoji: string } {
  if (bestWpm >= 150) return { key: 'jahbaz', emoji: '🏆' };
  if (bestWpm >= 100) return { key: 'silver', emoji: '🥈' };
  if (bestWpm >= 50) return { key: 'bronze', emoji: '🥉' };
  return { key: 'beginner', emoji: '📖' };
}
