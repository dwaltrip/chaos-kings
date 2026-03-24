import { invariant } from '@utils/assertions/invariant';
import type { FlatBoard } from '@core-next/flat-board';
import { parseFlatBaord } from '@algos/perfect-start-solver/utils/parse-board';

interface TestFlatBoard {
  name: string;
  board: FlatBoard;
  general: number;
}

const modules = import.meta.glob(
  '@algos/perfect-start-solver/test-boards-data/**/*.txt',
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
) as Record<string, string>;

const boardFiles = Object.fromEntries(
  Array.from(Object.entries(modules)).map(([key, text]) => {
    const filename = key.split('/').slice(-2).join('/');
    return [filename, text];
  }),
);
console.log(Object.keys(boardFiles));

// console.log('----- modules:', modules)

const SIMPLE_BOARDS = ['open-9x9', 'corridor-7x7'];

const boardsByName: Record<string, TestFlatBoard> = {};

function addBoard(name: string, filename: string) {
  const parsed = parseFlatBaord(boardFiles[filename]);
  boardsByName[name] = { name, ...parsed };
}

for (const name of SIMPLE_BOARDS) {
  const filename = `simple/${name}.txt`;
  invariant(filename in boardFiles, `Missing text file: ${name}.txt`);
  addBoard(name, filename);
}

function getBoard(name: string): TestFlatBoard {
  if (!(name in boardsByName)) {
    throw new Error(`Board not found: ${name}`);
  }
  return boardsByName[name];
}

export type { TestFlatBoard };
export { getBoard };
