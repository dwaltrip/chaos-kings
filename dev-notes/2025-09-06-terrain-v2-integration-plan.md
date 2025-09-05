# Terrain Generation V2 Integration Plan

## Overview

This document outlines the plan to integrate the new v2 terrain generation system with the existing backend game creation pipeline. The goal is to preserve the intelligent mountain clustering behavior from the old `mountainOrBlank` function while leveraging the v2 system's improved connectivity validation and architecture.

## Current State Analysis

### Old System (`core/src/map/generate-grid.ts`)
- **Key Functions**: `mountainOrBlank()` and `generateRandomMountains()` 
- **Smart Logic**: Neighbor-aware probability mapping based on nearby mountain count
- **Data Types**: Works with `GameGrid` and `SquareType.MOUNTAIN`
- **Neighbor Detection**: Uses 8-directional neighbor scanning
- **Probability Map**:
  - Default: 10% chance for mountains
  - 1-2 nearby mountains: 35% chance (clustering effect)
  - 3+ nearby mountains: 5% chance (prevents over-clustering)

### New V2 System (`core/src/terrain-generation/`)
- **Architecture**: Clean separation with `CandidateGenerator` interface pattern
- **Data Types**: Uses `Grid` class with `CellState.OBSTACLE/FREE`
- **Features**: Connectivity validation, seeded RNG, performance optimized
- **Current Generator**: Basic `RandomCandidateGenerator` (no clustering logic)
- **Neighbor Detection**: 4-directional (orthogonal only)

### Backend Integration Point (`backend/src/game/actions/create-game.ts`)
- **Current Usage**: `generateRandomMapWithConstraints(size, numPlayers, minGeneralDistance)`
- **Expected Output**: `{ grid: GameGrid, generals: PlayerSquare[] }`
- **Data Flow**: `GameGrid` → `GameConfig.startingGrid` → Database storage

## Integration Implementation Plan

### Phase 1: Mountain Candidate Generator

**File**: `core/src/terrain-generation/mountain-candidate-generator.ts`

```typescript
export class MountainCandidateGenerator implements CandidateGenerator {
  private rng: SeededRNG;
  private gridWidth: number;
  private gridHeight: number;
  private probabilityMap: Map<number, number>;
  
  constructor(seed: number, width: number, height: number, options?: MountainGenerationOptions)
  
  next(grid: Grid): Coord {
    // Port the mountainOrBlank logic:
    // 1. Generate random coordinate
    // 2. Count nearby obstacles using 8-directional neighbors
    // 3. Apply probability mapping based on neighbor count
    // 4. Return coordinate if mountain should be placed
  }
}
```

**Key Implementation Details**:
- **8-Directional Neighbors**: Add `getEightDirectionalNeighbors()` helper method
- **Probability Configuration**: Make probability mappings configurable via options
- **Seeded RNG**: Ensure deterministic generation using existing `SeededRNG` class
- **Grid Compatibility**: Translate between `CellState.OBSTACLE` and mountain concept

### Phase 2: Terrain-to-GameGrid Converter

**File**: `core/src/terrain-generation/game-grid-converter.ts`

```typescript
export interface ConversionResult {
  grid: GameGrid;
  size: Size2d;
}

export function convertToGameGrid(
  terrainGrid: Grid, 
  generals?: PlayerSquare[]
): ConversionResult {
  // Convert Grid + CellState → GameGrid + SquareType
  // Place generals on the converted grid
  // Ensure all coordinates are properly mapped
}
```

**Conversion Logic**:
- `CellState.FREE` → `{ type: SquareType.BLANK, coord: {x, y} }`
- `CellState.OBSTACLE` → `{ type: SquareType.MOUNTAIN, coord: {x, y} }`
- Overlay generals on appropriate blank squares
- Validate grid dimensions match expected `Size2d`

### Phase 3: Game Map Generator (Backend-Compatible)

**File**: `core/src/terrain-generation/game-map-generator.ts`

```typescript
export interface GameMapResult {
  grid: GameGrid;
  generals: PlayerSquare[];
}

export function generateGameMapV2(
  size: Size2d,
  numPlayers: number,
  minGeneralDistance: number,
  seed?: number,
  options?: GameMapGenerationOptions
): GameMapResult {
  // 1. Generate terrain using v2 system + MountainCandidateGenerator
  // 2. Place generals with distance constraints (port existing logic)
  // 3. Convert result to GameGrid format
  // 4. Validate connectivity
  // 5. Apply repair logic if needed
}
```

**General Placement Strategy**:
- **Reuse Existing Logic**: Port `addGeneralsWithDistanceConstraint` from old system
- **Connectivity Validation**: Leverage v2's `ConnectivityValidator`
- **Repair Mechanism**: Port `repairConnectivity` to work with v2 grid format
- **Failure Handling**: Maintain existing retry logic and error messages

### Phase 4: Backend Integration

**File**: `backend/src/game/actions/create-game.ts`

**Changes**:
```typescript
// OLD:
import { generateRandomMapWithConstraints } from '@core/map/generate-grid';

// NEW:  
import { generateGameMapV2 } from '@core/terrain-generation/game-map-generator';

// Usage remains identical:
const { grid, generals } = generateGameMapV2(
  DEFAULT_GAME_GENERATION_CONFIG.mapSize,
  playerCount,
  DEFAULT_GAME_GENERATION_CONFIG.minGeneralDistance,
  Date.now() // or configurable seed
);
```

**Benefits**:
- **Zero API Changes**: Backend code requires minimal modifications
- **Backward Compatibility**: Existing tests should pass without changes
- **Improved Quality**: Better terrain generation with maintained connectivity

### Phase 5: Export Integration & Testing

**File**: `core/src/terrain-generation/index.ts`

**Additions**:
```typescript
export { MountainCandidateGenerator } from './mountain-candidate-generator';
export { convertToGameGrid } from './game-grid-converter';
export { generateGameMapV2 } from './game-map-generator';
export type { GameMapResult, ConversionResult } from './game-map-generator';
```

**Testing Strategy**:
1. **Unit Tests**: Test each component in isolation
2. **Integration Tests**: Verify v2 output matches old system behavior
3. **Regression Tests**: Ensure backend tests continue passing
4. **Performance Tests**: Validate generation speed is acceptable
5. **Deterministic Tests**: Verify same seed produces identical results

## Technical Considerations

### Neighbor Detection Compatibility
- **Challenge**: Old system uses 8-directional, v2 uses 4-directional
- **Solution**: Add `getEightDirectionalNeighbors()` method to `MountainCandidateGenerator`
- **Impact**: Maintains exact clustering behavior from original `mountainOrBlank`

### Probability Mapping Preservation
- **Current Mapping**: `{ 0: 0.1, 1: 0.35, 2: 0.35, 3: 0.05, 4+: 0.1 }`
- **Configuration**: Make mappings configurable via options object
- **Default Behavior**: Match existing probabilities exactly

### Connectivity Validation Enhancement
- **V2 Advantage**: More robust connectivity checking
- **Integration**: Use v2 validation during terrain generation
- **Fallback**: Maintain repair logic for edge cases

### Performance Considerations
- **Grid Conversion**: Minimize memory allocations during conversion
- **General Placement**: Optimize distance constraint checking
- **Caching**: Consider caching neighbor calculations for large grids

## Migration Strategy

### Phase 1: Development & Testing
1. Implement `MountainCandidateGenerator` with comprehensive tests
2. Create conversion utilities and validate output format
3. Build `generateGameMapV2` with feature parity testing

### Phase 2: Integration Testing  
1. Replace backend integration and run full test suite
2. Performance benchmark against old system
3. Visual validation of generated terrain quality

### Phase 3: Deployment & Cleanup
1. Deploy with feature flag for safe rollback
2. Monitor game creation performance and quality
3. Remove old map generation code after validation period

## Success Criteria

- ✅ **Functional Parity**: Generated maps indistinguishable from old system
- ✅ **Performance**: Generation time ≤ old system performance  
- ✅ **Connectivity**: 100% of generated maps maintain connectivity
- ✅ **Deterministic**: Same seed produces identical results
- ✅ **Backend Compatibility**: Zero changes required to existing game creation API
- ✅ **Test Coverage**: All existing backend tests pass without modification

## Future Enhancements

Once integration is complete, the v2 system enables:
- **Multiple Terrain Types**: Easy addition of forests, cities, etc.
- **Biome Generation**: Region-based terrain patterns  
- **Advanced Clustering**: More sophisticated obstacle placement algorithms
- **Performance Optimization**: Parallel generation for large maps
- **Procedural Variety**: Template-based map generation patterns