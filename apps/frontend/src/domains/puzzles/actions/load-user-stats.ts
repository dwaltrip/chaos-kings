import { usePuzzleStore } from '@/domains/puzzles/stores/puzzle-store';
import { fetchUserStats } from '@/domains/puzzles/api';

async function loadUserStats(): Promise<void> {
  const { setUserStats } = usePuzzleStore.getState().actions;

  try {
    const stats = await fetchUserStats();
    setUserStats(stats);
  } catch (error) {
    console.error('Failed to load puzzle stats:', error);
  }
}

export { loadUserStats };
