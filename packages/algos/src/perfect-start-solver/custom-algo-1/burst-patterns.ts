import { invariant } from '@utils/assertions/invariant';
// import { type Move, Direction } from "../types-next";

type BurstLengthPattern = number[];

// maxLen is the maximum length of a single burst
function genBurstLengthPatterns(
  totalMoves: number,
  maxLen: number,
): BurstLengthPattern[] {
  const patterns: BurstLengthPattern[] = [];

  function genPattern(
    pattern: BurstLengthPattern,
    remainingMoves: number,
    currMax: number,
    acc: BurstLengthPattern[],
  ) {
    invariant(currMax <= remainingMoves, `invalid: ${currMax}, ${remainingMoves}`);
    // no more moves, pattern is filled out
    if (remainingMoves === 0) {
      acc.push(pattern);
      return;
    }

    for (let burst = currMax; burst > 0; burst--) {
      // const newPattern = pattern.concat(burst);
      const newRemaining = Math.max(0, remainingMoves - burst);
      genPattern(
        pattern.concat(burst),
        newRemaining,
        Math.min(newRemaining, currMax),
        acc,
      );
    }
  }

  const initialRemaining = Math.max(0, totalMoves - maxLen);
  const initialMax = Math.min(initialRemaining, maxLen);
  genPattern([maxLen], initialRemaining, initialMax, patterns);

  return patterns;
}

export { genBurstLengthPatterns };
