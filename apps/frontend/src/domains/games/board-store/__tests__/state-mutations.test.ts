import { describe, it, expect } from 'vitest';
import { Direction } from '@core/types';

import {
  modifiedStandardBoard,
  setup,
  setupStandard,
  setupFog,
  tileAt,
  makeMove,
} from './helpers';

describe('State mutations and diffing', () => {
  it('applyTick with changed army count updates affected tile', () => {
    const { store, applyTick } = setupStandard();
    const refBefore = store.getTileData({ x: 0, y: 0 });

    applyTick(1, modifiedStandardBoard(10), [], []);

    // Changed tile has new data
    expect(store.getTileData({ x: 1, y: 1 }).armyCount).toBe(10);
    // Unchanged tile — same reference
    expect(store.getTileData({ x: 0, y: 0 })).toBe(refBefore);
  });

  it('setSelectedTile updates old and new selected tiles', () => {
    const { store, setSelectedTile } = setupStandard();

    setSelectedTile({ x: 1, y: 1 });
    expect(store.getTileData({ x: 1, y: 1 }).isSelected).toBe(true);

    setSelectedTile({ x: 0, y: 0 });
    expect(store.getTileData({ x: 1, y: 1 }).isSelected).toBe(false);
    expect(store.getTileData({ x: 0, y: 0 }).isSelected).toBe(true);
  });

  it('setSelectedTile with same coord does not change tile data', () => {
    const { store, setSelectedTile } = setupStandard();
    setSelectedTile({ x: 1, y: 1 });

    const refBefore = store.getTileData({ x: 1, y: 1 });
    setSelectedTile({ x: 1, y: 1 });
    const refAfter = store.getTileData({ x: 1, y: 1 });
    expect(refBefore).toBe(refAfter);
  });

  it('setSelectedTile(null) clears selection', () => {
    const { store, setSelectedTile } = setupStandard();
    setSelectedTile({ x: 1, y: 1 });
    setSelectedTile(null);
    expect(tileAt(store, 1, 1).isSelected).toBe(false);
  });

  it('queued move shows direction on tile', () => {
    const { store, queueMoveOnBoard } = setupStandard();
    queueMoveOnBoard({ x: 1, y: 1 }, Direction.UP);
    expect(tileAt(store, 1, 1).queuedUp).toBe(true);
  });

  it('multiple queued moves from same tile accumulate', () => {
    const { store, queueMoveOnBoard, setSelectedTile } = setupStandard();
    queueMoveOnBoard({ x: 1, y: 1 }, Direction.UP);
    setSelectedTile({ x: 1, y: 1 });
    queueMoveOnBoard({ x: 1, y: 1 }, Direction.DOWN);
    const tile = tileAt(store, 1, 1);
    expect(tile.queuedUp).toBe(true);
    expect(tile.queuedDown).toBe(true);
  });

  it('undoLastQueuedMove removes last move', () => {
    const { store, queueMoveOnBoard, undoLastQueuedMove } = setupStandard();
    queueMoveOnBoard({ x: 1, y: 1 }, Direction.UP);
    queueMoveOnBoard({ x: 1, y: 0 }, Direction.LEFT);
    undoLastQueuedMove();
    expect(tileAt(store, 1, 0).queuedLeft).toBe(false);
    expect(tileAt(store, 1, 1).queuedUp).toBe(true);
  });

  it('setStatus to ended makes all tiles visible and non-selectable', () => {
    const { store, setStatus } = setupStandard();
    setStatus('ended');
    expect(tileAt(store, 1, 1).isVisible).toBe(true);
    expect(tileAt(store, 1, 1).isSelectable).toBe(false);

    // Also verify with fog board
    const { store: fogStore, setStatus: fogSetStatus } = setupFog();
    fogSetStatus('ended');
    expect(tileAt(fogStore, 4, 4).isVisible).toBe(true);
  });
});

// Standard board: player army at (1,1), mountain at (2,1)
// Valid moves from (1,1): UP→(1,0), DOWN→(1,2), LEFT→(0,1). RIGHT blocked by mountain.
describe('queueMoveOnBoard', () => {
  it('returns false if board is null', () => {
    const { queueMoveOnBoard } = setup();
    expect(queueMoveOnBoard({ x: 1, y: 1 }, Direction.UP)).toBe(false);
  });

  it('returns false if move is invalid', () => {
    const { queueMoveOnBoard } = setupStandard();
    expect(queueMoveOnBoard({ x: 1, y: 1 }, Direction.RIGHT)).toBe(false);
  });

  it('returns true and adds move on valid move', () => {
    const { store, queueMoveOnBoard } = setupStandard();
    expect(queueMoveOnBoard({ x: 1, y: 1 }, Direction.UP)).toBe(true);
    expect(store.state.game.queuedMoves).toHaveLength(1);
  });

  it('moves selectedTile to destination', () => {
    const { store, queueMoveOnBoard } = setupStandard();
    queueMoveOnBoard({ x: 1, y: 1 }, Direction.UP);
    expect(store.state.ui.selectedTile).toEqual({ x: 1, y: 0 });
  });

  it('resets hasUserSelectedSinceLastQueue to false', () => {
    const { store, userSelectTile, queueMoveOnBoard } = setupStandard();
    userSelectTile({ x: 1, y: 1 });
    expect(store.state.ui.hasUserSelectedSinceLastQueue).toBe(true);
    queueMoveOnBoard({ x: 1, y: 1 }, Direction.UP);
    expect(store.state.ui.hasUserSelectedSinceLastQueue).toBe(false);
  });
});

// (1,1) → UP to (1,0) → LEFT to (0,0)
function makeMoveChainUpAndLeftFrom1_1() {
  return [
    makeMove({ x: 1, y: 1 }, Direction.UP),
    makeMove({ x: 1, y: 0 }, Direction.LEFT),
  ];
}

describe('cancelQueuedMoves', () => {
  it('returns false if no queued moves', () => {
    const { cancelQueuedMoves } = setupStandard();
    expect(cancelQueuedMoves()).toBe(false);
  });

  it('clears all queued moves', () => {
    const { store, cancelQueuedMoves } = setupStandard();
    store.mutate((state) => {
      state.game.queuedMoves = makeMoveChainUpAndLeftFrom1_1();
    });
    cancelQueuedMoves();
    expect(store.state.game.queuedMoves).toHaveLength(0);
  });

  it('snaps selectedTile back when user has not selected since last queue', () => {
    const { store, cancelQueuedMoves } = setupStandard();
    store.mutate((state) => {
      state.game.queuedMoves = makeMoveChainUpAndLeftFrom1_1();
      state.ui.selectedTile = { x: 0, y: 0 };
      state.ui.hasUserSelectedSinceLastQueue = false;
    });

    cancelQueuedMoves();
    expect(store.state.ui.selectedTile).toEqual({ x: 1, y: 1 });
  });

  it('leaves selectedTile unchanged when user selected since last queue', () => {
    const { store, cancelQueuedMoves } = setupStandard();
    store.mutate((state) => {
      state.game.queuedMoves = makeMoveChainUpAndLeftFrom1_1();
      state.ui.selectedTile = { x: 2, y: 2 };
      state.ui.hasUserSelectedSinceLastQueue = true;
    });

    cancelQueuedMoves();
    expect(store.state.ui.selectedTile).toEqual({ x: 2, y: 2 });
    expect(store.state.game.queuedMoves).toHaveLength(0);
  });

  it('resets hasUserSelectedSinceLastQueue after snap', () => {
    const { store, cancelQueuedMoves } = setupStandard();
    store.mutate((state) => {
      state.game.queuedMoves = [makeMove({ x: 1, y: 1 }, Direction.UP)];
      state.ui.selectedTile = { x: 1, y: 0 };
      state.ui.hasUserSelectedSinceLastQueue = true;
    });
    cancelQueuedMoves();
    expect(store.state.ui.hasUserSelectedSinceLastQueue).toBe(false);
  });

  it('does not snap back if player no longer owns the snap target tile', () => {
    const { store, cancelQueuedMoves } = setupStandard();
    store.mutate((state) => {
      state.game.queuedMoves = makeMoveChainUpAndLeftFrom1_1();
      state.ui.selectedTile = { x: 0, y: 0 };
      state.ui.hasUserSelectedSinceLastQueue = false;
      // enemy took over (1,1)
      state.game.board!.grid[1][1] = {
        coord: { x: 1, y: 1 },
        type: 'ARMY',
        playerIndex: 1,
        units: 3,
      };
    });

    cancelQueuedMoves();
    // should NOT snap to (1,1) since player 0 no longer owns it
    expect(store.state.ui.selectedTile).toEqual({ x: 0, y: 0 });
  });
});
