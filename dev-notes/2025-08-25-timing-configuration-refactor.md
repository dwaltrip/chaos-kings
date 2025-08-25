# 2025-08-25: Timing Configuration Refactor

## Project Goal

Refactor the codebase to support configurable game speeds (e.g., 2 moves per second, 4 moves per second, etc.) and centralize all timing-related "magic numbers" in the core game logic. Currently, timing values are hardcoded throughout the system, making it impossible to easily adjust game speed or support different game modes.

**End Goal:** Have all timing values defined in one centralized location, with different parts of the code configured with chosen values or receiving them as parameters, enabling easy game speed customization.

## Critical Problem Discovered

**Timing Inconsistency:** The core game logic in `engine.ts` was designed for 250ms ticks, but `game-coordinator.ts` currently uses 500ms ticks. This breaks the intended game timing:

- **General production:** Designed for 1 second (4×250ms) but now takes 2 seconds (4×500ms)
- **Army production:** Designed for 25 seconds (100×250ms) but now takes 50 seconds (100×500ms)

This makes the game significantly slower than intended and breaks the game balance.

## All Affected Files

### Core Files (timing logic)
1. `core/src/engine.ts` - hardcoded production intervals
2. `core/src/engine.test.ts` - hardcoded test expectations

### Backend Files (server coordination)
3. `backend/src/gameplay/game-coordinator.ts` - hardcoded TICK_RATE_MS
4. `backend/src/gameplay/game-server.ts` - hardcoded timers

### Frontend Files (UI timing)
5. `frontend/src/game-ui/store/gameplay-store.ts` - hardcoded animation delays

### New Files to Create
6. `core/src/timing-config.ts` - centralized timing configuration
7. `core/src/default-timing-config.ts` - default timing values

## Detailed Code Analysis

### 1. `core/src/engine.ts:tick()` Function

**Location:** Lines 15-23
**Current Code:**
```typescript
// General production: +1 unit every 4 ticks (1 per second at 250ms)
if (tickNumber % 4 === 0) {
  applyCityProduction(board);
}

// Army production: +1 unit every 100 ticks (25 seconds at 250ms)
if (tickNumber % 100 === 0) {
  applyTroopProduction(board);
}
```

**Assumptions:**
- Called every 250ms (designed tick rate)
- `tickNumber % 4 === 0` should occur every 1000ms (1 second) for general production
- `tickNumber % 100 === 0` should occur every 25000ms (25 seconds) for army production

**Current Problem:** With 500ms actual tick rate, generals produce every 2 seconds, armies every 50 seconds

**Refactor Needed:** Replace hardcoded intervals with calculated intervals based on timing config

### 2. `backend/src/gameplay/game-coordinator.ts`

**Location:** Lines 7-8
**Current Code:**
```typescript
// private readonly TICK_RATE_MS = 250;
private readonly TICK_RATE_MS = 500;
```

**Function:** `startGlobalTick()` - Lines 14-26
**Assumptions:**
- 250ms was intended design (now commented out)
- Currently hardcoded to 500ms
- Creates `setInterval()` that drives entire game timing system

**Usage:** Orchestrates all active games' tick progression via `setInterval(this.tick, TICK_RATE_MS)`

**Refactor Needed:** Remove hardcoded value, receive from centralized config

### 3. `backend/src/gameplay/game-server.ts`

**Multiple timing-related functions:**

#### `startFallbackTimer()` - Line 363
```typescript
this.fallbackTimer = setTimeout(() => { ... }, 10000);
```
**Assumptions:** 10000ms (10 seconds) is reasonable fallback delay
**Usage:** Ensures game starts even if not all players join
**Dependency:** Independent of game tick rate

#### `startCountdown()` - Line 392
```typescript
this.countdownInterval = setInterval(() => { ... }, 1000);
```
**Assumptions:** 1000ms countdown tick appropriate for UI
**Usage:** Pre-game countdown display (5-second countdown)
**Dependency:** Independent of game tick rate

#### `tick()` Function - Lines 109-135
**Assumptions:** Called by GameCoordinator at regular intervals
**Usage:** Processes moves, calls `engineTick()`, broadcasts state
**Dependency:** Tightly coupled to engine tick assumptions

### 4. `frontend/src/game-ui/store/gameplay-store.ts`

**Location:** Lines 91-97
**Function:** `setQueuedMoves()` timeout
```typescript
setTimeout(() => {
  set((currentState) => ({
    queuedMoves: currentState.queuedMoves.filter(
      (move) => moveToKey(move) !== moveToKey(arrow),
    ),
  }));
}, 200);
```

**Assumptions:** 200ms sufficient visual feedback time for removed arrows
**Usage:** Delays removal of move arrows for smooth UX
**Dependency:** Should be shorter than game tick rate, but otherwise independent

### 5. `core/src/engine.test.ts`

**Location:** Lines 34, 50
**Test Functions:**
```typescript
test('should produce units for generals every 4 ticks')
test('should produce units for armies every 100 ticks')
```

**Assumptions:** Tests assume original 250ms tick design
**Usage:** Validates game timing logic correctness
**Problem:** Hard-coded expectations (4, 100) break with different tick rates

## Function Dependencies Analysis

### Tightly Coupled (require coordination):
- `GameCoordinator.TICK_RATE_MS` ↔ `engine.tick()` production intervals
- `engine.test.ts` expectations ↔ actual engine behavior
- `GameServer.tick()` ↔ `engine.tick()` assumptions

### Loosely Coupled (can be independent):
- UI animation delays (200ms arrow removal)
- Game start countdown (1000ms intervals)
- Fallback timer (10000ms delay)

## Proposed Solution Architecture

### 1. Create Centralized Configuration
**New file:** `core/src/timing-config.ts`
```typescript
interface TimingConfig {
  tickRateMs: number;                    // Base tick interval (250ms, 500ms, etc.)
  generalProductionIntervalMs: number;   // How often generals produce (1000ms = 1 second)
  armyProductionIntervalMs: number;      // How often armies produce (25000ms = 25 seconds)
  uiAnimationDelayMs: number;           // UI transition delays (200ms for arrows)
  gameStartCountdownMs: number;         // Pre-game countdown (1000ms)
  gameStartFallbackMs: number;          // Fallback timer (10000ms)
}
```

### 2. Update Engine Logic
**Modify `engine.ts`:** Replace hardcoded tick intervals with calculated intervals:
- `generalProductionTicks = Math.round(config.generalProductionIntervalMs / config.tickRateMs)`
- `armyProductionTicks = Math.round(config.armyProductionIntervalMs / config.tickRateMs)`

### 3. Thread Configuration Through System
- `GameCoordinator` receives timing config in constructor
- `GameServer` constructor receives timing config
- `engine.tick()` function receives timing config as parameter
- All timing-dependent code uses config values

### 4. Create Preset Configurations
- **Standard:** 250ms ticks (original design intent)
- **Slow:** 500ms ticks (current broken implementation)
- **Fast:** 125ms ticks (for faster games)
- **Blitz:** 100ms ticks (very fast games)

## Key Insights

1. **Root Cause:** The timing inconsistency likely occurred during development when someone changed the tick rate without understanding the engine dependencies.

2. **Game Balance Impact:** The current 500ms implementation makes the game much slower and changes the strategic balance significantly.

3. **Testing Gap:** The existing tests don't catch timing configuration mismatches because they only test the engine in isolation.

4. **Architecture Principle:** Timing should be a first-class configuration concern, not scattered magic numbers.

## Questions for Implementation

1. Should timing config be per-game or global server setting?
2. Do you want game speed selectable by players when creating games?
3. Should we validate that timing configs result in reasonable gameplay (e.g., prevent configs that make armies produce faster than generals)?
4. How should we handle fractional ticks when intervals don't divide evenly?

## Implementation Priority

**Critical (fixes broken game):**
1. Fix the 250ms vs 500ms inconsistency
2. Update engine.ts to use calculated intervals
3. Update tests to work with configurable timing

**Important (enables configurability):**
4. Create centralized timing config structure
5. Thread config through all components
6. Add preset configurations

**Nice-to-have (polish):**
7. Add validation for reasonable timing configs
8. Add UI for game speed selection
9. Add timing config to game database schema
