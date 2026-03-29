import { tickForGeneralArmy } from '../helpers';
import type { BurstInfo, AlgoConfig, AbstractGameState } from '../abstract-moves';
import {
  DEFAULT_CONFIG,
  maxBurstBeforeMaxTick,
  lastMoveTick,
  waitForArmy,
  doBurst,
  NULL_BURST_INFO,
  shouldStartMaxBurst,
  countProductionTicks,
} from '../abstract-moves';
import { compactConsoleLog } from '@/utils/tests/compact-console-log';

const cfg = DEFAULT_CONFIG;

type TestCase_MaxBurstBeforeMaxTick = {
  state: { tick: number; generalArmy: number };
  expected: BurstInfo;
};

const burstInfo = (size: number, firstMoveTick: number): BurstInfo => {
  return { size, firstMoveTick };
};

describe('maxBurstBeforeMaxTick', () => {
  function runTestCases(cases: TestCase_MaxBurstBeforeMaxTick[]) {
    let i = 0;
    for (let { state, expected } of cases) {
      i++;
      test(`case ${i}`, () => {
        const res = maxBurstBeforeMaxTick(state, cfg);
        expect(res).toEqual(expected);
      });
    }
  }

  describe('with generalArmy=1', () => {
    const TEST_CASES = [
      // { state: { tick: 40, generalArmy: 1 }, expected: burstInfo(3, 47) },
      { state: { tick: 38, generalArmy: 1 }, expected: burstInfo(4, 47) },
      // { state: { tick: 22, generalArmy: 1 }, expected: burstInfo(9, 41) },
      // { state: { tick: 21, generalArmy: 1 }, expected: burstInfo(10, 41) },
      // { state: { tick: 20, generalArmy: 1 }, expected: burstInfo(10, 41) },
      // { state: { tick: 19, generalArmy: 1 }, expected: burstInfo(10, 39) },
    ];
    runTestCases(TEST_CASES);
  });

  describe('with generalArmy=2', () => {
    const TEST_CASES = [
      { state: { tick: 40, generalArmy: 2 }, expected: burstInfo(4, 47) },
      { state: { tick: 38, generalArmy: 2 }, expected: burstInfo(4, 45) },
      { state: { tick: 21, generalArmy: 2 }, expected: burstInfo(10, 39) },
      { state: { tick: 20, generalArmy: 2 }, expected: burstInfo(10, 39) },
      { state: { tick: 19, generalArmy: 2 }, expected: burstInfo(11, 39) },
    ];
    // runTestCases(TEST_CASES);
  });

  describe('existing general army with a few ticks remaining', () => {
    const TEST_CASES = [
      { state: { tick: 47, generalArmy: 3 }, expected: burstInfo(2, 48) },
      { state: { tick: 47, generalArmy: 4 }, expected: burstInfo(3, 48) },
      { state: { tick: 47, generalArmy: 5 }, expected: burstInfo(4, 48) },
      { state: { tick: 47, generalArmy: 10 }, expected: burstInfo(9, 48) },
    ];
    // runTestCases(TEST_CASES);
  });

  describe('existing general army with more ticks remaining', () => {
    const TEST_CASES = [
      { state: { tick: 40, generalArmy: 6 }, expected: burstInfo(6, 43) },
      { state: { tick: 41, generalArmy: 8 }, expected: burstInfo(8, 43) },
      { state: { tick: 41, generalArmy: 12 }, expected: burstInfo(11, 42) },
    ];
    // runTestCases(TEST_CASES);
  });

  describe('handles 0 moves remaining', () => {
    const TEST_CASES = [
      { state: { tick: 48, generalArmy: 1 }, expected: NULL_BURST_INFO },
      { state: { tick: 49, generalArmy: 1 }, expected: NULL_BURST_INFO },
      { state: { tick: 50, generalArmy: 1 }, expected: NULL_BURST_INFO },
      // should NOT be NULL_BURST_INFO
      { state: { tick: 47, generalArmy: 1 }, expected: burstInfo(1, 49) },
    ];
    // runTestCases(TEST_CASES);
  });
});

describe('tickForGeneralArmy', () => {
  test('starting army = 1', () => {
    expect(tickForGeneralArmy(0, 1, 2)).toEqual(2);
    expect(tickForGeneralArmy(1, 1, 2)).toEqual(2);
    expect(tickForGeneralArmy(1, 1, 6)).toEqual(10);
    expect(tickForGeneralArmy(10, 1, 6)).toEqual(20);
  });

  test('more cases', () => {
    expect(tickForGeneralArmy(15, 5, 19)).toEqual(42);
    expect(tickForGeneralArmy(36, 3, 9)).toEqual(48);
    expect(tickForGeneralArmy(9, 11, 21)).toEqual(28);
  });
});

function makeState(tick: number, generalArmy: number): AbstractGameState {
  return { tick, generalArmy };
}

describe('waitForArmy', () => {
  test('some basic tests', () => {
    expect(waitForArmy(makeState(0, 1), 2)).toEqual(makeState(2, 2));
    expect(waitForArmy(makeState(0, 5), 15)).toEqual(makeState(20, 15));
    expect(waitForArmy(makeState(15, 3), 9)).toEqual(makeState(26, 9));
    expect(waitForArmy(makeState(23, 8), 20)).toEqual(makeState(46, 20));
  });
});

describe('doBurst', () => {
  test('some basic tests', () => {
    expect(doBurst(makeState(4, 3))).toEqual(makeState(6, 2));
    expect(doBurst(makeState(3, 4))).toEqual(makeState(6, 3));
    expect(doBurst(makeState(1, 10))).toEqual(makeState(10, 6));
    expect(doBurst(makeState(33, 14))).toEqual(makeState(46, 8));
  });
});

type TestCase_ShouldStartMaxBurst = {
  firstMoveTick: number;
  army: number;
  expected: boolean;
};

describe('shouldStartMaxBurst', () => {
  function runTestCases(cases: TestCase_ShouldStartMaxBurst[]) {
    let i = 0;
    for (let { firstMoveTick, army, expected } of cases) {
      i++;
      test(`case ${i} - (${firstMoveTick}, ${army}) → ${expected}`, () => {
        expect(shouldStartMaxBurst(firstMoveTick, army, cfg)).toBe(expected);
      });
    }
  }

  describe('defining examples', () => {
    runTestCases([
      { firstMoveTick: 46, army: 4, expected: false },
      { firstMoveTick: 47, army: 4, expected: true },
    ]);
  });

  describe('obviously should not', () => {
    runTestCases([
      { firstMoveTick: 40, army: 2, expected: false },
      { firstMoveTick: 30, army: 5, expected: false },
    ]);
  });

  describe('long bursts', () => {
    runTestCases([
      { firstMoveTick: 29, army: 20, expected: false },
      { firstMoveTick: 30, army: 20, expected: false },
      { firstMoveTick: 31, army: 20, expected: true },
      { firstMoveTick: 35, army: 14, expected: false },
      { firstMoveTick: 36, army: 14, expected: false },
      { firstMoveTick: 37, army: 15, expected: true },
    ]);
  });

  describe('thorough tests with even firstMoveTick', () => {
    runTestCases([
      { firstMoveTick: 42, army: 10, expected: true },
      { firstMoveTick: 42, army: 9, expected: false },
      { firstMoveTick: 42, army: 8, expected: false },
      { firstMoveTick: 42, army: 7, expected: false },
    ]);
  });

  describe('thorough tests with odd firstMoveTick', () => {
    runTestCases([
      { firstMoveTick: 45, army: 4, expected: false },
      { firstMoveTick: 45, army: 5, expected: true },
      { firstMoveTick: 45, army: 6, expected: true },
      { firstMoveTick: 45, army: 7, expected: true },
    ]);
  });

  // TODO: Maybe this should be an error? It wasn't the intended use case.
  describe('will not finish burst until after MAX_TICK', () => {
    runTestCases([
      { firstMoveTick: 42, army: 11, expected: true },
      { firstMoveTick: 45, army: 8, expected: true },
      { firstMoveTick: 48, army: 4, expected: true },
    ]);
  });
});

describe('countProductionTicks', () => {
  test('start = 1', () => {
    expect(countProductionTicks(1, 2)).toEqual(1);
    expect(countProductionTicks(1, 3)).toEqual(1);
    expect(countProductionTicks(1, 4)).toEqual(2);
  });

  test('start = 2', () => {
    expect(countProductionTicks(2, 2)).toEqual(1);
    expect(countProductionTicks(2, 3)).toEqual(1);
    expect(countProductionTicks(2, 4)).toEqual(2);
  });

  test('more tests', () => {
    expect(countProductionTicks(9, 15)).toEqual(3);
    expect(countProductionTicks(9, 16)).toEqual(4);
    expect(countProductionTicks(9, 17)).toEqual(4);
    expect(countProductionTicks(9, 18)).toEqual(5);

    expect(countProductionTicks(10, 15)).toEqual(3);
    expect(countProductionTicks(10, 16)).toEqual(4);
    expect(countProductionTicks(10, 17)).toEqual(4);
    expect(countProductionTicks(10, 18)).toEqual(5);

    expect(countProductionTicks(11, 15)).toEqual(2);
    expect(countProductionTicks(11, 16)).toEqual(3);
    expect(countProductionTicks(11, 17)).toEqual(3);
    expect(countProductionTicks(11, 18)).toEqual(4);

    expect(countProductionTicks(12, 15)).toEqual(2);
    expect(countProductionTicks(12, 16)).toEqual(3);
    expect(countProductionTicks(12, 17)).toEqual(3);
    expect(countProductionTicks(12, 18)).toEqual(4);
  });
});
