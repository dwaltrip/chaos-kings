import { useEffect, useState } from 'react';

import { makeGeneralSquare } from '@core/map/make-squares';
import { makeBlankMap } from '@core/map/make-blank-map';

import { useGameplayStoreV2 } from '@/domains/gameplay/stores/gameplay-store-v2';
import { GameBoard } from '@/domains/gameplay/ui/game-board';

import './best-start-play-page.css';

function buildMap() {
  const grid = makeBlankMap(21, 21);
  grid[10][10] = makeGeneralSquare({ x: 10, y: 10 }, 0);
  return grid;
}

const GRID = buildMap();
const BOARD = {
  grid: GRID,
  size: {
    height: GRID.length,
    width: GRID[0].length,
  },
};

function BestStartPlayPage() {
  return <BestStartPlayPageContent></BestStartPlayPageContent>;
}

function BestStartPlayPageContent() {
  // const [map, setMap] = useState(null);
  // useEffect(() =>

  useEffect(() => {
    const { updateBoard } = useGameplayStoreV2.getState().actions;
    updateBoard(BOARD);
  }, []);

  return (
    <div className="best-start-play-page p-10">
      <h3>Best Start Play Page</h3>
      <br />
      <GameBoard boardState={BOARD} disabled={false} />
    </div>
  );
}

export { BestStartPlayPage };
