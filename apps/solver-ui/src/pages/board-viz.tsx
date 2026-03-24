import { useEffect, useState } from 'react';

import { Board, type FlatBoard, type Tile } from '@algos/core-next/flat-board';

function VizTile({ tile }: { tile: Tile }) {
  return (
    <div className="tile">
      {tile.type}
      {/* ({tile.x}, {tile.y}) */}
    </div>
  );
}

interface BoardVizProps {
  board: FlatBoard;
}

function BoardViz({ board }: BoardVizProps) {
  const [tiles, setTiles] = useState<Tile[][]>([]);

  useEffect(() => {
    setTiles(Board.mapTiles2d(board, (tile) => tile));
  }, [board]);
  return (
    <div>
      {tiles.map((row, y) => (
        <div key={y} style={{ display: 'flex' }}>
          {row.map((tile) => (
            <VizTile key={tile.idx} tile={tile} />
          ))}
        </div>
      ))}
    </div>
  );
}

export { BoardViz };
