# 2025-08-25: Timing Configuration Refactor

## Project Goal

Refactor the codebase to support configurable game speeds (e.g., 2 moves per second, 4 moves per second, etc.) and centralize all timing-related "magic numbers" in the core game logic. Currently, timing values are hardcoded throughout the system, making it impossible to easily adjust game speed or support different game modes.

**End Goal:** Have all timing values defined in one centralized location, with different parts of the code configured with chosen values or receiving them as parameters, enabling easy game speed customization.

## Current State Assessment

**Timing Status:** The game currently runs at 250ms tick intervals. All timing values are hardcoded throughout the system, making it impossible to easily adjust game speed or support different game modes.

- **General production:** Every 1 second (4 ticks × 250ms)
- **Army production:** Every 25 seconds (100 ticks × 250ms)

## All Affected Files

### Core Files (timing logic)
1. `core/src/engine.ts` - hardcoded production intervals
2. `core/src/engine.test.ts` - hardcoded test expectations

### Backend Files (server coordination)
3. `backend/src/gameplay/game-coordinator.ts` - hardcoded TICK_RATE_MS
4. `backend/src/gameplay/game-server.ts` - hardcoded timers

### Frontend Files (UI timing)
5. `frontend/src/game-ui/store/gameplay-store.ts` - hardcoded animation delays
6. `frontend/src/pages/join-game/join-game-page.tsx` - matchmaking timer
7. `frontend/src/pages/join-game/game-matchmaking-ws-handler.ts` - navigation delay
8. `frontend/src/components/game-countdown.tsx` - CSS transition durations

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
- Called every 250ms
- `tickNumber % 4 === 0` occurs every 1000ms (1 second) for general production
- `tickNumber % 100 === 0` occurs every 25000ms (25 seconds) for army production

**Refactor Needed:** Replace hardcoded intervals with calculated intervals based on timing config

### 2. `backend/src/gameplay/game-coordinator.ts`

**Location:** Line 6
**Current Code:**
```typescript
private readonly TICK_RATE_MS = 250;
```

**Function:** `startGlobalTick()` - Lines 12-24
**Assumptions:**
- 250ms tick rate drives entire game timing system
- Creates `setInterval()` that coordinates all active games

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
}, 500);
```

**Assumptions:** 500ms sufficient visual feedback time for removed arrows
**Usage:** Delays removal of move arrows for smooth UX
**Dependency:** Should be longer than game tick rate to provide visual feedback, but otherwise independent

### 5. `core/src/engine.test.ts`

**Location:** Lines 34, 50
**Test Functions:**
```typescript
test('should produce units for generals every 4 ticks')
test('should produce units for armies every 100 ticks')
```

**Assumptions:** Tests assume 250ms tick design
**Usage:** Validates game timing logic correctness
**Problem:** Hard-coded expectations (4, 100) break with different tick rates

### 6. `frontend/src/pages/join-game/join-game-page.tsx`

**Location:** Lines 31-35
**Function:** Matchmaking waiting timer
```typescript
const interval = setInterval(() => {
  setWaitingTime((prev) => prev + 1);
}, 1000);
```

**Assumptions:** 1000ms (1 second) appropriate for user-facing timer display
**Usage:** Updates waiting time counter for players in matchmaking queue
**Dependency:** Independent of game tick rate - UI feedback timing

### 7. `frontend/src/pages/join-game/game-matchmaking-ws-handler.ts`

**Location:** Lines 42-45
**Function:** Game navigation delay
```typescript
setTimeout(() => {
  console.log(`Navigating to game ${gameId}...`);
  window.location.href = `/games/${gameId}`;
}, 1000);
```

**Assumptions:** 1000ms (1 second) provides adequate visual feedback before navigation
**Usage:** Delays navigation to game page after match is found
**Dependency:** Independent of game tick rate - UX timing

### 8. `frontend/src/components/game-countdown.tsx`

**Location:** Lines 60, 65
**Function:** CSS transition durations
```typescript
className="transition-all duration-1000 ease-linear"  // Line 60
className="text-4xl font-bold text-gray-800 transition-all duration-300"  // Line 65
```

**Assumptions:** 1000ms for progress animation, 300ms for text transitions
**Usage:** Countdown circle progress animation and number change transitions
**Dependency:** Independent of game tick rate - visual polish timing

## Function Dependencies Analysis

### Tightly Coupled (require coordination):
- `GameCoordinator.TICK_RATE_MS` ↔ `engine.tick()` production intervals
- `engine.test.ts` expectations ↔ actual engine behavior
- `GameServer.tick()` ↔ `engine.tick()` assumptions

### Loosely Coupled (can be independent):
- UI animation delays (500ms arrow removal)
- Game start countdown (1000ms intervals) 
- Fallback timer (10000ms delay)
- Matchmaking timers (1000ms updates)
- Navigation delays (1000ms)
- CSS animations (300ms, 1000ms)

## Possible Solution Brainstorm

*Note: This is one possible approach to consider. We will thoroughly plan the actual implementation separately.*

### 1. Create Centralized Configuration
**Potential new files:**
- `core/src/timing-config.ts` - centralized timing configuration interface
- `core/src/default-timing-config.ts` - default timing values

**Example structure:** `core/src/timing-config.ts`
```typescript
interface TimingConfig {
  tickRateMs: number;                    // Base tick interval (250ms, 500ms, etc.)
  generalProductionIntervalMs: number;   // How often generals produce (1000ms = 1 second)
  armyProductionIntervalMs: number;      // How often armies produce (25000ms = 25 seconds)
  uiAnimationDelayMs: number;           // UI transition delays (500ms for arrows)
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
- **Standard:** 250ms ticks
- **Slow:** 500ms ticks
- **Fast:** 125ms ticks
- **Blitz:** 100ms ticks

## Key Insights

1. **Configuration Challenge:** All timing values are hardcoded throughout the system, making it impossible to easily adjust game speed or support different game modes.

2. **Testing Gap:** The existing tests don't catch timing configuration mismatches because they only test the engine in isolation with hardcoded expectations.

3. **Architecture Principle:** Timing should be a first-class configuration concern, not scattered magic numbers.

4. **Scope Complexity:** Multiple types of timing exist in the system - game logic timing, UI feedback timing, and user experience timing - each with different configuration requirements.

## Questions for Implementation

1. Should timing config be per-game or global server setting?
2. Do you want game speed selectable by players when creating games?
3. Should we validate that timing configs result in reasonable gameplay (e.g., prevent configs that make armies produce faster than generals)?
4. How should we handle fractional ticks when intervals don't divide evenly?

## Implementation Priority

**Critical (enables configurability):**
1. Create centralized timing config structure
2. Update engine.ts to use calculated intervals
3. Update tests to work with configurable timing

**Important (system integration):**
4. Thread config through all components (GameCoordinator, GameServer)
5. Add preset configurations for different game speeds
6. Update GameCoordinator to accept timing config

**Nice-to-have (polish):**
7. Add validation for reasonable timing configs
8. Add UI for game speed selection
9. Add timing config to game database schema

## Questions for Implementation Scope

### 1. CSS Animation Timing Scope
**Question:** Should CSS transition and animation durations be included in the timing configuration system?

**Context:** Files like `game-countdown.tsx` have CSS classes with hardcoded durations (1000ms, 300ms). These provide visual polish but are independent of game logic.

**Options:**
- A) Include CSS timing in config for complete consistency
- B) Keep CSS timing separate as pure UI concerns
- C) Create separate UI timing config distinct from game timing config

### 2. Matchmaking and Navigation Timing
**Question:** Should matchmaking UI timers and navigation delays be configurable or remain independent?

**Context:** 
- `join-game-page.tsx` has 1000ms waiting time counter updates
- `game-matchmaking-ws-handler.ts` has 1000ms navigation delay

**Options:**
- A) Include in timing config for consistency
- B) Keep independent since they're pure UX timing
- C) Make configurable but with separate category

### 3. Arrow Removal Timing Relationship
**Question:** How should the 500ms arrow removal delay relate to the configurable tick rate?

**Context:** Currently 500ms in `gameplay-store.ts`, which is 2x the current 250ms tick rate.

**Options:**
- A) Fixed ratio (e.g., always 2x tick rate)
- B) Fixed absolute value (always 500ms)
- C) Separately configurable with validation rules

### 4. Configuration Granularity
**Question:** Should timing config be per-game, global server setting, or both?

**Context:** Different game modes might want different speeds, but server performance may have limits.

**Options:**
- A) Global server config only
- B) Per-game config chosen at creation
- C) Both - server defines allowed configs, games choose from them

### 5. Fractional Tick Handling
**Question:** How should we handle cases where production intervals don't divide evenly into tick rates?

**Context:** If general production is 1000ms but tick rate is 333ms, we get 3.003 ticks per production.

**Options:**
- A) Round to nearest integer and accept slight timing variance
- B) Require tick rates that divide evenly into production intervals
- C) Use fractional accumulation system

### 6. Validation Rules
**Question:** What validation should prevent unreasonable timing configurations?

**Context:** Need to prevent configs that break gameplay (e.g., armies producing faster than generals).

**Considerations:**
- Minimum/maximum tick rates for performance
- Army vs. general production rate relationships
- UI timing vs. game timing relationships
- Client/server synchronization limits
