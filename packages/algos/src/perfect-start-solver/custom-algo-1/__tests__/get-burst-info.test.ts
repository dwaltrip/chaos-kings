import {
  simulateOneBurst,
  getBurstInfosFromSpecs,
  type TimingState,
  type BurstSpec,
} from '../get-burst-info';

describe('simulateOneBurst', () => {
  const initial: TimingState = { tick: 1, generalTroops: 1 };

  it.each([
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

  // `moves > captures` means some moves are re-traversing owned land.
  // NOTE: These cases aren't possible as an initial burst in an actual game.
  // Spatially it doesn't tmake sense. But the timing math is "correct", which
  // is all we need here.
  it.each([
    ['2 captures + 1 overlap', 2, 3, 7],
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

  it('handles overlap specs correctly', () => {
    const specs: BurstSpec[] = [
      { captures: 5, moves: 5 },
      { captures: 3, moves: 4 },
    ];
    const infos = getBurstInfosFromSpecs(specs, 50);
    expect(infos).not.toBeNull();
    const b2 = infos![1];
    expect(b2.burstLen).toBe(4);
    expect(b2.startTick).toBe(17);
    expect(b2.endTick).toBe(20);
  });
});
