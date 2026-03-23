# Board Infrastructure Reference

Quick reference for the board loading, path generation, and utility infrastructure used by the solver and experiments.

## 1. Test board definitions

**File:** `test-boards.ts`

Boards loaded from text files in `test-boards-data/`. Three categories:
- **Simple** (7x7-13x13, hand-crafted): `open-7x7`, `corner-9x9`, `pocket-11x11`, etc.
- **Realistic** (25x25-30x30, generated): `3.21-real-board-tight-corner-1`, etc.
- **Slow board lists**: `SLOW_SEARCH` and `SLOW_PATHGEN` tracking performance bottlenecks

Board format: `.` = blank, `M` = mountain, `G` = general (player 0).

```typescript
makeBoard(name)                    // returns TestBoard by name
allBoards(), simpleBoards(), realisticBoards(), slowSearch()  // batch loaders
parseBoard(name, text)             // parse text grid
```

## 2. Board loading pattern

```typescript
// test-boards.ts
const testBoard = makeBoard('corner-9x9');  // { name, board: BoardState, generalCoord }

// convert.ts
const flatBoard = fromBoardState(testBoard.board, 1);

// flat-board.ts
const generalPos = Board.toIndex(flatBoard, generalCoord.x, generalCoord.y);

// solver-v3.ts
const result = solveV3(flatBoard, generalPos, options);
```

The `run.ts` CLI supports: `--board all`, `--board simple`, `--board realistic`, `--board corner-9x9`, `--board 25x25,corner`.

## 3. FlatBoard and Board namespace

**File:** `@/core-next/flat-board.ts`

```typescript
interface FlatBoard {
  types: Uint8Array;      // TileType per cell
  owners: Int8Array;      // Player index or -1
  units: Int32Array;      // Unit count per cell
  width: number;
  height: number;
  stats: { landCounts: number[]; armyCounts: number[] };
  prodTiles: number[];
}
```

TileTypes: `BLANK (0)`, `MOUNTAIN (1)`, `ARMY (3)`, `GENERAL (4)`, `PLAYER_CITY (5)`

Board namespace:
- **Index:** `toIndex(x,y)`, `toXY(idx)`, `isValidIndex()`, `isValidCoord()`
- **Navigation:** `neighbor()`, `neighborUp/Down/Left/Right()`
- **Read:** `getTile()`, `getTileByIdx()`, `isPassable()`
- **Iteration:** `forEachTile()`, `mapTiles()`, `mapTiles2d()`
- **Mutation:** `setTile()`, `addUnits()`

## 4. Path generation and PathEntry

**Files:** `custom-algo-1/gen-paths.ts`, `custom-algo-1/path-search.ts`

```typescript
// gen-paths.ts — DP path enumeration from general
genPathsDP(board, start, maxLen)  // → GenPathsByLen = Map<length, GenPath[]>

// path-search.ts — strips general, re-keys by move length
buildPathEntries(genPaths)        // → PathEntriesByLen = Map<moveLen, PathEntry[]>

interface PathEntry {
  tiles: number[];    // ordered tile indices (general excluded)
  mask: bigint;       // bitmask of covered tiles
}

countPrefixOverlap(tiles, coveredMask)  // → prefix overlap length or -1
```

## 5. Bitmask utilities

**File:** `custom-algo-1/bitmask.ts`

```typescript
tilesToMask(tiles)      // number[] → bigint
maskToTiles(mask)       // bigint → number[]
hasOverlap(a, b)        // bitwise AND check
popcount(mask)          // count set bits (Brian Kernighan)
```

## 6. Board graph utilities

**File:** `utils/board-graph.ts`

```typescript
getWalkableNeighbors(board, tile)   // non-mountain neighbors
getWalkableDegree(board, tile)      // neighbor count
getWalkableTiles(board)             // all non-mountain tiles
findCorridors(board)                // degree-2 chains
tarjan(board)                       // articulation points and bridges
decomposeRegions(board, cutVertices) // flood-fill regions
```

## 7. Other utilities

- **`format.ts`:** `formatTable(headers, rows)` — markdown table formatter
- **`board-bfs.ts`:** BFS distance computation with bitmask output
- **`@/core-next/convert.ts`:** `fromBoardState(boardState, playerCount)` — BoardState → FlatBoard

## 8. Experiment script pattern

```typescript
// Usage: npx tsx src/perfect-start-solver/research-spike-1/experiments/FILENAME.ts
import { Board, type FlatBoard } from '@/core-next/flat-board';
import { fromBoardState } from '@/core-next/convert';
import { solveV3 } from '../../custom-algo-1/solver-v3';
import { formatTable } from '../../format';
import { simpleBoards, type TestBoard } from '../../test-boards';

for (const tb of simpleBoards()) {
  const board = fromBoardState(tb.board, 1);
  const generalPos = Board.toIndex(board, tb.generalCoord.x, tb.generalCoord.y);
  const result = solveV3(board, generalPos);
  // analyze + print with formatTable()
}
```

Output saved to `experiments/output/` (gitignored).
