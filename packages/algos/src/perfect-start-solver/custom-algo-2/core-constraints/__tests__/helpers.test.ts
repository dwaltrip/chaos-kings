import { tickForGeneralArmy } from '../helpers';
import type { BurstInfo, AbstractGameState } from '../abstract-moves';
import {
  maxBurstBeforeMaxTick,
  lastMoveTick,
  waitForArmy,
  doBurst,
  NULL_BURST_INFO,
  shouldStartMaxBurst,
} from '../abstract-moves';
import { compactConsoleLog } from '@/utils/tests/compact-console-log';

type TestCase_MaxBurstBeforeMaxTick = {
  state: { tick: number; generalArmy: number };
  expected: BurstInfo;
};

const burstInfo = (size: number, firstMoveTick: number): BurstInfo => {
  return { size, firstMoveTick };
};

describe('maxBurstBeforeMaxTick', () => {
  compactConsoleLog();

  function runTestCases(cases: TestCase_MaxBurstBeforeMaxTick[]) {
    let i = 0;
    for (let { state, expected } of cases) {
      i++;
      test(`case ${i}`, () => {
        const res = maxBurstBeforeMaxTick(state);
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

describe.only('shouldStartMaxBurst', () => {
  test('definining examples', () => {
    expect(shouldStartMaxBurst(46, 4)).toBe(false);
    expect(shouldStartMaxBurst(47, 4)).toBe(true);
  });

  test('obviously should not', () => {
    expect(shouldStartMaxBurst(40, 2)).toBe(false);
    expect(shouldStartMaxBurst(30, 5)).toBe(false);
  });

  test('long bursts', () => {
    expect(shouldStartMaxBurst(29, 20)).toBe(false);
    expect(shouldStartMaxBurst(30, 20)).toBe(true);
    expect(shouldStartMaxBurst(31, 20)).toBe(true);

    expect(shouldStartMaxBurst(35, 14)).toBe(false);
    expect(shouldStartMaxBurst(36, 14)).toBe(false);
    expect(shouldStartMaxBurst(37, 15)).toBe(true);
  });

  // TODO: this should maybe be an error? this isn't an intended use case
  test('will not finish burst until after MAX_TICK', () => {
    expect(shouldStartMaxBurst(48, 4)).toBe(true);
  });
});
