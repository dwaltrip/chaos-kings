import { BurstInfo, maxBurstBeforeMaxTick } from '../abstract-moves';

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
