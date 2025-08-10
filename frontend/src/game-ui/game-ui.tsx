import mountainIcon from '@/assets/mountain.svg';
import generalIcon from '@/assets/crown.png';

import {
  SquareType,
  type Square,
  type PlayerSquare,
  PlayerSquareType,
  type GameGrid,
} from '@core/types';
import { type Player } from '@common/types/player';
import type { Game, GameWithPlayers } from '@common/types/games';
import { ColorMap } from '@core/colors';
import { isPlayerSquare, } from '@core/square';

import '@/game-ui/game-ui.css';

function GameUI({ game }: { game: GameWithPlayers }) {
  console.log('==================================================')
  console.log('Rendering GameUI')
  return <GameBoard game={game} />;
}

function playerIndexToPlayer(game: GameWithPlayers, playerIndex: number): Player {
  return game.players[playerIndex - 1];
}

function GameBoard({ game }: { game: GameWithPlayers }) {
  const grid = game.config?.startingGrid as GameGrid;
  const gridRows = grid.length;
  const gridCols = grid[0]?.length || 0;
  
  return (
    <div
      className="grid"
      style={{ "--rows": gridRows, "--cols": gridCols } as React.CSSProperties}
    >
      {grid.flat().map((square, i) => {
        return isPlayerSquare(square) ? (
          <PlayerSquareView
            key={i}
            square={square}
            player={playerIndexToPlayer(game, square.playerIndex)}
            game={game}
          />
        ) : (
          <SquareView key={i} square={square} />
        );
      })}
    </div>
  );
}

function ArmyCount({ count } : { count: number }){
  return <span className='army-count'>{count}</span>;
}

type PlayerSquareProps = { square: PlayerSquare, player: Player, game: Game };

function General({ square, player, game } : PlayerSquareProps) {
  return (
    <PlayerSquareLayout className='general-icon' player={player} game={game}>
      <img className='general-img' src={generalIcon} /> 
      <ArmyCount count={square.units} />
    </PlayerSquareLayout>
  );
}

function ArmySquare({ square, player, game } : PlayerSquareProps) {
  return (
    <PlayerSquareLayout className='army-square' player={player} game={game}>
      <ArmyCount count={square.units} />
    </PlayerSquareLayout>
  );
}

function SquareView({ square } : { square: Square }) {
  const className = `cell ${square && square.type.toString().toLowerCase()}`;
  if (!square) {
    throw new Error('Square is null');
  }
  return (
    <div className={className}>
      {square.type === SquareType.MOUNTAIN && <img src={mountainIcon} />}
    </div>
  );
}

function PlayerSquareView({ square, player, game } : PlayerSquareProps) {
  const className = `cell ${square && square.type.toString().toLowerCase()}`;
  if (!square) {
    throw new Error('Square is null');
  }
  return (
    <div className={className}>
      {square.type === PlayerSquareType.GENERAL && 
        <General square={square} player={player} game={game}/>
      }
      {square.type === PlayerSquareType.ARMY &&
        <ArmySquare square={square} player={player} game={game}/>
      }
      {/* TODO: Implement view for PLAYER_CITY */}
      {square.type === PlayerSquareType.PLAYER_CITY &&
        <ArmySquare square={square} player={player} game={game}/>
      }
    </div>
  );
}

// ---------------------------------------
// TODO: consolidate with PlayerSquareView
// ---------------------------------------
function PlayerSquareLayout(
  { game, player, children, className } :
  { game: Game, player: Player, children: any, className?: string }
) {
  const colorStyle = { backgroundColor: getPlayerColorInHex(game, player) };
  return (
    <div className={`player-square ${className || ''}`} style={colorStyle}>
      {children}
    </div>
  );
}

function getPlayerColorInHex(game: Game, player: Player): string {
  const color = game.config?.playerIndexToColor[player.player_index.toString()];
  const hexColor = color ?  ColorMap.get(color) : null;
  if (!hexColor) {
    console.warn(`No hex value found for color: ${color}`);
    return '#777';
  }
  return hexColor;
}

export { GameUI };
