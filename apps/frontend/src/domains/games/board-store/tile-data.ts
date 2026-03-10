import type { TileData } from './types';

function tilesEqual(a: TileData, b: TileData): boolean {
  return (
    a.type === b.type &&
    a.playerIndex === b.playerIndex &&
    a.armyCount === b.armyCount &&
    a.isVisible === b.isVisible &&
    a.neighborVisTop === b.neighborVisTop &&
    a.neighborVisLeft === b.neighborVisLeft &&
    a.isSelected === b.isSelected &&
    a.isSelectable === b.isSelectable &&
    a.isValidMove === b.isValidMove &&
    a.hasTopBorder === b.hasTopBorder &&
    a.hasLeftBorder === b.hasLeftBorder &&
    a.queuedUp === b.queuedUp &&
    a.queuedDown === b.queuedDown &&
    a.queuedLeft === b.queuedLeft &&
    a.queuedRight === b.queuedRight
  );
}

export { tilesEqual };
