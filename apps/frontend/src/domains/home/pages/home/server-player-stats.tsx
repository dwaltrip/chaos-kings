function ServerPlayerStats() {
  return (
    <div className="server-player-stats">
      <div className="stats-row">
        Players online (24 hours):
        <span>99</span>
      </div>
      <div className="stats-row">
        Active games (1 hour):
        <span>15</span>
      </div>
    </div>
  );
}

export { ServerPlayerStats };
