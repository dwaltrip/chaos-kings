import { timeIt } from '@/utils/time-it';
import { fmtObj, formatTable, round } from '@/utils/format';

import { maxSingleBurst } from './questions/q1-max-single-burst';
import { exploreEquivalentBurstChains } from './questions/q2-equivalent-burst-chains-simple';

/*
  With max tick = 50 
    - [x] Maximum possible single burst?
    - Maximum amount of overlap with (for given capture target (CT))
    - Maximum amount of overlap just based off ticks
*/

interface QuestionResult {
  num: number;
  description: string;
  result: any;
  time: number; // in milliseconds
}

const QUESTIONS = [
  {
    num: 1,
    description: 'max single burst',
    run: () => maxSingleBurst(),
  },
  {
    num: 2,
    description: 'equivalent burst chains (simple version)',
    run: () => exploreEquivalentBurstChains(),
  },
];

function runQuestions() {
  const results: QuestionResult[] = QUESTIONS.map(({ num, description, run }) => {
    const { result, time } = timeIt(() => run());
    return { num, description, result, time };
  });
  console.log(
    formatTable(
      ['#', 'Description', 'Result', 'Time'],
      results.map(({ num, description, result, time }, i) => [
        `${num}`,
        description,
        result ? fmtObj(result) : '-',
        `${round(time, 2)} ms`,
      ]),
    ),
  );
}

runQuestions();
