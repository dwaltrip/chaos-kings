import { ColumnType, Generated } from 'kysely';

interface PuzzleAttemptsTable {
  id: Generated<number>;
  user_id: number;
  puzzle_type: string;
  land_count: number;
  army_count: number;
  config: object;
  map_seed: number;
  final_board_state: object | null;
  move_history: object;
  created_at: ColumnType<Date, string | undefined, never>;
}

export type { PuzzleAttemptsTable };
