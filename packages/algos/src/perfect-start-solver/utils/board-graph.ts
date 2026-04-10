import { Direction } from '@core/types';

import { type FlatBoard, Board, TileType } from '@/core-next/flat-board';

const DIRECTIONS = [Direction.LEFT, Direction.UP, Direction.RIGHT, Direction.DOWN];

// ── Adjacency ──

/** All walkable (non-mountain) neighbors of a tile. */
function getWalkableNeighbors(board: FlatBoard, tile: number): number[] {
  const neighbors: number[] = [];
  for (const dir of DIRECTIONS) {
    const next = Board.neighbor(board, tile, dir);
    if (!Board.isValidIndex(board, next)) continue;
    if (board.types[next] === TileType.MOUNTAIN) continue;
    neighbors.push(next);
  }
  return neighbors;
}

/** Number of walkable neighbors. */
function getWalkableDegree(board: FlatBoard, tile: number): number {
  let count = 0;
  for (const dir of DIRECTIONS) {
    const next = Board.neighbor(board, tile, dir);
    if (!Board.isValidIndex(board, next)) continue;
    if (board.types[next] === TileType.MOUNTAIN) continue;
    count++;
  }
  return count;
}

/** All walkable (non-mountain) tile indices on the board. */
function getWalkableTiles(board: FlatBoard): number[] {
  const tiles: number[] = [];
  const total = board.width * board.height;
  for (let i = 0; i < total; i++) {
    if (board.types[i] !== TileType.MOUNTAIN) {
      tiles.push(i);
    }
  }
  return tiles;
}

// ── Corridors ──

interface CorridorSegment {
  /** Ordered chain of corridor tiles (each has exactly 2 walkable neighbors). */
  tiles: number[];
  /**
   * The non-corridor tiles at each end of the chain.
   * A corridor between two open areas has two distinct endpoints.
   * A corridor forming a loop back to the same junction has endpoints[0] === endpoints[1].
   */
  endpoints: [number, number];
}

interface CorridorResult {
  corridorTiles: Set<number>;
  segments: CorridorSegment[];
}

/** Find tiles with exactly 2 walkable neighbors and assemble them into chains. */
function findCorridors(board: FlatBoard): CorridorResult {
  const walkable = getWalkableTiles(board);
  const corridorTiles = new Set<number>();
  for (const tile of walkable) {
    if (getWalkableDegree(board, tile) === 2) {
      corridorTiles.add(tile);
    }
  }

  // Assemble corridor tiles into ordered chains by walking from each
  // unvisited corridor tile in both directions until hitting a non-corridor tile.
  const visited = new Set<number>();
  const segments: CorridorSegment[] = [];

  for (const start of corridorTiles) {
    if (visited.has(start)) continue;

    // Walk in one direction to find an end
    const chain: number[] = [start];
    visited.add(start);

    // Walk forward from start
    let current = start;
    let prev = -1;
    let forwardEndpoint = -1;
    while (true) {
      const neighbors = getWalkableNeighbors(board, current);
      const next = neighbors.find((n) => n !== prev);
      if (next === undefined) break; // dead end (degree-1 tile, shouldn't happen in corridor)
      if (!corridorTiles.has(next)) {
        forwardEndpoint = next;
        break;
      }
      if (visited.has(next)) {
        // Loop back to an already-visited corridor tile
        forwardEndpoint = next;
        break;
      }
      visited.add(next);
      chain.push(next);
      prev = current;
      current = next;
    }

    // Walk backward from start
    current = start;
    prev = chain.length > 1 ? chain[1] : forwardEndpoint;
    let backwardEndpoint = -1;
    while (true) {
      const neighbors = getWalkableNeighbors(board, current);
      const next = neighbors.find((n) => n !== prev);
      if (next === undefined) break;
      if (!corridorTiles.has(next)) {
        backwardEndpoint = next;
        break;
      }
      if (visited.has(next)) {
        backwardEndpoint = next;
        break;
      }
      visited.add(next);
      chain.unshift(next);
      prev = current;
      current = next;
    }

    segments.push({
      tiles: chain,
      endpoints: [backwardEndpoint, forwardEndpoint],
    });
  }

  return { corridorTiles, segments };
}

// ── Articulation points & bridges (Tarjan) ──

interface TarjanResult {
  articulationPoints: Set<number>;
  bridges: Array<[number, number]>;
}

/**
 * Find articulation points and bridges via Tarjan's algorithm.
 * Single DFS pass over all walkable tiles. Handles disconnected components.
 */
function tarjan(board: FlatBoard): TarjanResult {
  const walkable = getWalkableTiles(board);
  const articulationPoints = new Set<number>();
  const bridges: Array<[number, number]> = [];

  const disc = new Map<number, number>();
  const low = new Map<number, number>();
  let timer = 0;

  function dfs(u: number, parent: number): void {
    disc.set(u, timer);
    low.set(u, timer);
    timer++;

    let childCount = 0;
    let isArticulation = false;

    for (const v of getWalkableNeighbors(board, u)) {
      if (!disc.has(v)) {
        childCount++;
        dfs(v, u);

        const lowV = low.get(v)!;
        const lowU = low.get(u)!;
        if (lowV < lowU) low.set(u, lowV);

        // u is an articulation point if:
        // 1. u is root of DFS tree and has 2+ children
        // 2. u is not root and low[v] >= disc[u]
        if (parent === -1 && childCount > 1) isArticulation = true;
        if (parent !== -1 && lowV >= disc.get(u)!) isArticulation = true;

        // (u, v) is a bridge if low[v] > disc[u]
        if (lowV > disc.get(u)!) {
          bridges.push([u, v]);
        }
      } else if (v !== parent) {
        const lowU = low.get(u)!;
        const discV = disc.get(v)!;
        if (discV < lowU) low.set(u, discV);
      }
    }

    if (isArticulation) articulationPoints.add(u);
  }

  // Handle disconnected components
  for (const tile of walkable) {
    if (!disc.has(tile)) {
      dfs(tile, -1);
    }
  }

  return { articulationPoints, bridges };
}

/**
 * Scoped variant of Tarjan: runs on the subgraph induced by `tiles`.
 * Tiles outside the set are treated as walls. Useful for analyzing
 * starting regions or other subregions of interest, since articulation
 * points in the full board are not the same as articulation points in
 * an induced subgraph.
 */
function tarjanInSet(board: FlatBoard, tiles: Set<number>): TarjanResult {
  const articulationPoints = new Set<number>();
  const bridges: Array<[number, number]> = [];

  const disc = new Map<number, number>();
  const low = new Map<number, number>();
  let timer = 0;

  function dfs(u: number, parent: number): void {
    disc.set(u, timer);
    low.set(u, timer);
    timer++;

    let childCount = 0;
    let isArticulation = false;

    for (const v of getWalkableNeighbors(board, u)) {
      if (!tiles.has(v)) continue;
      if (!disc.has(v)) {
        childCount++;
        dfs(v, u);

        const lowV = low.get(v)!;
        const lowU = low.get(u)!;
        if (lowV < lowU) low.set(u, lowV);

        if (parent === -1 && childCount > 1) isArticulation = true;
        if (parent !== -1 && lowV >= disc.get(u)!) isArticulation = true;

        if (lowV > disc.get(u)!) {
          bridges.push([u, v]);
        }
      } else if (v !== parent) {
        const lowU = low.get(u)!;
        const discV = disc.get(v)!;
        if (discV < lowU) low.set(u, discV);
      }
    }

    if (isArticulation) articulationPoints.add(u);
  }

  for (const tile of tiles) {
    if (!disc.has(tile)) {
      dfs(tile, -1);
    }
  }

  return { articulationPoints, bridges };
}

// ── Region decomposition ──

interface Region {
  tiles: Set<number>;
  /** Which of the removed tiles border this region. */
  adjacentCutVertices: Set<number>;
}

interface RegionDecomposition {
  regions: Region[];
  cutVertices: Set<number>;
}

/**
 * Remove the given cut vertices from the walkable graph, then flood-fill
 * to find the resulting connected components.
 */
function decomposeRegions(
  board: FlatBoard,
  cutVertices: Set<number>,
): RegionDecomposition {
  const walkable = getWalkableTiles(board);
  const visited = new Set<number>();
  const regions: Region[] = [];

  for (const start of walkable) {
    if (cutVertices.has(start)) continue;
    if (visited.has(start)) continue;

    // Flood-fill from start, not crossing cut vertices
    const regionTiles = new Set<number>();
    const adjacentCutVertices = new Set<number>();
    const queue = [start];
    visited.add(start);

    while (queue.length > 0) {
      const current = queue.pop()!;
      regionTiles.add(current);

      for (const next of getWalkableNeighbors(board, current)) {
        if (cutVertices.has(next)) {
          adjacentCutVertices.add(next);
          continue;
        }
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }

    regions.push({ tiles: regionTiles, adjacentCutVertices });
  }

  return { regions, cutVertices };
}

export type {
  CorridorResult,
  CorridorSegment,
  Region,
  RegionDecomposition,
  TarjanResult,
};
export {
  decomposeRegions,
  findCorridors,
  getWalkableDegree,
  getWalkableNeighbors,
  getWalkableTiles,
  tarjan,
  tarjanInSet,
};
