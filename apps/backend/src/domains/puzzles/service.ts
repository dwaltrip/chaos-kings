import type { PuzzleService } from '@protocol/domains/puzzles/service';

import { getUserStats } from './actions';

const puzzleService: PuzzleService = {
  getUserStats,
};

export { puzzleService };
