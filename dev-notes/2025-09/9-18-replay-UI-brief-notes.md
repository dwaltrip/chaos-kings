- Data loading: Fetch `config`, `move_history`, and `game_state` by `gameId` (si
mple REST GET).  
- Replayer integration: Use `@core/replay/replayer` to iterate frames; support `
maxSteps` for bounds.  
- State/store: Local component state or small Zustand slice for `step`, `playing
`, `speed`, `frame`.  
- Controls: Play/pause, step ±1, jump to start/end, speed (0.5x/1x/2x), optional
 scrubber slider.  
- Board render: Reuse game board component; render from `frame.board`; show play
er colors from `config.players.colors`.  
- Visibility modes: Full-map (default) and optional “player POV” (apply `getVisi
bleSquares`) toggle.  
- Routing: New page `frontend/src/pages/replay/` with route `/replay/:gameId`.  
- Perf: Pre-group events by step, memoize frames, and throttle render to speed. 
 
- UX polish: Show current step, winner (when reached), and metadata; handle part
ial histories gracefully.  
- Tests: Snapshot render for a few steps and a small deterministic replay sanity
 check.
