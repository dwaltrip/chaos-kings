function tilesToMask(tiles: number[]): bigint {
  let mask = 0n;
  for (const t of tiles) {
    mask |= 1n << BigInt(t);
  }
  return mask;
}

function maskToTiles(mask: bigint): number[] {
  const tiles: number[] = [];
  let m = mask;
  let offset = 0;
  while (m > 0n) {
    if (m & 1n) {
      tiles.push(offset);
    }
    m >>= 1n;
    offset++;
  }
  return tiles;
}

function hasOverlap(a: bigint, b: bigint): boolean {
  return (a & b) !== 0n;
}

function popcount(mask: bigint): number {
  let count = 0;
  let m = mask;
  while (m > 0n) {
    m &= m - 1n;
    count++;
  }
  return count;
}

export { tilesToMask, maskToTiles, hasOverlap, popcount };
