import { PriorityQueue } from '@/lib/priority-queue/priority-queue';
import { number } from 'zod';

type Coord = { x: number; y: number };

interface Node {
  coord: Coord;
  key: CoordStr;
  g: number;
  h: number;
  f: number;
  parent: Node | null;
}

type CoordStr = string; // for use in closed list

type HeuristicFn = (a: Coord, b: Coord) => number;

// ----------------------------------------------------------------------------

// paths on a 2-d grid
function findGridPath(
  startCoord: Coord,
  goalCoord: Coord,
  gridSize: { width: number; height: number },
  heuristic: HeuristicFn,
  isPassable?: (coord: CoordStr) => boolean,
): Coord[] | null {
  const grid = new Grid(gridSize.width, gridSize.height);
  const nodesByKey = new Map<CoordStr, Node>();

  function getOrCreateNode(node: Node): Node {
    const existing = nodesByKey.get(node.key);
    if (existing) return existing;
    nodesByKey.set(node.key, node);
    return node;
  }

  const start = getOrCreateNode({
    coord: startCoord,
    key: c2str(startCoord),
    g: 0,
    h: heuristic(startCoord, goalCoord),
    f: 0,
    parent: null,
  });
  start.f = start.g + start.h;

  const openList = new PriorityQueue<Node>();
  openList.insertOrDecrease(start, start.f);
  const closedList: Set<CoordStr> = new Set();

  while (!openList.isEmpty()) {
    const current = openList.pop();
    if (!current) {
      break;
    }

    if (areCoordsEqual(current.item.coord, goalCoord)) {
      return reconstructPath(current.item);
    }

    closedList.add(current.item.key);

    const neighbors = grid.getNeighbors(current.item.coord);
    for (const neighbor of neighbors) {
      if (closedList.has(neighbor.key)) {
        continue; // skip already evaluated neighbors
      }
      if (isPassable && !isPassable(neighbor.key)) {
        continue; // tile isn't passable
      }

      const tentativeG = current.item.g + 1;
      const existing = nodesByKey.get(neighbor.key);
      if (existing && tentativeG >= existing.g) {
        continue;
      }

      const h = existing?.h ?? heuristic(neighbor.coord, goalCoord);
      const neighborNode = existing ?? {
        coord: neighbor.coord,
        key: neighbor.key,
        g: tentativeG,
        h,
        f: tentativeG + h,
        parent: current.item,
      };
      neighborNode.g = tentativeG;
      neighborNode.f = tentativeG + h;
      neighborNode.parent = current.item;

      if (!existing) {
        nodesByKey.set(neighbor.key, neighborNode);
      }
      openList.insertOrDecrease(neighborNode, neighborNode.f);
    }
  }

  return null;
}

// ----------------------------------------------------------------------------

function reconstructPath(node: Node): Coord[] {
  const path: Coord[] = [];
  let currentNode: Node | null = node;
  while (currentNode) {
    path.unshift(currentNode.coord);
    currentNode = currentNode.parent;
  }
  return path;
}

function areCoordsEqual(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y;
}

function c2str(coord: Coord): CoordStr {
  return `${coord.x},${coord.y}`;
}

// ----------------------------------------------------------------------------

interface GridTile {
  coord: Coord;
  key: CoordStr;
}

class Grid {
  private width: number;
  private height: number;
  private tiles: GridTile[][];
  private tilesByKey: Map<CoordStr, GridTile>;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.tiles = [];
    this.tilesByKey = new Map();

    for (let y = 0; y < height; y++) {
      this.tiles[y] = [];
      for (let x = 0; x < width; x++) {
        const coord = { x, y };
        const key = c2str(coord);
        const tile: GridTile = { coord, key };
        this.tiles[y][x] = tile;
        this.tilesByKey.set(key, tile);
      }
    }
  }

  getNeighbors(coord: Coord): GridTile[] {
    const { x, y } = coord;
    const l = x > 0               ? this.tiles[y][x - 1] : null; // prettier-ignore
    const t = y > 0               ? this.tiles[y - 1][x] : null; // prettier-ignore
    const r = x < this.width - 1  ? this.tiles[y][x + 1] : null; // prettier-ignore
    const b = y < this.height - 1 ? this.tiles[y + 1][x] : null; // prettier-ignore

    const neighbors: GridTile[] = [];
    if (l) {
      neighbors.push(l);
    }
    if (t) {
      neighbors.push(t);
    }
    if (r) {
      neighbors.push(r);
    }
    if (b) {
      neighbors.push(b);
    }
    return neighbors;
  }
}

// ----------------------------------------------------------------------------

export { findGridPath };
