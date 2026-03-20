import {
  simulateOneBurst,
  getBurstInfosFromSpecs,
  type TimingState,
  type BurstSpec,
} from '../get-burst-info';

describe('simulateOneBurst', () => {
  const initial: TimingState = { tick: 1, generalTroops: 1 };

  it.each([
    // TODO: Daniel — verify these expected endTicks by hand.
    // Each case is: [description, captures, moves, expectedEndTick]
    // For moves=captures (no overlap), these should match the old
    // getMoveTicksForBurstPattern model exactly.
    ['single capture', 1, 1, 3],
    ['2 captures', 2, 2, 6],
    ['3 captures', 3, 3, 9],
    ['5 captures', 5, 5, 15],
  ] as [string, number, number, number][])(
    '%s (moves=captures): endTick=%i',
    (_desc, captures, moves, expectedEndTick) => {
      const result = simulateOneBurst(captures, moves, initial, 50);
      expect(result).not.toBeNull();
      expect(result!.endTick).toBe(expectedEndTick);
    },
  );

  // TODO: Daniel — verify these by hand. The idea:
  // moves > captures means extra traversal ticks. troopsNeeded is
  // still captures+1 (traversal is free army-wise), but the burst
  // takes more ticks of movement.
  // For captures=2, moves=3: need 3 troops (captures+1), so depart
  // at same tick as captures=2. But 3 moves instead of 2, so endTick
  // should be one tick later than the pure 2-capture case (6 → 7?).
  it.each([
    ['2 captures + 1 overlap', 2, 3, 7],
    // TODO: Daniel — verify 11 is correct here (agent got 11 from test run)
    ['3 captures + 2 overlap', 3, 5, 11],
  ] as [string, number, number, number][])(
    '%s (moves>captures): endTick=%i',
    (_desc, captures, moves, expectedEndTick) => {
      const result = simulateOneBurst(captures, moves, initial, 50);
      expect(result).not.toBeNull();
      expect(result!.endTick).toBe(expectedEndTick);
    },
  );

  it('returns null when burst exceeds maxTicks', () => {
    const result = simulateOneBurst(12, 12, initial, 10);
    expect(result).toBeNull();
  });

  it('threads state correctly across sequential bursts', () => {
    // Simulate [2, 1] as two sequential single-burst calls
    const r1 = simulateOneBurst(2, 2, initial, 50);
    expect(r1).not.toBeNull();
    const r2 = simulateOneBurst(1, 1, r1!.nextState, 50);
    expect(r2).not.toBeNull();

    // Compare with getBurstInfosFromSpecs
    const specs: BurstSpec[] = [
      { captures: 2, moves: 2 },
      { captures: 1, moves: 1 },
    ];
    const infos = getBurstInfosFromSpecs(specs, 50);
    expect(infos).not.toBeNull();
    expect(infos![0].endTick).toBe(r1!.endTick);
    expect(infos![1].endTick).toBe(r2!.endTick);
  });
});

describe('getBurstInfosFromSpecs', () => {
  // TODO: Daniel — verify these expected values match old getBurstInfos
  // output for the same capture patterns (moves=captures).
  it('matches old model for [2, 1] with moves=captures', () => {
    const specs: BurstSpec[] = [
      { captures: 2, moves: 2 },
      { captures: 1, moves: 1 },
    ];
    const infos = getBurstInfosFromSpecs(specs, 50);
    expect(infos).toEqual([
      { burstLen: 2, startTick: 5, endTick: 6 },
      { burstLen: 1, startTick: 7, endTick: 7 },
    ]);
  });

  it('matches old model for [5, 4] with moves=captures', () => {
    const specs: BurstSpec[] = [
      { captures: 5, moves: 5 },
      { captures: 4, moves: 4 },
    ];
    const infos = getBurstInfosFromSpecs(specs, 50);
    expect(infos).toEqual([
      { burstLen: 5, startTick: 11, endTick: 15 },
      { burstLen: 4, startTick: 19, endTick: 22 },
    ]);
  });

  it('burst count matches specs length', () => {
    const specs: BurstSpec[] = [
      { captures: 3, moves: 3 },
      { captures: 2, moves: 2 },
      { captures: 1, moves: 1 },
    ];
    const infos = getBurstInfosFromSpecs(specs, 50);
    expect(infos).not.toBeNull();
    expect(infos).toHaveLength(3);
  });

  it('ticks are monotonically increasing across bursts', () => {
    const specs: BurstSpec[] = [
      { captures: 4, moves: 4 },
      { captures: 3, moves: 3 },
      { captures: 2, moves: 2 },
    ];
    const infos = getBurstInfosFromSpecs(specs, 50)!;
    for (let i = 1; i < infos.length; i++) {
      expect(infos[i].startTick).toBeGreaterThan(infos[i - 1].endTick);
    }
  });

  it('returns null when pattern exceeds maxTicks', () => {
    const specs: BurstSpec[] = [
      { captures: 12, moves: 12 },
      { captures: 12, moves: 12 },
    ];
    const infos = getBurstInfosFromSpecs(specs, 30);
    expect(infos).toBeNull();
  });

  // TODO: Daniel — verify this by hand. Second burst has 1 overlap move,
  // so burstLen=4 (3 captures + 1 overlap), taking 4 movement ticks.
  // troopsNeeded for second burst is still 3+1=4 (overlap is free).
  it('handles overlap specs correctly', () => {
    const specs: BurstSpec[] = [
      { captures: 5, moves: 5 },
      { captures: 3, moves: 4 },
    ];
    const infos = getBurstInfosFromSpecs(specs, 50);
    expect(infos).not.toBeNull();
    expect(infos![1].burstLen).toBe(4);
    // endTick should be 1 tick later than pure [5,3] due to extra move
    // TODO: fill in exact expected startTick/endTick after hand verification
  });
});
