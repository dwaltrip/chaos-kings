function HomePage() {
  return (
    <div>
      <div className="user-info">
        - avatar / user icon - username - ranking info / basic stats
      </div>

      <div className="lobby-chat">- user list - message list - message input</div>

      <div className="games-spotlight">
        - featured / cool / recently played games list
      </div>

      <div className="play-game-controls">
        - game mode selection - start game button - queue status - active players per mode
        - queue settings
      </div>
    </div>
  );
}

export { HomePage };
