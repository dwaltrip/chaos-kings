import { findGridPath } from '../a-star';

type Coord = { x: number; y: number };
type CoordStr = string;
type HeuristicFn = (a: Coord, b: Coord) => number;

function manhattanDistance(a: Coord, b: Coord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function zeroHeuristic(_a: Coord, _b: Coord): number {
  return 0;
}

function toCoordStr(c: Coord): CoordStr {
  return `${c.x},${c.y}`;
}

function blockedSet(blocked: Coord[]): (coord: CoordStr) => boolean {
  const set = new Set(blocked.map(toCoordStr));
  return (coord: CoordStr) => !set.has(coord);
}

// Validates structural correctness of a path result (tests 3.1–3.5)
function validatePath(
  path: Coord[],
  start: Coord,
  goal: Coord,
  gridSize: { width: number; height: number },
  blocked: Coord[] = [],
): void {
  // 3.1 — first element is start
  expect(path[0]).toEqual(start);

  // 3.2 — last element is goal
  expect(path[path.length - 1]).toEqual(goal);

  // 3.3 — each consecutive pair is adjacent (differ by exactly 1 in x or y)
  for (let i = 1; i < path.length; i++) {
    const dx = Math.abs(path[i].x - path[i - 1].x);
    const dy = Math.abs(path[i].y - path[i - 1].y);
    expect(dx + dy).toBe(1);
  }

  // 3.4 — no coord is out of bounds
  for (const c of path) {
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(c.x).toBeLessThan(gridSize.width);
    expect(c.y).toBeGreaterThanOrEqual(0);
    expect(c.y).toBeLessThan(gridSize.height);
  }

  // 3.5 — no coord except start is impassable
  const blockedStrs = new Set(blocked.map(toCoordStr));
  for (let i = 1; i < path.length; i++) {
    expect(blockedStrs.has(toCoordStr(path[i]))).toBe(false);
  }
}

// ---------------------------------------------------------------------------
// 1. Trivial / degenerate cases
// ---------------------------------------------------------------------------

describe('trivial / degenerate cases', () => {
  it('1.1 — start equals goal returns path of length 1', () => {
    const start = { x: 2, y: 3 };
    const result = findGridPath(start, start, { width: 5, height: 5 }, manhattanDistance);
    expect(result).toEqual([start]);
  });

  it('1.2 — adjacent horizontal returns path of length 2', () => {
    const start = { x: 1, y: 0 };
    const goal = { x: 2, y: 0 };
    const result = findGridPath(start, goal, { width: 5, height: 5 }, manhattanDistance);
    expect(result).toEqual([start, goal]);
  });

  it('1.3 — adjacent vertical returns path of length 2', () => {
    const start = { x: 0, y: 1 };
    const goal = { x: 0, y: 2 };
    const result = findGridPath(start, goal, { width: 5, height: 5 }, manhattanDistance);
    expect(result).toEqual([start, goal]);
  });
});

// ---------------------------------------------------------------------------
// 2. Optimal path length (open grid, no obstacles)
// ---------------------------------------------------------------------------

describe('optimal path length — open grid', () => {
  it('2.1 — horizontal line across a wide grid', () => {
    const start = { x: 0, y: 0 };
    const goal = { x: 9, y: 0 };
    const result = findGridPath(
      start,
      goal,
      { width: 10, height: 3 },
      manhattanDistance,
    )!;
    expect(result).not.toBeNull();
    expect(result.length).toBe(10);
    for (const c of result) {
      expect(c.y).toBe(0);
    }
  });

  it('2.2 — vertical line down a tall grid', () => {
    const start = { x: 0, y: 0 };
    const goal = { x: 0, y: 9 };
    const result = findGridPath(
      start,
      goal,
      { width: 3, height: 10 },
      manhattanDistance,
    )!;
    expect(result).not.toBeNull();
    expect(result.length).toBe(10);
    for (const c of result) {
      expect(c.x).toBe(0);
    }
  });

  it('2.3 — diagonal-ish path on 5x5 grid: (0,0) to (4,4)', () => {
    const result = findGridPath(
      { x: 0, y: 0 },
      { x: 4, y: 4 },
      { width: 5, height: 5 },
      manhattanDistance,
    )!;
    expect(result).not.toBeNull();
    expect(result.length).toBe(9);
  });

  it('2.4 — opposite corners of 10x10 grid', () => {
    const result = findGridPath(
      { x: 0, y: 0 },
      { x: 9, y: 9 },
      { width: 10, height: 10 },
      manhattanDistance,
    )!;
    expect(result).not.toBeNull();
    expect(result.length).toBe(19);
  });
});

// ---------------------------------------------------------------------------
// 3. Path correctness (structural validation)
// ---------------------------------------------------------------------------

describe('path correctness — structural validation', () => {
  it('3.1–3.4 — validates structure on an open 5x5 grid', () => {
    const start = { x: 0, y: 0 };
    const goal = { x: 4, y: 4 };
    const grid = { width: 5, height: 5 };
    const result = findGridPath(start, goal, grid, manhattanDistance)!;
    expect(result).not.toBeNull();
    validatePath(result, start, goal, grid);
  });

  it('3.5 — no coord in the path (except start) is impassable', () => {
    const start = { x: 0, y: 0 };
    const goal = { x: 4, y: 0 };
    const grid = { width: 5, height: 3 };
    const blocked = [{ x: 2, y: 0 }];
    const result = findGridPath(
      start,
      goal,
      grid,
      manhattanDistance,
      blockedSet(blocked),
    )!;
    expect(result).not.toBeNull();
    validatePath(result, start, goal, grid, blocked);
  });
});

// ---------------------------------------------------------------------------
// 4. Obstacles / passability
// ---------------------------------------------------------------------------

describe('obstacles / passability', () => {
  it('4.1 — wall blocks direct path, must go around', () => {
    // 5x5 grid, wall at x=2 for y=0..3, gap at y=4
    const start = { x: 0, y: 0 };
    const goal = { x: 4, y: 0 };
    const grid = { width: 5, height: 5 };
    const blocked = [
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 2, y: 3 },
    ];
    const result = findGridPath(
      start,
      goal,
      grid,
      manhattanDistance,
      blockedSet(blocked),
    )!;
    expect(result).not.toBeNull();
    expect(result.length).toBeGreaterThan(manhattanDistance(start, goal) + 1);
    validatePath(result, start, goal, grid, blocked);
  });

  it('4.2 — goal completely surrounded by impassable tiles', () => {
    const goal = { x: 2, y: 2 };
    const blocked = [
      { x: 1, y: 2 },
      { x: 3, y: 2 },
      { x: 2, y: 1 },
      { x: 2, y: 3 },
    ];
    const result = findGridPath(
      { x: 0, y: 0 },
      goal,
      { width: 5, height: 5 },
      manhattanDistance,
      blockedSet(blocked),
    );
    expect(result).toBeNull();
  });

  it('4.3 — start completely surrounded by impassable tiles', () => {
    const start = { x: 2, y: 2 };
    const blocked = [
      { x: 1, y: 2 },
      { x: 3, y: 2 },
      { x: 2, y: 1 },
      { x: 2, y: 3 },
    ];
    const result = findGridPath(
      start,
      { x: 4, y: 4 },
      { width: 5, height: 5 },
      manhattanDistance,
      blockedSet(blocked),
    );
    expect(result).toBeNull();
  });

  it('4.4 — narrow corridor (single-tile-wide passage)', () => {
    // 5x5 grid, walls block most of row y=2 except x=2
    const start = { x: 0, y: 0 };
    const goal = { x: 4, y: 4 };
    const grid = { width: 5, height: 5 };
    const blocked = [
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ];
    const result = findGridPath(
      start,
      goal,
      grid,
      manhattanDistance,
      blockedSet(blocked),
    )!;
    expect(result).not.toBeNull();
    validatePath(result, start, goal, grid, blocked);
    // must pass through the corridor at (2,2)
    expect(result.some((c) => c.x === 2 && c.y === 2)).toBe(true);
  });

  it('4.5 — multiple routes around obstacle, path length is optimal', () => {
    // 7x5 grid, wall at x=3 for y=1..3
    const start = { x: 0, y: 2 };
    const goal = { x: 6, y: 2 };
    const grid = { width: 7, height: 5 };
    const blocked = [
      { x: 3, y: 1 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
    ];
    // Can go around top (y=0) or bottom (y=4). Either route adds 4 extra steps.
    // Direct manhattan = 6, optimal with wall = 6 + 4 = 10 steps, path length = 11
    const result = findGridPath(
      start,
      goal,
      grid,
      manhattanDistance,
      blockedSet(blocked),
    )!;
    expect(result).not.toBeNull();
    expect(result.length).toBe(11);
    validatePath(result, start, goal, grid, blocked);
  });

  it('4.6 — small maze with unique shortest path', () => {
    // 5x5 maze:
    //   0 1 2 3 4   (x)
    // 0 S . # . .
    // 1 # . # . #
    // 2 . . . . #
    // 3 . # # . .
    // 4 . . . . G
    // (y)
    // S = start (0,0), G = goal (4,4)
    // '#' = blocked
    const start = { x: 0, y: 0 };
    const goal = { x: 4, y: 4 };
    const grid = { width: 5, height: 5 };
    const blocked = [
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 2, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 2 },
      { x: 1, y: 3 },
      { x: 2, y: 3 },
    ];
    const result = findGridPath(
      start,
      goal,
      grid,
      manhattanDistance,
      blockedSet(blocked),
    )!;
    expect(result).not.toBeNull();
    validatePath(result, start, goal, grid, blocked);

    // Shortest path (length 9), two valid options at the end:
    // (0,0) -> (1,0) -> (1,1) -> (1,2) -> (2,2) -> (3,2) -> (3,3) -> (3,4) -> (4,4)
    // (0,0) -> (1,0) -> (1,1) -> (1,2) -> (2,2) -> (3,2) -> (3,3) -> (4,3) -> (4,4)
    expect(result.length).toBe(9);
    const pathViaBottom = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
      { x: 3, y: 4 },
      { x: 4, y: 4 },
    ];
    const pathViaRight = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
      { x: 4, y: 3 },
      { x: 4, y: 4 },
    ];
    const matchesEither =
      JSON.stringify(result) === JSON.stringify(pathViaBottom) ||
      JSON.stringify(result) === JSON.stringify(pathViaRight);
    expect(matchesEither).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Passability of start and goal tiles
// ---------------------------------------------------------------------------

describe('passability of start and goal tiles', () => {
  it('5.1 — start marked impassable still finds path', () => {
    const start = { x: 0, y: 0 };
    const goal = { x: 2, y: 0 };
    const grid = { width: 5, height: 3 };
    const blocked = [start];
    const result = findGridPath(
      start,
      goal,
      grid,
      manhattanDistance,
      blockedSet(blocked),
    )!;
    expect(result).not.toBeNull();
    expect(result[0]).toEqual(start);
    expect(result[result.length - 1]).toEqual(goal);
  });

  it('5.2 — goal marked impassable returns null', () => {
    const start = { x: 0, y: 0 };
    const goal = { x: 2, y: 0 };
    const blocked = [goal];
    const result = findGridPath(
      start,
      goal,
      { width: 5, height: 3 },
      manhattanDistance,
      blockedSet(blocked),
    );
    expect(result).toBeNull();
  });

  it('5.3 — start = goal, start marked impassable returns [start]', () => {
    const start = { x: 1, y: 1 };
    const blocked = [start];
    const result = findGridPath(
      start,
      start,
      { width: 3, height: 3 },
      manhattanDistance,
      blockedSet(blocked),
    );
    expect(result).toEqual([start]);
  });
});

// ---------------------------------------------------------------------------
// 6. Unreachable goal
// ---------------------------------------------------------------------------

describe('unreachable goal', () => {
  it('6.1 — goal blocked off by wall spanning the grid', () => {
    // Wall at x=2 spanning full height of 5x5 grid
    const blocked = [
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 2, y: 4 },
    ];
    const result = findGridPath(
      { x: 0, y: 0 },
      { x: 4, y: 4 },
      { width: 5, height: 5 },
      manhattanDistance,
      blockedSet(blocked),
    );
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 7. Edge grids (small/narrow)
// ---------------------------------------------------------------------------

describe('edge grids — small and narrow', () => {
  it('7.1 — 1x1 grid, start = goal = (0,0)', () => {
    const c = { x: 0, y: 0 };
    const result = findGridPath(c, c, { width: 1, height: 1 }, manhattanDistance);
    expect(result).toEqual([c]);
  });

  it('7.2 — 1xN grid (single row)', () => {
    const start = { x: 0, y: 0 };
    const goal = { x: 4, y: 0 };
    const grid = { width: 5, height: 1 };
    const result = findGridPath(start, goal, grid, manhattanDistance)!;
    expect(result).not.toBeNull();
    expect(result.length).toBe(5);
    for (let i = 0; i < result.length; i++) {
      expect(result[i]).toEqual({ x: i, y: 0 });
    }
  });

  it('7.3 — Nx1 grid (single column)', () => {
    const start = { x: 0, y: 0 };
    const goal = { x: 0, y: 4 };
    const grid = { width: 1, height: 5 };
    const result = findGridPath(start, goal, grid, manhattanDistance)!;
    expect(result).not.toBeNull();
    expect(result.length).toBe(5);
    for (let i = 0; i < result.length; i++) {
      expect(result[i]).toEqual({ x: 0, y: i });
    }
  });

  it('7.4 — 2x2 grid, opposite corners', () => {
    const start = { x: 0, y: 0 };
    const goal = { x: 1, y: 1 };
    const result = findGridPath(start, goal, { width: 2, height: 2 }, manhattanDistance)!;
    expect(result).not.toBeNull();
    expect(result.length).toBe(3);
    validatePath(result, start, goal, { width: 2, height: 2 });
  });
});

// ---------------------------------------------------------------------------
// 8. Heuristic behavior
// ---------------------------------------------------------------------------

describe('heuristic behavior', () => {
  it('8.1 — zero heuristic (Dijkstra) still finds optimal path', () => {
    const start = { x: 0, y: 0 };
    const goal = { x: 4, y: 4 };
    const grid = { width: 5, height: 5 };
    const result = findGridPath(start, goal, grid, zeroHeuristic)!;
    expect(result).not.toBeNull();
    expect(result.length).toBe(9);
    validatePath(result, start, goal, grid);
  });

  it('8.2 — manhattan heuristic finds optimal path', () => {
    const start = { x: 0, y: 0 };
    const goal = { x: 4, y: 4 };
    const grid = { width: 5, height: 5 };
    const result = findGridPath(start, goal, grid, manhattanDistance)!;
    expect(result).not.toBeNull();
    expect(result.length).toBe(9);
    validatePath(result, start, goal, grid);
  });
});

// ---------------------------------------------------------------------------
// 9. isPassable callback
// ---------------------------------------------------------------------------

describe('isPassable callback', () => {
  it('9.1 — no isPassable provided, all tiles passable', () => {
    const result = findGridPath(
      { x: 0, y: 0 },
      { x: 4, y: 4 },
      { width: 5, height: 5 },
      manhattanDistance,
    )!;
    expect(result).not.toBeNull();
    expect(result.length).toBe(9);
  });

  it('9.2 — isPassable blocks specific tiles, path avoids them', () => {
    const blocked = [{ x: 1, y: 0 }];
    const result = findGridPath(
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { width: 3, height: 3 },
      manhattanDistance,
      blockedSet(blocked),
    )!;
    expect(result).not.toBeNull();
    expect(result.every((c) => !(c.x === 1 && c.y === 0))).toBe(true);
  });

  it('9.3 — isPassable receives CoordStr in "x,y" format', () => {
    const receivedArgs: string[] = [];
    const spy: (coord: CoordStr) => boolean = (coord) => {
      receivedArgs.push(coord);
      return true;
    };
    findGridPath(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { width: 3, height: 3 },
      manhattanDistance,
      spy,
    );
    expect(receivedArgs.length).toBeGreaterThan(0);
    for (const arg of receivedArgs) {
      expect(arg).toMatch(/^\d+,\d+$/);
    }
  });

  it('9.4 — isPassable is never called with the start coord', () => {
    const receivedArgs: string[] = [];
    const spy: (coord: CoordStr) => boolean = (coord) => {
      receivedArgs.push(coord);
      return true;
    };
    const start = { x: 2, y: 2 };
    findGridPath(start, { x: 4, y: 4 }, { width: 5, height: 5 }, manhattanDistance, spy);
    const startStr = toCoordStr(start);
    expect(receivedArgs).not.toContain(startStr);
  });
});

// ---------------------------------------------------------------------------
// 10. Larger grids
// ---------------------------------------------------------------------------

describe('larger grids', () => {
  it('10.1 — 50x50 open grid, opposite corners', () => {
    const start = { x: 0, y: 0 };
    const goal = { x: 49, y: 49 };
    const grid = { width: 50, height: 50 };
    const result = findGridPath(start, goal, grid, manhattanDistance)!;
    expect(result).not.toBeNull();
    expect(result.length).toBe(99);
    validatePath(result, start, goal, grid);
  });

  it('10.2 — 100x100 grid with scattered obstacles', () => {
    const start = { x: 0, y: 0 };
    const goal = { x: 99, y: 99 };
    const grid = { width: 100, height: 100 };

    // Create a deterministic set of obstacles that don't block the path entirely
    const blocked: Coord[] = [];
    for (let i = 0; i < 500; i++) {
      const x = (i * 7 + 13) % 100;
      const y = (i * 11 + 17) % 100;
      // don't block start or goal
      if ((x === 0 && y === 0) || (x === 99 && y === 99)) continue;
      blocked.push({ x, y });
    }

    const result = findGridPath(
      start,
      goal,
      grid,
      manhattanDistance,
      blockedSet(blocked),
    )!;
    expect(result).not.toBeNull();
    validatePath(result, start, goal, grid, blocked);
    // Optimal length should be at least manhattan + 1
    expect(result.length).toBeGreaterThanOrEqual(199);
  });
});
