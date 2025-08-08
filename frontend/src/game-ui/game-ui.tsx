import mountainIcon from '@/assets/mountain.svg';
import generalIcon from '@/assets/crown.png';

import {
  SquareType,
  type Square,
  type PlayerSquare,
  PlayerSquareType,
  type GameGrid,
} from '@core/types';
import { Player, getPlayerColorInHex } from '@common/types/player';
import type { GameWithPlayers } from '@common/types/games';
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
  const grid = (game.game_state as any).grid as GameGrid;
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

type PlayerSquareProps = { square: PlayerSquare, player: Player };

function General({ square, player } : PlayerSquareProps) {
  return (
    <PlayerSquareLayout className='general-icon' player={player}>
      <img className='general-img' src={generalIcon} /> 
      <ArmyCount count={square.units} />
    </PlayerSquareLayout>
  );
}

function ArmySquare({ square, player } : PlayerSquareProps) {
  return (
    <PlayerSquareLayout className='army-square' player={player}>
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

function PlayerSquareView({ square, player } : { square: PlayerSquare, player: Player }) {
  const className = `square ${square && square.type.toString().toLowerCase()}`;
  if (!square) {
    throw new Error('Square is null');
  }
  return (
    <td className={className}>
      {square.type === PlayerSquareType.GENERAL && 
        <General square={square} player={player}/>
      }
      {square.type === PlayerSquareType.ARMY &&
        <ArmySquare square={square} player={player}/>
      }
      {/* TODO: Implement view for PLAYER_CITY */}
      {square.type === PlayerSquareType.PLAYER_CITY &&
        <ArmySquare square={square} player={player}/>
      }
    </td>
  );
}

// ---------------------------------------
// TODO: consolidate with PlayerSquareView
// ---------------------------------------
function PlayerSquareLayout(
  { player, children, className } :
  { player: Player, children: any, className?: string }
) {
  const colorStyle = { backgroundColor: getPlayerColorInHex(player) };
  return (
    <div className={`player-square ${className || ''}`} style={colorStyle}>
      {children}
    </div>
  );
}


export { GameUI };
