import type { Coord } from '@core/types';

function debugTileClick(coord: Coord): void {
  console.log(`[DEBUG_TILE_SELECT] Clicked tile at (${coord.x}, ${coord.y})`);
}

function debugPlayerSquareClick(isSelected: boolean): void {
  console.log(
    `[DEBUG_TILE_SELECT] Clicked player square, isSelected: ${isSelected}`,
  );
}

export { debugTileClick, debugPlayerSquareClick };
