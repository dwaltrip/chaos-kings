import { useEffect } from 'react';
import mountainIcon from '@/assets/mountain.svg';
import generalIcon from '@/assets/crown.png';

import {
  SquareType,
  type Square,
  type PlayerSquare,
  PlayerSquareType,
  type BoardState,
  type Coord,
} from '@core/types';
import { isPlayerSquare } from '@core/square';

import '@/game-ui/game-ui.css';

interface GameUIProps {
  boardState: BoardState;
  selectedTile: Coord | null;
  onTileSelect: (coord: Coord) => void;
  onMoveRequest: (direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => void;
  onCancelMoves: () => void;
}

function GameUI({ boardState, selectedTile, onTileSelect, onMoveRequest, onCancelMoves }: GameUIProps) {
  console.log('==================================================')
  console.log('Rendering GameUI')
  
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      switch (event.key.toLowerCase()) {
        case 'w':
          onMoveRequest('UP');
          event.preventDefault();
          break;
        case 's':
          onMoveRequest('DOWN');
          event.preventDefault();
          break;
        case 'a':
          onMoveRequest('LEFT');
          event.preventDefault();
          break;
        case 'd':
          onMoveRequest('RIGHT');
          event.preventDefault();
          break;
        case 'q':
          onCancelMoves();
          event.preventDefault();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onMoveRequest, onCancelMoves]);
  
  return <GameBoard boardState={boardState} selectedTile={selectedTile} onTileSelect={onTileSelect} />;
}

function playerIndexToColor(playerIndex: number): string {
  // Simple color mapping for now - could be made configurable
  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24'];
  return colors[playerIndex] || '#777';
}

interface GameBoardProps {
  boardState: BoardState;
  selectedTile: Coord | null;
  onTileSelect: (coord: Coord) => void;
}

function GameBoard({ boardState, selectedTile, onTileSelect }: GameBoardProps) {
  const grid = boardState.grid;
  const gridRows = grid.length;
  const gridCols = grid[0]?.length || 0;
  
  return (
    <div
      className="grid"
      style={{ "--rows": gridRows, "--cols": gridCols } as React.CSSProperties}
    >
      {grid.flat().map((square, i) => {
        const row = Math.floor(i / gridCols);
        const col = i % gridCols;
        const coord = { x: col, y: row };
        const isSelected = selectedTile ? selectedTile.x === coord.x && selectedTile.y === coord.y : false;
        
        return isPlayerSquare(square) ? (
          <PlayerSquareView
            key={i}
            square={square}
            coord={coord}
            isSelected={isSelected}
            onTileSelect={onTileSelect}
          />
        ) : (
          <SquareView key={i} square={square} coord={coord} isSelected={isSelected} onTileSelect={onTileSelect} />
        );
      })}
    </div>
  );
}

function ArmyCount({ count } : { count: number }){
  return <span className='army-count'>{count}</span>;
}

type PlayerSquareProps = { 
  square: PlayerSquare; 
  coord: Coord; 
  isSelected: boolean; 
  onTileSelect: (coord: Coord) => void; 
};

function General({ square, coord, isSelected, onTileSelect } : PlayerSquareProps) {
  return (
    <PlayerSquareLayout className='general-icon' playerIndex={square.playerIndex} isSelected={isSelected} onClick={() => onTileSelect(coord)}>
      <img className='general-img' src={generalIcon} /> 
      <ArmyCount count={square.units} />
    </PlayerSquareLayout>
  );
}

function ArmySquare({ square, coord, isSelected, onTileSelect } : PlayerSquareProps) {
  return (
    <PlayerSquareLayout className='army-square' playerIndex={square.playerIndex} isSelected={isSelected} onClick={() => onTileSelect(coord)}>
      <ArmyCount count={square.units} />
    </PlayerSquareLayout>
  );
}

function SquareView({ square, coord, isSelected, onTileSelect } : { 
  square: Square; 
  coord: Coord; 
  isSelected: boolean; 
  onTileSelect: (coord: Coord) => void; 
}) {
  const className = `cell ${square && square.type.toString().toLowerCase()} ${isSelected ? 'selected' : ''}`;
  if (!square) {
    throw new Error('Square is null');
  }
  return (
    <div className={className} onClick={() => onTileSelect(coord)}>
      {square.type === SquareType.MOUNTAIN && <img src={mountainIcon} />}
    </div>
  );
}

function PlayerSquareView({ square, coord, isSelected, onTileSelect } : PlayerSquareProps) {
  const className = `cell ${square && square.type.toString().toLowerCase()}`;
  if (!square) {
    throw new Error('Square is null');
  }
  return (
    <div className={className}>
      {square.type === PlayerSquareType.GENERAL && 
        <General square={square} coord={coord} isSelected={isSelected} onTileSelect={onTileSelect}/>
      }
      {square.type === PlayerSquareType.ARMY &&
        <ArmySquare square={square} coord={coord} isSelected={isSelected} onTileSelect={onTileSelect}/>
      }
      {/* TODO: Implement view for PLAYER_CITY */}
      {square.type === PlayerSquareType.PLAYER_CITY &&
        <ArmySquare square={square} coord={coord} isSelected={isSelected} onTileSelect={onTileSelect}/>
      }
    </div>
  );
}

// ---------------------------------------
// TODO: consolidate with PlayerSquareView
// ---------------------------------------
function PlayerSquareLayout(
  { playerIndex, children, className, isSelected, onClick } :
  { playerIndex: number, children: any, className?: string, isSelected: boolean, onClick: () => void }
) {
  const colorStyle = { backgroundColor: playerIndexToColor(playerIndex) };
  const selectedClass = isSelected ? 'selected' : '';
  return (
    <div 
      className={`player-square ${className || ''} ${selectedClass}`} 
      style={colorStyle}
      onClick={onClick}
    >
      {children}
    </div>
  );
}


export { GameUI };

