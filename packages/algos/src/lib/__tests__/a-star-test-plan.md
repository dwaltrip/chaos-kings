# A* (`findGridPath`) Test Plan

## Function signature

```ts
function findGridPath(
  startCoord: Coord,
  goalCoord: Coord,
  gridSize: { width: number; height: number },
  heuristic: HeuristicFn,
  isPassable?: (coord: CoordStr) => boolean,
): Coord[] | null;
```

- `Coord` is `{ x: number; y: number }`.
- `CoordStr` is a string of the form `"x,y"`.
- `HeuristicFn` is `(a: Coord, b: Coord) => number`.
- Movement is 4-directional (up/down/left/right), cost 1 per step.
- `isPassable` is checked on neighbors only — the start coord is never checked.

---

## 1. Trivial / degenerate cases

| # | Test | Expected |
|---|------|----------|
| 1.1 | Start equals goal | `[start]` (path of length 1) |
| 1.2 | Start and goal are adjacent (horizontal) | `[start, goal]` |
| 1.3 | Start and goal are adjacent (vertical) | `[start, goal]` |

## 2. Optimal path length (open grid, no obstacles)

| # | Test | Expected |
|---|------|----------|
| 2.1 | Horizontal line across a wide grid | Path length = manhattan + 1, all coords on the same row |
| 2.2 | Vertical line down a tall grid | Path length = manhattan + 1, all coords in the same column |
| 2.3 | Diagonal-ish path on a 5x5 grid (e.g. (0,0) to (4,4)) | Path length = 9 |
| 2.4 | Opposite corners of a 10x10 grid | Path length = 19 |

## 3. Path correctness (structural validation)

| # | Test | Expected |
|---|------|----------|
| 3.1 | First element of returned path is startCoord | Always true |
| 3.2 | Last element of returned path is goalCoord | Always true |
| 3.3 | Each consecutive pair of coords are adjacent (differ by exactly 1 in x or y, not both) | Always true |
| 3.4 | No coord in path is out of grid bounds | Always true |
| 3.5 | No coord in the returned path (except start) is marked impassable | Always true |

## 4. Obstacles / passability

| # | Test | Expected |
|---|------|----------|
| 4.1 | Wall blocks the direct path, must go around | Path is longer than manhattan distance but still optimal |
| 4.2 | Goal is completely surrounded by impassable tiles | `null` |
| 4.3 | Start is completely surrounded by impassable tiles (start != goal) | `null` |
| 4.4 | Narrow corridor (single-tile-wide passage) | Finds the corridor path |
| 4.5 | Multiple possible routes around an obstacle — path length is optimal | Path length equals the shortest possible |
| 4.6 | Small maze with a unique shortest path — assert exact path | Exact path matches expected coords |

## 5. Passability of start and goal tiles

| # | Test | Expected |
|---|------|----------|
| 5.1 | Start is marked impassable, goal is reachable | Still finds path (start bypasses passability check) |
| 5.2 | Goal tile is marked impassable | `null` (goal is reached as a neighbor and rejected) |
| 5.3 | Start = goal, start is marked impassable | `[start]` (start bypasses check, goal-check happens immediately) |

## 6. Unreachable goal

| # | Test | Expected |
|---|------|----------|
| 6.1 | Goal blocked off by wall spanning the grid | `null` |

## 7. Edge grids (small/narrow)

| # | Test | Expected |
|---|------|----------|
| 7.1 | 1x1 grid, start = goal = (0,0) | `[{x:0,y:0}]` |
| 7.2 | 1xN grid (single row) | Straight horizontal path |
| 7.3 | Nx1 grid (single column) | Straight vertical path |
| 7.4 | 2x2 grid, opposite corners | Path of length 3 |

## 8. Heuristic behavior

| # | Test | Expected |
|---|------|----------|
| 8.1 | Zero heuristic (h=0, degrades to Dijkstra) | Still finds optimal-length path |
| 8.2 | Manhattan distance heuristic | Finds optimal-length path |

## 9. isPassable callback

| # | Test | Expected |
|---|------|----------|
| 9.1 | No isPassable provided (undefined) — all tiles passable | Finds path normally |
| 9.2 | isPassable blocks specific tiles | Path avoids those tiles |
| 9.3 | isPassable receives CoordStr in "x,y" format | Verify via mock/spy |
| 9.4 | isPassable is never called with the start coord | Verify via mock/spy |

## 10. Larger grids

| # | Test | Expected |
|---|------|----------|
| 10.1 | 50x50 open grid, opposite corners | Path length = 99 |
| 10.2 | 100x100 grid with scattered obstacles | Returns valid optimal-length path, passes structural checks |
