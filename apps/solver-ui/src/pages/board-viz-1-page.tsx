import { useEffect, useState } from 'react';

import { type TestFlatBoard, getBoard } from '@/lib/get-board';

import { BoardViz } from './board-viz';

function BoardViz1Page() {
  const [board, setBoard] = useState<TestFlatBoard | null>(null);

  useEffect(() => {
    setBoard(getBoard('open-9x9'));
  }, []);

  return (
    <div>
      <h1>Board Visualization 1</h1>

      {board ? <BoardViz board={board.board} /> : <p>Loading board...</p>}
    </div>
  );
}

export { BoardViz1Page };
