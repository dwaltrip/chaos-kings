import { tickForGeneralArmy } from '../helpers';
import type { BurstInfo, AbstractGameState } from '../abstract-moves';
import { maxBurstBeforeMaxTick, waitForArmy, doBurst } from '../abstract-moves';

type TestCase_MaxBurstBeforeMaxTick = {
  state: { tick: number; generalArmy: number };
  expected: BurstInfo;
};

const burstInfo = (size: number, startTick: number, endTick: number): BurstInfo => {
  return { size, startTick, endTick };
};

describe('maxBurstBeforeMaxTick', () => {
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
      { state: { tick: 40, generalArmy: 1 }, expected: burstInfo(3, 46, 49) },
      { state: { tick: 38, generalArmy: 1 }, expected: burstInfo(4, 46, 50) },
      { state: { tick: 22, generalArmy: 1 }, expected: burstInfo(9, 40, 49) },
      { state: { tick: 21, generalArmy: 1 }, expected: burstInfo(10, 40, 50) },
      { state: { tick: 20, generalArmy: 1 }, expected: burstInfo(10, 40, 50) },
      { state: { tick: 19, generalArmy: 1 }, expected: burstInfo(10, 38, 48) },
    ];
    runTestCases(TEST_CASES);
  });

  describe('with generalArmy=2', () => {
    const TEST_CASES = [
      { state: { tick: 40, generalArmy: 2 }, expected: burstInfo(4, 46, 50) },
      { state: { tick: 38, generalArmy: 2 }, expected: burstInfo(4, 44, 48) },
      { state: { tick: 21, generalArmy: 2 }, expected: burstInfo(10, 38, 48) },
      { state: { tick: 20, generalArmy: 2 }, expected: burstInfo(10, 38, 48) },
      { state: { tick: 19, generalArmy: 2 }, expected: burstInfo(11, 38, 49) },
    ];
    runTestCases(TEST_CASES);
  });

  describe('existing general army with a few ticks remaining', () => {
    const TEST_CASES = [
      { state: { tick: 47, generalArmy: 3 }, expected: burstInfo(2, 47, 49) },
      { state: { tick: 47, generalArmy: 4 }, expected: burstInfo(3, 47, 50) },
      { state: { tick: 47, generalArmy: 5 }, expected: burstInfo(4, 47, 51) },
      { state: { tick: 47, generalArmy: 10 }, expected: burstInfo(9, 47, 56) },
    ];
    runTestCases(TEST_CASES);
  });

  describe('existing general army with more ticks remaining', () => {
    const TEST_CASES = [
      { state: { tick: 40, generalArmy: 6 }, expected: burstInfo(6, 42, 48) },
      { state: { tick: 41, generalArmy: 8 }, expected: burstInfo(8, 42, 50) },
      { state: { tick: 41, generalArmy: 12 }, expected: burstInfo(11, 41, 52) },
    ];
    runTestCases(TEST_CASES);
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
