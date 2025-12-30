import { ServerPlayerStats } from './server-player-stats';

const PlayGameControls = () => {
  return (
    <div className="play-game-controls">
      <ServerPlayerStats />- game mode selection - start game button - queue status -
      active players per mode - queue settings
    </div>
  );
};

export { PlayGameControls };
