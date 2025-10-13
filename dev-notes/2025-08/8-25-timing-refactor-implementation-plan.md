# 2025-08-25: Timing Refactor Implementation Plan

## Discussion Summary

After reviewing the timing configuration problem, we discussed key architectural decisions and settled on a pragmatic approach that prioritizes immediate cleanup while preserving future flexibility.

## Key Decisions Made

### 1. Fractional Tick Handling
**Decision**: Restrict to only tick rates that evenly divide with important production timers
- **Rationale**: Avoids timing drift and keeps math simple
- **Implementation**: Add validation checks that throw clear errors for invalid configurations
- **Tradeoff**: Reduces configuration flexibility but ensures predictable timing behavior

### 2. Configuration Scope Strategy
**Decision**: Focus on centralized hardcoded configs in core module, defer per-game configuration
- **Rationale**: Gets 80-90% of cleanup benefits without architectural complexity
- **Future Path**: Make small design choices that don't block future per-game configs
- **Tradeoff**: Less ambitious scope but much cleaner, safer implementation

### 3. Config File Separation
**Decision**: Split fundamental game timing from UI/visual timing
- `core/src/game-timing-config.ts` - tick rates, production intervals
- `core/src/ui-timing-config.ts` - arrow delays, CSS transitions, navigation delays
- **Rationale**: Different change frequencies and concerns
- **Tradeoff**: More files but better separation of concerns

### 4. Testing Strategy
**Decision**: Keep tests lightweight, have tests define own config values
- **Approach**: Tests calculate expected behavior from config rather than hardcoding tick counts
- **Focus**: Only test super core logic / high-value scenarios
- **Tradeoff**: Less comprehensive test coverage but faster implementation

### 5. GameConfig Integration Consideration
**Initial Consideration**: Add game-level config support from hardcoded values
**Final Decision**: Defer to later pass to avoid scope creep
- **Concern**: Backend object lifecycle management is messy, don't want massive refactor
- **Compromise**: Quick check for easy wins but don't get sidetracked
- **Tradeoff**: Misses opportunity for cleaner architecture but avoids complexity spiral

## Implementation Plan

### Phase 1: Core Config Creation
1. **Create `core/src/game-timing-config.ts`**
   - `TICK_RATE_MS = 250`
   - `GENERAL_PRODUCTION_INTERVAL_MS = 1000` 
   - `ARMY_PRODUCTION_INTERVAL_MS = 25000`
   
2. **Create `core/src/ui-timing-config.ts`**
   - `ARROW_REMOVAL_DELAY_MS = 500`
   - `GAME_START_COUNTDOWN_INTERVAL_MS = 1000`
   - `NAVIGATION_DELAY_MS = 1000`
   - `FALLBACK_TIMER_MS = 10000`

3. **Add Config Validation**
   - Verify `GENERAL_PRODUCTION_INTERVAL_MS % TICK_RATE_MS === 0`
   - Verify `ARMY_PRODUCTION_INTERVAL_MS % TICK_RATE_MS === 0` 
   - Throw descriptive errors for invalid configs

### Phase 2: System-wide Replacement
4. **Update `core/src/engine.ts`**
   - Calculate `generalProductionTicks = GENERAL_PRODUCTION_INTERVAL_MS / TICK_RATE_MS`
   - Calculate `armyProductionTicks = ARMY_PRODUCTION_INTERVAL_MS / TICK_RATE_MS`
   - Replace hardcoded `4` and `100` with calculated values

5. **Update Backend Components**
   - `backend/src/gameplay/game-coordinator.ts`: Import `TICK_RATE_MS`
   - `backend/src/gameplay/game-server.ts`: Import timing values for fallback/countdown

6. **Update Frontend Components**
   - `frontend/src/game-ui/store/gameplay-store.ts`: Import arrow delay
   - `frontend/src/pages/join-game/*`: Import UI timing values
   - `frontend/src/components/game-countdown.tsx`: Consider CSS timing inclusion

7. **Update Core Tests**
   - Calculate expected tick counts from config values
   - Keep test scope minimal and focused on core logic

### Phase 3: Verification & Future Check
8. **Build and Test Verification**
   - Run `bash tools/build-all.sh`
   - Run `bash tools/test-all.sh`
   - Fix any type errors or test failures

9. **Quick GameConfig Integration Check**
   - Survey backend object creation patterns
   - Identify easy opportunities for future game-level config
   - Document findings but don't implement unless trivial

## Key Tradeoffs & Considerations

### Scope vs. Completeness
- **Chosen**: Focused cleanup over comprehensive architecture
- **Benefit**: Lower risk, faster delivery, immediate magic number elimination
- **Cost**: Will need another pass for per-game configuration

### Configuration Granularity
- **Chosen**: Hardcoded configs over dependency injection
- **Benefit**: Simple implementation, no backend lifecycle concerns
- **Cost**: Less flexible, requires code changes for timing adjustments

### Timing Precision vs. Flexibility
- **Chosen**: Evenly divisible intervals only
- **Benefit**: No timing drift, predictable behavior
- **Cost**: Constrains valid configuration combinations

### Test Coverage vs. Speed
- **Chosen**: Lightweight tests over comprehensive coverage
- **Benefit**: Faster implementation, focuses on core value
- **Cost**: May miss edge cases in timing interactions

## Success Criteria

1. **All magic numbers eliminated**: No hardcoded timing values outside config files
2. **System functionality preserved**: Game behaves identically to current timing
3. **Clean build and tests**: No type errors, core tests pass
4. **Future flexibility maintained**: Architecture choices don't block per-game configs
5. **Clear documentation**: Next developer can easily understand and modify timing

## Risk Mitigation

- **Scope creep**: Resist urge to implement per-game configs in this pass
- **Test breakage**: Start with engine tests, verify behavior before broader changes  
- **Timing bugs**: Validate configs mathematically before runtime
- **Backend complexity**: Keep hardcoded approach, don't thread dependency injection yet