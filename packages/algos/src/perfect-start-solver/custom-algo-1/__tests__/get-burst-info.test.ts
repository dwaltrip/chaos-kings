import { getMoveTicksForBurstPattern, getBurstInfos } from '../get-burst-info';

describe('getMoveTicksForBurstPattern', () => {
  it.each([
    ['single burst of 1', [1], [3]],
    ['single burst of 2', [2], [5, 6]],
    ['single burst of 3', [3], [7, 8, 9]],
    ['two bursts of 1', [1, 1], [3, 5]],
    ['burst 2 then 1', [2, 1], [5, 6, 7]],
    ['burst 1 then 2', [1, 2], [3, 7, 8]],
    ['burst 5 then 4', [5, 4], [11, 12, 13, 14, 15, 19, 20, 21, 22]],
  ] as [string, number[], number[]][])('%s', (_desc, bursts, expectedTicks) => {
    expect(getMoveTicksForBurstPattern(bursts)).toEqual(expectedTicks);
  });
});

describe('getBurstInfos', () => {
  it('returns correct startTick/endTick for [2, 1]', () => {
    const infos = getBurstInfos([2, 1]);
    expect(infos).toEqual([
      { burstLen: 2, startTick: 5, endTick: 6 },
      { burstLen: 1, startTick: 7, endTick: 7 },
    ]);
  });

  it('returns correct startTick/endTick for [5, 4]', () => {
    const infos = getBurstInfos([5, 4]);
    expect(infos).toEqual([
      { burstLen: 5, startTick: 11, endTick: 15 },
      { burstLen: 4, startTick: 19, endTick: 22 },
    ]);
  });

  it('burst count matches pattern length', () => {
    const pattern = [3, 2, 1];
    const infos = getBurstInfos(pattern);
    expect(infos).toHaveLength(3);
    infos.forEach((info, i) => {
      expect(info.burstLen).toBe(pattern[i]);
    });
  });

  it('ticks are monotonically increasing across bursts', () => {
    const infos = getBurstInfos([4, 3, 2]);
    for (let i = 1; i < infos.length; i++) {
      expect(infos[i].startTick).toBeGreaterThan(infos[i - 1].endTick);
    }
  });
});
