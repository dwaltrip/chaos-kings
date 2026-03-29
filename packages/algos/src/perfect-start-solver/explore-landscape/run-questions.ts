import { timeIt } from '@/utils/time-it';
import { fmtObj, formatTable, round } from '../format';

import { maxSingleBurst } from './questions/q1-max-single-burst';

/*
  With max tick = 50 
    - [x] Maximum possible single burst?
    - Maximum amount of overlap with (for given capture target (CT))
    - Maximum amount of overlap just based off ticks
*/

interface QuestionResult {
  description: string;
  result: any;
  time: number; // in milliseconds
}

const QUESTIONS = [
  {
    description: 'max single burst',
    run: () => maxSingleBurst(),
  },
];

function runQuestions() {
  const results: QuestionResult[] = QUESTIONS.map(({ description, run }) => {
    const { result, time } = timeIt(() => run());
    return { description, result, time };
  });
  console.log(
    formatTable(
      ['Description', 'Result', 'Time'],
      results.map(({ description, result, time }) => [
        description,
        fmtObj(result),
        `${round(time, 2)} ms`,
      ]),
    ),
  );
}

runQuestions();
