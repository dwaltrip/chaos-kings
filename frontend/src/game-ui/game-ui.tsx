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
  return (
    <div className='game-container'>
      <GameBoard game={game}/>
    </div>
  );
}

function playerIndexToPlayer(game: GameWithPlayers, playerIndex: number): Player {
  return game.players[playerIndex];
}

function GameBoard({ game }: { game: GameWithPlayers }) {
  const grid = game.config?.startingGrid as GameGrid;
  return (
    <div className='game-grid-container'>
      <table className='game-grid'>
        <tbody>
          {grid.map((row, y) => (
            <tr key={y}>
              {row.map((square, x) => (
                isPlayerSquare(square) ? (
                  <PlayerSquareView
                    square={square}
                    player={playerIndexToPlayer(game, square.playerIndex)}
                    game={game}
                    key={x}
                  />
                ) : (
                  <SquareView square={square} key={x}/>
                )
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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
  const className = `square ${square && square.type.toString().toLowerCase()}`;
  if (!square) {
    throw new Error('Square is null');
  }
  return (
    <td className={className}>
      {square.type === SquareType.MOUNTAIN && <img src={mountainIcon} />}
    </td>
  );
}

function PlayerSquareView({ square, player, game } : PlayerSquareProps) {
  const className = `square ${square && square.type.toString().toLowerCase()}`;
  if (!square) {
    throw new Error('Square is null');
  }
  return (
    <td className={className}>
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
    </td>
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
