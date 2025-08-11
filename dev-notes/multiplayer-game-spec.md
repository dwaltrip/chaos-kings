# Multiplayer Soft Real-Time Game Implementation Guide

## Overview

This document specifies a minimal but complete architecture for a multiplayer soft real-time game with WebSocket-based state synchronization. The design prioritizes simplicity for prototyping while maintaining consistency across clients.

### Core Architecture Decisions
- **Server-authoritative model**: Server maintains the true game state
- **Full state snapshots**: Complete state sent each tick (suitable for states <10KB)
- **No client-side prediction**: Clients display last received state
- **Fixed player count**: Determined at game start
- **Tick rate**: 5-10 updates per second (100-200ms per tick)

---

## WebSocket Message Protocol

### Server → Client Messages

```typescript
type ServerMessage = 
  | { type: 'game_state', tick: number, state: GameState, checksum?: string }
  | { type: 'connected', playerId: string }
  | { type: 'game_start', initialState: GameState, tickRate: number }
  | { type: 'player_disconnected', playerId: string }
  | { type: 'player_reconnected', playerId: string }
```

### Client → Server Messages

```typescript
type ClientMessage =
  | { type: 'move', data: MoveData, clientTimestamp: number }
  | { type: 'ping' }  // for keepalive
```

---

## Server Implementation

### Core Game Server

```javascript
class GameServer {
  constructor(tickRate = 100) { // 100ms = 10 ticks/second
    this.tickRate = tickRate
    this.currentTick = 0
    this.gameState = null
    this.players = new Map() // playerId -> { ws, lastSeen, connected }
    this.moveQueue = []      // { playerId, move, timestamp, receivedAt }
    this.disconnectTimeout = 30000 // 30 seconds
  }

  startGame(initialState) {
    this.gameState = initialState
    this.broadcast({ type: 'game_start', initialState, tickRate: this.tickRate })
    
    // Core game loop
    this.tickInterval = setInterval(() => this.gameTick(), this.tickRate)
    
    // Connection monitor
    this.connectionInterval = setInterval(() => this.checkConnections(), 1000)
  }

  gameTick() {
    try {
      // Sort moves by timestamp (client time) for this tick window
      const tickMoves = this.moveQueue.filter(m => 
        m.receivedAt <= Date.now() // only process moves received before tick
      )
      this.moveQueue = this.moveQueue.filter(m => 
        m.receivedAt > Date.now() // keep future moves
      )

      // Prevent queue overflow
      if (this.moveQueue.length > 1000) {
        console.warn('Move queue overflow, clearing old moves')
        this.moveQueue = this.moveQueue.slice(-500)
      }

      // Update state with validated moves
      const validMoves = tickMoves
        .sort((a, b) => a.timestamp - b.timestamp)
        .filter(m => validateMove(this.gameState, m))
      
      this.gameState = updateState(
        this.gameState, 
        this.currentTick,
        validMoves
      )
      
      this.currentTick++
      
      // Broadcast new state to all connected players
      const message = { 
        type: 'game_state', 
        tick: this.currentTick, 
        state: this.gameState
      }

      // Add checksum in debug mode
      if (process.env.DEBUG) {
        message.checksum = this.generateChecksum(this.gameState)
      }
      
      this.broadcast(message)
    } catch (error) {
      console.error('Game tick error:', error)
      // Game continues despite errors
    }
  }

  handlePlayerMessage(playerId, message) {
    const player = this.players.get(playerId)
    if (!player) return
    
    player.lastSeen = Date.now()
    
    if (message.type === 'move') {
      // Clamp client timestamp to prevent cheating
      const maxPastTime = 1000 // 1 second
      const clampedTimestamp = Math.max(
        message.clientTimestamp,
        Date.now() - maxPastTime
      )
      
      this.moveQueue.push({
        playerId,
        move: message.data,
        timestamp: clampedTimestamp,
        receivedAt: Date.now()
      })
    }
  }

  checkConnections() {
    const now = Date.now()
    for (const [playerId, player] of this.players) {
      if (player.connected && now - player.lastSeen > this.disconnectTimeout) {
        player.connected = false
        this.broadcast({ type: 'player_disconnected', playerId })
      }
    }
  }

  broadcast(message) {
    const serialized = JSON.stringify(message)
    for (const [_, player] of this.players) {
      if (player.connected && player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(serialized)
      }
    }
  }

  generateChecksum(state) {
    const crypto = require('crypto')
    return crypto
      .createHash('md5')
      .update(JSON.stringify(state))
      .digest('hex')
      .slice(0, 8)
  }

  cleanup() {
    clearInterval(this.tickInterval)
    clearInterval(this.connectionInterval)
    for (const [_, player] of this.players) {
      if (player.ws) player.ws.close()
    }
  }
}
```

### Game Coordinator (Lobby/Matchmaking)

```javascript
class GameCoordinator {
  constructor() {
    this.waitingPlayers = []
    this.activeGames = new Map()
    this.playerToGame = new Map() // playerId -> gameId
  }
  
  handleNewPlayer(ws, playerId) {
    // Check if player is reconnecting to existing game
    const existingGameId = this.playerToGame.get(playerId)
    if (existingGameId) {
      const game = this.activeGames.get(existingGameId)
      if (game) {
        game.reconnectPlayer(playerId, ws)
        return
      }
    }
    
    // Add to waiting queue
    this.waitingPlayers.push({ ws, playerId })
    ws.send(JSON.stringify({ 
      type: 'queued', 
      position: this.waitingPlayers.length 
    }))
    
    // Start game if enough players
    const PLAYERS_PER_GAME = 4 // Configure as needed
    if (this.waitingPlayers.length >= PLAYERS_PER_GAME) {
      this.startNewGame()
    }
  }
  
  startNewGame() {
    const PLAYERS_PER_GAME = 4
    const players = this.waitingPlayers.splice(0, PLAYERS_PER_GAME)
    const gameId = generateGameId()
    const game = new GameServer()
    
    // Register players
    players.forEach(({ ws, playerId }) => {
      game.players.set(playerId, { 
        ws, 
        lastSeen: Date.now(), 
        connected: true 
      })
      this.playerToGame.set(playerId, gameId)
    })
    
    // Initialize game state
    const initialState = createInitialState(players.map(p => p.playerId))
    game.startGame(initialState)
    
    this.activeGames.set(gameId, game)
  }
  
  handleGameEnd(gameId) {
    const game = this.activeGames.get(gameId)
    if (game) {
      game.cleanup()
      this.activeGames.delete(gameId)
      
      // Clean up player mappings
      for (const [playerId, gId] of this.playerToGame) {
        if (gId === gameId) {
          this.playerToGame.delete(playerId)
        }
      }
    }
  }
}
```

---

## Client Implementation

```javascript
class GameClient {
  constructor(serverUrl, playerId) {
    this.playerId = playerId
    this.serverUrl = serverUrl
    this.ws = null
    this.gameState = null
    this.currentTick = 0
    this.reconnectDelay = 1000
    this.maxReconnectDelay = 5000
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 10
  }

  connect() {
    this.ws = new WebSocket(this.serverUrl)
    
    this.ws.onopen = () => {
      console.log('Connected to server')
      this.reconnectDelay = 1000 // reset backoff
      this.reconnectAttempts = 0
      
      // Send identification
      this.ws.send(JSON.stringify({ 
        type: 'identify', 
        playerId: this.playerId 
      }))
      
      // Send ping every 5 seconds to maintain connection
      this.pingInterval = setInterval(() => {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, 5000)
    }

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        this.handleServerMessage(message)
      } catch (error) {
        console.error('Failed to parse message:', error)
      }
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    this.ws.onclose = () => {
      clearInterval(this.pingInterval)
      this.handleDisconnect()
    }
  }

  handleServerMessage(message) {
    // Log in debug mode
    if (window.DEBUG) {
      console.log(`[${Date.now()}] Received:`, message.type, 
        message.tick || '', JSON.stringify(message).length + ' bytes')
    }
    
    switch(message.type) {
      case 'game_start':
        this.gameState = message.initialState
        this.startRenderLoop()
        break
        
      case 'game_state':
        this.gameState = message.state
        this.currentTick = message.tick
        
        // Verify checksum in debug mode
        if (window.DEBUG && message.checksum) {
          const localChecksum = this.generateChecksum(message.state)
          if (localChecksum !== message.checksum) {
            console.error('State checksum mismatch!')
          }
        }
        break
        
      case 'player_disconnected':
        this.handlePlayerDisconnect(message.playerId)
        break
        
      case 'player_reconnected':
        this.handlePlayerReconnect(message.playerId)
        break
    }
  }

  handleDisconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        console.log(`Reconnection attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts}`)
        this.reconnectAttempts++
        this.connect()
        this.reconnectDelay = Math.min(
          this.reconnectDelay * 1.5, 
          this.maxReconnectDelay
        )
      }, this.reconnectDelay)
    } else {
      console.error('Max reconnection attempts reached')
      this.onConnectionLost?.()
    }
  }

  sendMove(moveData) {
    if (this.ws.readyState === WebSocket.OPEN) {
      const message = {
        type: 'move',
        data: moveData,
        clientTimestamp: Date.now()
      }
      
      this.ws.send(JSON.stringify(message))
      
      // Log in debug mode
      if (window.DEBUG) {
        console.log(`[${Date.now()}] Sent move:`, moveData)
      }
    } else {
      console.warn('Cannot send move: WebSocket not connected')
    }
  }

  startRenderLoop() {
    // Render at 60fps regardless of game tick rate
    const render = () => {
      if (this.gameState) {
        this.renderGame(this.gameState)
      }
      requestAnimationFrame(render)
    }
    render()
  }

  renderGame(state) {
    // Implement your rendering logic here
    // This is called at 60fps with the latest state
  }

  generateChecksum(state) {
    // Simple checksum for browser (not cryptographically secure)
    let hash = 0
    const str = JSON.stringify(state)
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return hash.toString(16)
  }
}
```

---

## Development & Testing Tools

### Latency Simulation

```javascript
// Wrap this around your message handlers during development
class LatencySimulator {
  constructor(minLatency = 20, maxLatency = 150) {
    this.minLatency = minLatency
    this.maxLatency = maxLatency
  }
  
  async simulateLatency() {
    const delay = this.minLatency + Math.random() * (this.maxLatency - this.minLatency)
    await new Promise(resolve => setTimeout(resolve, delay))
  }
  
  wrapHandler(handler) {
    return async (...args) => {
      await this.simulateLatency()
      return handler(...args)
    }
  }
}

// Usage
if (process.env.NODE_ENV === 'development') {
  const simulator = new LatencySimulator()
  server.handleMessage = simulator.wrapHandler(server.handleMessage)
}
```

### Debug Panel

```javascript
// Client-side debug utilities
class DebugPanel {
  constructor(client) {
    this.client = client
    
    if (!window.DEBUG) return
    
    // Create debug UI
    const panel = document.createElement('div')
    panel.id = 'debug-panel'
    panel.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 10px;
      font-family: monospace;
      font-size: 12px;
      z-index: 10000;
    `
    document.body.appendChild(panel)
    
    // Update display
    setInterval(() => this.update(), 100)
    
    // Expose global debug object
    window.gameDebug = {
      getState: () => this.client.gameState,
      getTick: () => this.client.currentTick,
      sendMove: (data) => this.client.sendMove(data),
      disconnect: () => this.client.ws.close(),
      reconnect: () => this.client.connect()
    }
  }
  
  update() {
    const panel = document.getElementById('debug-panel')
    if (!panel) return
    
    panel.innerHTML = `
      <div>Tick: ${this.client.currentTick}</div>
      <div>Connected: ${this.client.ws?.readyState === WebSocket.OPEN}</div>
      <div>State size: ${JSON.stringify(this.client.gameState || {}).length} bytes</div>
      <div>Player ID: ${this.client.playerId}</div>
    `
  }
}
```

### Message Logger

```javascript
class MessageLogger {
  constructor(maxLogs = 100) {
    this.logs = []
    this.maxLogs = maxLogs
  }
  
  log(direction, message) {
    const entry = {
      timestamp: Date.now(),
      direction, // 'in' or 'out'
      type: message.type,
      size: JSON.stringify(message).length,
      tick: message.tick
    }
    
    this.logs.push(entry)
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }
    
    // Console output
    console.log(
      `[${new Date(entry.timestamp).toISOString()}] ${direction.toUpperCase()}:`,
      entry.type,
      entry.tick ? `tick=${entry.tick}` : '',
      `${entry.size} bytes`
    )
  }
  
  getStats() {
    const now = Date.now()
    const recentLogs = this.logs.filter(l => now - l.timestamp < 10000)
    
    return {
      messagesPerSecond: recentLogs.length / 10,
      averageSize: recentLogs.reduce((sum, l) => sum + l.size, 0) / recentLogs.length,
      messageTypes: recentLogs.reduce((acc, l) => {
        acc[l.type] = (acc[l.type] || 0) + 1
        return acc
      }, {})
    }
  }
}
```

---

## Integration Checklist

### Pre-Integration Requirements

- [ ] **State Serialization**: Ensure GameState is JSON-serializable
  - No circular references
  - No functions, undefined, or Symbol types
  - Consider flattening deeply nested objects
  - Test with `JSON.parse(JSON.stringify(state))`

- [ ] **Dependencies**
  - Server: `npm install ws` (or `socket.io` for easier prototyping)
  - Client: Native WebSocket or `reconnecting-websocket` library
  - Optional: `msgpack-lite` for binary serialization

- [ ] **Environment Setup**
  ```javascript
  // .env file
  NODE_ENV=development
  DEBUG=true
  GAME_TICK_RATE=100
  MAX_PLAYERS=4
  PORT=3000
  ```

- [ ] **CORS Configuration** (if client/server on different ports)
  ```javascript
  // Add to server
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Headers', 'Content-Type')
    next()
  })
  ```

### Error Handling

- [ ] Wrap `updateState` in try/catch
- [ ] Validate JSON before parsing
- [ ] Rate limit moves per player (e.g., max 10 per second)
- [ ] Handle WebSocket connection errors gracefully
- [ ] Add max queue sizes to prevent memory leaks

### Performance Monitoring

- [ ] Track message sizes and frequencies
- [ ] Monitor server tick duration
- [ ] Log player latencies
- [ ] Watch for memory leaks (growing queues, uncleaned intervals)
- [ ] Test with simulated poor connections

---

## Optimization Strategies (Future Improvements)

### 1. Delta Compression
Instead of sending full state, send only changes:
```javascript
const delta = {
  tick: 100,
  changes: {
    'players.player1.position': { x: 10, y: 20 },
    'gameObjects.5.health': 80
  }
}
```

### 2. Client-Side Prediction
Allow immediate local response to player inputs:
```javascript
// Apply move locally immediately
localState = applyMoveLocally(localState, move)
// Reconcile when server state arrives
localState = reconcileStates(localState, serverState)
```

### 3. Interpolation
Smooth visual movement between ticks:
```javascript
// Interpolate between last two received states
const alpha = (Date.now() - lastTickTime) / tickRate
renderState = interpolate(previousState, currentState, alpha)
```

### 4. Binary Protocol
Use MessagePack or Protocol Buffers for ~50% size reduction:
```javascript
const msgpack = require('msgpack-lite')
ws.send(msgpack.encode(message))
```

### 5. Adaptive Tick Rate
Adjust based on game activity:
```javascript
const getAdaptiveTickRate = () => {
  if (combatActive) return 50   // 20 fps during combat
  if (playersMoving) return 100  // 10 fps during movement
  return 200  // 5 fps when idle
}
```

---

## Common Pitfalls & Solutions

### Pitfall 1: Trusting Client Timestamps
**Problem**: Players can send moves with past timestamps to gain priority.
**Solution**: Clamp timestamps to reasonable bounds (see server implementation).

### Pitfall 2: Memory Leaks
**Problem**: Intervals not cleared, players not removed from maps.
**Solution**: Always clear intervals in cleanup methods, use WeakMap where appropriate.

### Pitfall 3: Queue Overflow
**Problem**: Move queue grows unbounded during network issues.
**Solution**: Implement max queue size per player, drop oldest moves.

### Pitfall 4: State Desync
**Problem**: Floating point errors or non-deterministic operations cause divergence.
**Solution**: Use checksums in debug mode, avoid Math.random() in updateState.

### Pitfall 5: WebSocket vs Application Ping
**Problem**: Confusing WebSocket protocol ping with application-level ping.
**Solution**: Use both - WebSocket ping for connection health, app ping for latency measurement.

---

## Quick Start Example

```javascript
// Server setup
const WebSocket = require('ws')
const wss = new WebSocket.Server({ port: 3000 })
const coordinator = new GameCoordinator()

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    const message = JSON.parse(data)
    if (message.type === 'identify') {
      coordinator.handleNewPlayer(ws, message.playerId)
    }
  })
})

// Client setup
const client = new GameClient('ws://localhost:3000', 'player-123')
client.connect()

// Send moves from game input
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp') {
    client.sendMove({ action: 'move', direction: 'up' })
  }
})

// Implement rendering
client.renderGame = (state) => {
  // Your canvas/DOM rendering logic here
  updateCanvas(state)
}
```

---

## Summary

This architecture provides a solid foundation for a multiplayer prototype that:
- Maintains consistent state across all clients
- Handles disconnections gracefully
- Scales to 5-10 ticks per second
- Supports games with reasonable state sizes (<10KB)
- Can be optimized later without major refactoring

The simplicity of this approach makes debugging straightforward and allows you to focus on game mechanics rather than complex synchronization issues. Once your prototype is working, you can selectively add optimizations like delta compression or client prediction based on actual performance needs.