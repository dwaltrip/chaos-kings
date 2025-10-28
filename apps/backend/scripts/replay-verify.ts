import { GameRepository } from '@/game/game-repository';
import { replayFrames } from '@core/replay/replayer';
import type { BoardState } from '@core/types';

function boardsEqual(a: BoardState, b: BoardState): boolean {
  if (a.size.width !== b.size.width || a.size.height !== b.size.height) return false;
  for (let y = 0; y < a.size.height; y++) {
    for (let x = 0; x < a.size.width; x++) {
      const s1 = a.grid[y][x] as any;
      const s2 = b.grid[y][x] as any;
      if (s1.type !== s2.type) return false;
      if (s1.type === 'ARMY' || s1.type === 'PLAYER_CITY' || s1.type === 'GENERAL') {
        if (s1.playerIndex !== s2.playerIndex) return false;
        if (s1.units !== s2.units) return false;
      }
    }
  }
  return true;
}

function diffBoard(a: BoardState, b: BoardState): string[] {
  const diffs: string[] = [];
  for (let y = 0; y < a.size.height; y++) {
    for (let x = 0; x < a.size.width; x++) {
      const s1 = a.grid[y][x] as any;
      const s2 = b.grid[y][x] as any;
      const coord = `(${x},${y})`;
      if (s1.type !== s2.type) {
        diffs.push(`${coord}: type ${s1.type} != ${s2.type}`);
        continue;
      }
      if (s1.type === 'ARMY' || s1.type === 'PLAYER_CITY' || s1.type === 'GENERAL') {
        if (s1.playerIndex !== s2.playerIndex)
          diffs.push(`${coord}: player ${s1.playerIndex} != ${s2.playerIndex}`);
        if (s1.units !== s2.units)
          diffs.push(`${coord}: units ${s1.units} != ${s2.units}`);
      }
    }
  }
  return diffs;
}

async function main() {
  const args = new Map<string, string>();
  for (const part of process.argv.slice(2)) {
    const [k, v] = part.startsWith('--') ? part.slice(2).split('=') : [part, 'true'];
    args.set(k, v ?? '');
  }
  const idStr = args.get('gameId');
  if (!idStr) {
    console.error('Usage: ts-node scripts/replay-verify.ts --gameId=<id>');
    process.exit(2);
  }
  const gameId = Number(idStr);
  if (!Number.isFinite(gameId)) {
    console.error('Invalid gameId');
    process.exit(2);
  }

  const repo = new GameRepository();
  const game = await repo.findById(gameId);
  if (!game) {
    console.error(`Game ${gameId} not found`);
    process.exit(1);
  }
  if (!game.move_history) {
    console.error(`Game ${gameId} has no move_history`);
    process.exit(1);
  }

  const { config, move_history, game_state } = game as any;
  if (!config || !config.size || !config.startingGrid) {
    console.error('Game has invalid or missing config');
    process.exit(1);
  }
  if (!game_state || !game_state.board) {
    console.error('Game has no saved final game_state.board');
    process.exit(1);
  }

  // Re-simulate from config + move_history until game end.
  let final: BoardState | null = null;
  for (const frame of replayFrames(config, move_history)) {
    if (frame.gameEnded) {
      final = frame.board;
      break;
    }
  }
  if (!final) {
    console.error('Replay did not reach game end; unable to verify determinism');
    process.exit(1);
  }

  const saved: BoardState = game_state.board;
  if (boardsEqual(final, saved)) {
    console.log(`OK: Game ${gameId} replay matches saved final board.`);
    process.exit(0);
  } else {
    console.error(`MISMATCH: Game ${gameId} replay differs from saved final board.`);
    for (const line of diffBoard(final, saved)) console.error('  ' + line);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error running replay verification:', err);
  process.exit(1);
});
