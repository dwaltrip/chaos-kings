import {
  decomposeRegions,
  findCorridors,
  getWalkableDegree,
  getWalkableNeighbors,
  getWalkableTiles,
  tarjan,
} from '../board-graph';

import { makeTestBoard } from '../../custom-algo-1/__tests__/helpers';

describe('getWalkableNeighbors', () => {
  it('center of open board has 4 neighbors', () => {
    const { board, generalPos } = makeTestBoard('open-7x7');
    const neighbors = getWalkableNeighbors(board, generalPos);
    expect(neighbors).toHaveLength(4);
  });

  it('corner tile has 2 neighbors', () => {
    const { board, generalPos } = makeTestBoard('corner-7x7');
    // General is at (0,0) = index 0, the top-left corner
    const neighbors = getWalkableNeighbors(board, generalPos);
    expect(neighbors).toHaveLength(2);
  });

  it('tile adjacent to mountains has fewer neighbors', () => {
    // corridor-7x7 row 3: MMMM.MM — the gap tile at (4,3)=25 has mountains
    // on left and right, so only up/down neighbors
    const { board } = makeTestBoard('corridor-7x7');
    const gapTile = 3 * 7 + 4; // (4,3) = 25
    const neighbors = getWalkableNeighbors(board, gapTile);
    expect(neighbors).toHaveLength(2);
  });

  it('does not include mountain tiles', () => {
    const { board } = makeTestBoard('maze-7x7');
    const walkable = getWalkableTiles(board);
    for (const tile of walkable) {
      const neighbors = getWalkableNeighbors(board, tile);
      for (const n of neighbors) {
        expect(walkable).toContain(n);
      }
    }
  });
});

describe('getWalkableDegree', () => {
  it('agrees with getWalkableNeighbors length', () => {
    const { board } = makeTestBoard('maze-7x7');
    const walkable = getWalkableTiles(board);
    for (const tile of walkable) {
      expect(getWalkableDegree(board, tile)).toBe(
        getWalkableNeighbors(board, tile).length,
      );
    }
  });

  it('edge tile on open board has degree 3', () => {
    const { board } = makeTestBoard('open-7x7');
    // Top edge, middle tile: (3,0) = index 3
    expect(getWalkableDegree(board, 3)).toBe(3);
  });

  it('center of open board has degree 4', () => {
    const { board, generalPos } = makeTestBoard('open-7x7');
    expect(getWalkableDegree(board, generalPos)).toBe(4);
  });
});

describe('getWalkableTiles', () => {
  it('open-7x7 has 49 walkable tiles', () => {
    const { board } = makeTestBoard('open-7x7');
    expect(getWalkableTiles(board)).toHaveLength(49);
  });

  it('corridor-11x11 has 121 - 10 = 111 walkable tiles', () => {
    // Row 5: MMMMM.MMMMM — 10 mountains
    const { board } = makeTestBoard('corridor-11x11');
    expect(getWalkableTiles(board)).toHaveLength(111);
  });

  it('does not include mountain indices', () => {
    const { board } = makeTestBoard('maze-7x7');
    const walkable = getWalkableTiles(board);
    const total = board.width * board.height;
    for (let i = 0; i < total; i++) {
      if (walkable.includes(i)) {
        expect(board.types[i]).not.toBe(1); // TileType.MOUNTAIN = 1
      }
    }
  });

  it('returns tiles in ascending index order', () => {
    const { board } = makeTestBoard('narrow-corridors-11x11');
    const walkable = getWalkableTiles(board);
    for (let i = 1; i < walkable.length; i++) {
      expect(walkable[i]).toBeGreaterThan(walkable[i - 1]);
    }
  });
});

describe('findCorridors', () => {
  it('open board corner tiles are degree 2 so they become corridor tiles', () => {
    // The 4 corner tiles of an open 7x7 board each have exactly 2 neighbors,
    // so findCorridors identifies them as corridor tiles.
    const { board } = makeTestBoard('open-7x7');
    const result = findCorridors(board);
    expect(result.corridorTiles.size).toBe(4);
    // Corners: (0,0)=0, (6,0)=6, (0,6)=42, (6,6)=48
    expect(result.corridorTiles.has(0)).toBe(true);
    expect(result.corridorTiles.has(6)).toBe(true);
    expect(result.corridorTiles.has(42)).toBe(true);
    expect(result.corridorTiles.has(48)).toBe(true);
  });

  it('corridor-11x11 has corridor tiles forming a segment through the gap', () => {
    // corridor-11x11: row 5 is MMMMM.MMMMM, gap at (5,5)=60.
    // The tiles directly above (5,4)=49 and below (5,6)=71 the gap
    // are squeezed between mountains, giving them degree 2 (corridor tiles).
    // The gap tile (5,5)=60 itself also has degree 2.
    const { board } = makeTestBoard('corridor-11x11');
    const result = findCorridors(board);
    expect(result.corridorTiles.size).toBeGreaterThan(0);
    expect(result.segments.length).toBeGreaterThan(0);
    // TODO: fill in expected corridor tiles and segment details
  });

  it('narrow-corridors-11x11 has multiple corridor segments', () => {
    // narrow-corridors-11x11 has three mountain walls with single-tile gaps
    // at rows 3, 6, and 9, creating multiple corridor segments.
    const { board } = makeTestBoard('narrow-corridors-11x11');
    const result = findCorridors(board);
    expect(result.segments.length).toBeGreaterThan(1);
    // TODO: fill in expected segment count and tiles
  });

  it('every corridor tile has exactly degree 2', () => {
    const { board } = makeTestBoard('maze-7x7');
    const result = findCorridors(board);
    for (const tile of result.corridorTiles) {
      expect(getWalkableDegree(board, tile)).toBe(2);
    }
  });

  it('segment endpoints are not corridor tiles', () => {
    const { board } = makeTestBoard('corridor-7x7');
    const result = findCorridors(board);
    for (const seg of result.segments) {
      for (const ep of seg.endpoints) {
        if (ep >= 0) {
          expect(result.corridorTiles.has(ep)).toBe(false);
        }
      }
    }
  });
});

describe('tarjan', () => {
  it('open board has no articulation points or bridges', () => {
    const { board } = makeTestBoard('open-7x7');
    const result = tarjan(board);
    expect(result.articulationPoints.size).toBe(0);
    expect(result.bridges).toHaveLength(0);
  });

  it('corridor-11x11 gap tile is an articulation point', () => {
    // corridor-11x11: MMMMM.MMMMM at row 5, gap at (5,5)=60.
    // Removing tile 60 disconnects the top half from the bottom half.
    const { board } = makeTestBoard('corridor-11x11');
    const result = tarjan(board);
    expect(result.articulationPoints.has(60)).toBe(true);
  });

  it('finds articulation points on corridor-7x7', () => {
    // corridor-7x7: row 3 is MMMM.MM, gap at (4,3)=25.
    // Tile 25 is the only passage between top and bottom halves.
    const { board } = makeTestBoard('corridor-7x7');
    const result = tarjan(board);
    expect(result.articulationPoints.has(25)).toBe(true);
    // TODO: fill in expected full set of articulation points
  });

  it('finds articulation points on narrow-corridors-11x11', () => {
    // narrow-corridors-11x11 has gaps at (5,3)=38, (3,6)=69/(4,6)=70,
    // and (5,9)=104. These single-tile gaps should produce
    // articulation points that separate the horizontal bands.
    const { board } = makeTestBoard('narrow-corridors-11x11');
    const result = tarjan(board);
    expect(result.articulationPoints.size).toBeGreaterThan(0);
    // TODO: fill in expected articulation points
  });

  it('finds bridges on corridor-11x11', () => {
    // The gap at (5,5)=60 with its neighbors above/below should form bridges,
    // since they are the only connection between top and bottom.
    const { board } = makeTestBoard('corridor-11x11');
    const result = tarjan(board);
    expect(result.bridges.length).toBeGreaterThan(0);
    // TODO: fill in expected bridges
  });

  it('corner-7x7 has no articulation points', () => {
    const { board } = makeTestBoard('corner-7x7');
    const result = tarjan(board);
    // Fully open board — no tile removal disconnects the graph
    expect(result.articulationPoints.size).toBe(0);
    expect(result.bridges).toHaveLength(0);
  });
});

describe('decomposeRegions', () => {
  it('no cut vertices yields a single region with all walkable tiles', () => {
    const { board } = makeTestBoard('open-7x7');
    const cutVertices = new Set<number>();
    const result = decomposeRegions(board, cutVertices);
    expect(result.regions).toHaveLength(1);
    expect(result.regions[0].tiles.size).toBe(49);
    expect(result.regions[0].adjacentCutVertices.size).toBe(0);
  });

  it('corridor-11x11 decomposes into regions around the chokepoint', () => {
    // Removing the articulation points from corridor-11x11 should split
    // the board into at least 2 regions (top half and bottom half).
    const { board } = makeTestBoard('corridor-11x11');
    const { articulationPoints } = tarjan(board);
    const result = decomposeRegions(board, articulationPoints);
    expect(result.regions.length).toBeGreaterThanOrEqual(2);
    // Each region should reference at least one cut vertex as adjacent
    for (const region of result.regions) {
      expect(region.adjacentCutVertices.size).toBeGreaterThan(0);
    }
  });

  it('all walkable non-cut tiles appear in exactly one region', () => {
    const { board } = makeTestBoard('narrow-corridors-11x11');
    const { articulationPoints } = tarjan(board);
    const result = decomposeRegions(board, articulationPoints);

    const allWalkable = getWalkableTiles(board);
    const nonCut = allWalkable.filter((t) => !articulationPoints.has(t));

    // Collect all tiles from all regions
    const seen = new Set<number>();
    for (const region of result.regions) {
      for (const tile of region.tiles) {
        expect(seen.has(tile)).toBe(false); // no duplicates
        seen.add(tile);
      }
    }
    // Every non-cut walkable tile should be in some region
    for (const tile of nonCut) {
      expect(seen.has(tile)).toBe(true);
    }
  });

  it('region adjacentCutVertices are actual cut vertices', () => {
    const { board } = makeTestBoard('corridor-7x7');
    const { articulationPoints } = tarjan(board);
    const result = decomposeRegions(board, articulationPoints);

    for (const region of result.regions) {
      for (const cv of region.adjacentCutVertices) {
        expect(articulationPoints.has(cv)).toBe(true);
      }
    }
  });
});
