# Terrain Generation v2 - Detailed Implementation Plan

*Generated: 2025-09-05*
*Based on: 2025-09-04-terrain-gen-design-doc-v2.md*

## Overview

This document provides a detailed implementation plan for the terrain generation v2 system. The architecture emphasizes simplicity, clean separation of concerns, and the core algorithmic insight of using local BFS validation to maintain global connectivity.

## Key Architectural Decisions

### Data Structures
- **Cell Representation**: `CellState` enum (FREE, OBSTACLE) for future extensibility
- **Coordinates**: Simple `Coord` interface `{ x: number, y: number }`
- **Grid Storage**: 2D array `cells[y][x]` for simplicity and debugging ease
- **BFS Visited**: Fresh `Set<string>` per validation using "x,y" coordinate keys

### Component Ownership
- **Grid Lifecycle**: `TerrainGenerator` owns and creates `Grid` instances
- **Validation**: Stateless validators receive grid as parameter
- **Generation**: `CandidateGenerator.next(grid: Grid): Coord` for grid awareness

### Error Handling Strategy
- **Bounds Checking**: Defensive - `grid.getNeighbors()` only returns valid coordinates
- **Generation Failures**: Partial results on MAX_TOTAL_FAILURES with optional warnings
- **Parameter Validation**: Upfront validation with MAX_DENSITY = 50% limit

## Implementation Phases

## Phase 1: Foundation (Core Data Structures)

### Files to Create
- `core/terrain-generation/types.ts`
- `core/terrain-generation/grid.ts`

### 1.1 Core Types & Constants

```typescript
// constants.ts
export const MAX_DENSITY = 0.5;
export const MAX_TOTAL_FAILURES = 1000;
export const MIN_GRID_SIZE = 5;
export const MAX_GRID_SIZE = 1000;

// types.ts
export enum CellState {
  FREE = 0,
  OBSTACLE = 1
}

export interface Coord {
  x: number;
  y: number;
}

export interface GridDimensions {
  width: number;
  height: number;
}
```

### 1.2 Grid Class Implementation

```typescript
// grid.ts
export class Grid {
  private cells: CellState[][];  // Indexed as cells[y][x] for row-major order
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    // Validate dimensions
    // Initialize empty grid (all FREE)
    // Store dimensions
  }

  // Core accessors
  isValidCoord(pos: Coord): boolean
  getCell(pos: Coord): CellState {
    // Internal indexing: cells[y][x] where y=row, x=column
    return this.cells[pos.y][pos.x];
  }
  setCell(pos: Coord, state: CellState): void {
    // Internal indexing: cells[y][x] where y=row, x=column
    this.cells[pos.y][pos.x] = state;
  }
  
  // Neighbor operations - only accepts valid coord
  getNeighbors(pos: Coord): Coord[]
  getFreeNeighbors(pos: Coord): Coord[]
  
  // Grid utilities
  getDimensions(): GridDimensions
  isEmpty(): boolean
  getObstacleCount(): number
  getObstacleDensity(): number
}

// Coordinate helper functions
export const coordToString = (c: Coord): string => `${c.x},${c.y}`;
export const stringToCoord = (s: string): Coord => {
  const [x, y] = s.split(',').map(Number);
  return { x, y };
};
```

**Key Implementation Notes:**
- Constructor validates dimensions against MIN/MAX_GRID_SIZE
- `getNeighbors()` assumes valid input coord (caller responsibility)
- 4-connectivity: up, down, left, right only
- All state modification goes through `setCell()` for consistency

## Phase 2: BFS Validation

### Files to Create
- `core/terrain-generation/bfs-validator.ts`
- `core/terrain-generation/connectivity-validator.ts`

### 2.1 BFS Implementation

```typescript
// bfs-validator.ts
export class BFSValidator {
  /**
   * Finds which target coordinates are reachable from start,
   * avoiding a specific coordinate.
   * Uses early termination - stops when all targets found.
   */
  findReachableTargets(
    grid: Grid, 
    start: Coord, 
    targets: Coord[], 
    avoid: Coord
  ): Set<string> {
    // Fresh Set<string> for visited using "x,y" keys
    // Queue-based BFS with early termination
    // Return set of reachable target coord strings
  }
}
```

**Key Implementation Notes:**
- Fresh `Set<string>` using `${x},${y}` keys per call
- Early termination when `reachableTargets.size === targets.length`
- Avoid coordinate treated as obstacle during traversal
- Returns coord strings for easy comparison with target set

### 2.2 Connectivity Validator

```typescript
// connectivity-validator.ts
export class ConnectivityValidator {
  private bfsValidator: BFSValidator;

  constructor() {
    this.bfsValidator = new BFSValidator();
  }

  /**
   * Determines if placing an obstacle at pos would maintain connectivity.
   * Uses local validation - checks if neighbors remain connected to each other.
   */
  canPlaceObstacle(grid: Grid, pos: Coord): boolean {
    // Get free neighbors of pos
    // Handle trivial cases: ≤1 neighbor = always safe
    // For ≥2 neighbors: use BFS to verify connectivity
    // Return true if all neighbors reachable from first neighbor
  }
}
```

**Algorithm Steps:**
1. `const freeNeighbors = grid.getFreeNeighbors(pos)`
2. If `freeNeighbors.length ≤ 1`: return `true` (safe)
3. Use BFS from `freeNeighbors[0]` to find remaining neighbors
4. Return `reachableCount === freeNeighbors.length - 1`

## Phase 3: Generation Engine

### Files to Create
- `core/terrain-generation/candidate-generator.ts`
- `core/terrain-generation/terrain-generator.ts`

### 3.1 CandidateGenerator Interface & Random Implementation

```typescript
// candidate-generator.ts
export interface CandidateGenerator {
  next(grid: Grid): Coord;
}

export class RandomCandidateGenerator implements CandidateGenerator {
  private rng: () => number; // Seeded RNG function
  private gridWidth: number;
  private gridHeight: number;

  constructor(seed: number, width: number, height: number) {
    // Initialize seeded RNG (use simple LCG or better)
    // Store grid dimensions for coordinate generation
  }

  next(grid: Grid): Coord {
    // Generate random x,y within grid bounds
    // Return coordinate (doesn't check if cell is free)
  }
}
```

**Seeded RNG Note:** Use a simple Linear Congruential Generator or similar for deterministic generation. The RNG implementation should be internal to maintain reproducibility.

### 3.2 TerrainGenerator Main Class

```typescript
// terrain-generator.ts
export interface GenerationOptions {
  warnOnFailure?: boolean; // Default: true
}

export interface GenerationResult {
  grid: Grid;
  actualDensity: number;
  targetDensity: number;
  obstaclesPlaced: number;
  attemptsReached: boolean; // True if MAX_TOTAL_FAILURES hit
}

export class TerrainGenerator {
  private connectivityValidator: ConnectivityValidator;

  constructor() {
    this.connectivityValidator = new ConnectivityValidator();
  }

  generateTerrain(
    width: number,
    height: number,
    targetDensity: number,
    candidateGenerator: CandidateGenerator,
    options: GenerationOptions = {}
  ): GenerationResult {
    // Validate parameters (dimensions, density ≤ MAX_DENSITY)
    // Create empty grid
    // Calculate target obstacle count
    // Main generation loop with failure tracking
    // Return detailed result object
  }
}
```

**Generation Loop Algorithm:**
1. Validate all parameters upfront
2. Create empty `Grid(width, height)`
3. `targetObstacles = Math.floor(width * height * targetDensity)`
4. Loop: `obstaclesPlaced < targetObstacles && failures < MAX_TOTAL_FAILURES`
5. Get candidate from generator, validate with connectivity checker
6. Place if valid, increment failure counter if rejected
7. Return detailed result with actual density achieved

## Phase 4: Integration & Validation

### Files to Create
- `core/terrain-generation/index.ts`

### 4.1 Public API Design

```typescript
// index.ts
export { CellState, Coord, GridDimensions } from './types';
export { Grid } from './grid';
export { CandidateGenerator, RandomCandidateGenerator } from './candidate-generator';
export { TerrainGenerator, GenerationOptions, GenerationResult } from './terrain-generator';

// Convenience factory function
export function generateRandomTerrain(
  width: number, 
  height: number, 
  density: number, 
  seed: number
): GenerationResult {
  const generator = new TerrainGenerator();
  const candidateGenerator = new RandomCandidateGenerator(seed, width, height);
  return generator.generateTerrain(width, height, density, candidateGenerator);
}
```

### 4.2 Architecture Validation Tasks

**During this phase, verify:**
- CandidateGenerator interface works cleanly with different implementations
- TerrainGenerator is completely agnostic to generation strategy
- ConnectivityValidator correctly maintains grid connectivity invariant
- Clean separation: validation logic never touches generation logic
- Parameters flow correctly through all components

**Integration Testing:**
- Generate 20x20, 50x50, 100x100 grids with various densities
- Verify deterministic generation (same seed = identical results)  
- Test edge cases: very low density (5%), moderate (25%), high (40%)
- Validate performance targets: 100x100 grid in <100ms

## Phase 5: Testing & Debugging (Minimal)

### Files to Create
- `core/terrain-generation/__tests__/grid.test.ts`
- `core/terrain-generation/__tests__/connectivity-validator.test.ts`
- `core/terrain-generation/__tests__/terrain-generator.test.ts`
- `core/terrain-generation/debug-utils.ts`

### 5.1 Core Test Coverage

**Grid Tests:**
- Constructor validation (invalid dimensions)
- Coordinate validation and bounds checking
- Neighbor enumeration correctness
- Cell state management

**Connectivity Tests:**
- BFS validator finds all reachable targets
- Connectivity validator handles trivial cases
- Full obstacle placement validation
- Edge cases: corners, borders, single-cell passages

**Generation Tests:**
- Deterministic generation with same seed
- Parameter validation and error handling
- MAX_TOTAL_FAILURES behavior
- Partial generation results

**Integration Tests:**
- Full connectivity verification after generation
- Performance benchmarking on target grid sizes
- Multiple generation strategies produce valid results

### 5.1a Key Test Cases to Write First

**Critical Connectivity Validator Tests to implement before the validator itself:**

```typescript
// connectivity-validator.test.ts - Write these first!

describe('ConnectivityValidator - Edge Cases', () => {
  test('allows obstacle in corner with one neighbor', () => {
    // 3x3 grid, try to place in corner (0,0)
    // Should always allow (only 1 neighbor)
  });

  test('prevents breaking a single corridor', () => {
    // Create grid with narrow passage:
    // . # .
    // . . .  <- Try to block middle cell
    // . # .
    // Should reject (would disconnect grid)
  });

  test('detects articulation point correctly', () => {
    // Create grid where one cell connects two regions:
    // . . . # #
    // # # . # #  <- Cell at (2,1) is articulation point
    // # # . . .
    // Should reject placing obstacle at (2,1)
  });

  test('allows obstacle that doesn\'t break connectivity', () => {
    // Create grid with multiple paths:
    // . . .
    // . . .  <- Try to block (1,1)
    // . . .
    // Should allow (many alternate paths exist)
  });

  test('handles edge placement correctly', () => {
    // Test placing obstacles along grid edges
    // Should allow if doesn't disconnect corners
  });

  test('handles single-cell dead end creation', () => {
    // . . .
    // . # .  <- After placing this
    // . . .
    // Cell (1,0) becomes dead-end but still connected
    // Should allow (connectivity maintained)
  });
});

describe('BFS Validator - Core Behavior', () => {
  test('finds all reachable targets with early termination', () => {
    // Verify stops searching once all targets found
    // Can track cells explored to confirm early termination
  });

  test('correctly avoids specified cell', () => {
    // Verify BFS treats 'avoid' coordinate as obstacle
  });

  test('handles no path between neighbors', () => {
    // Create scenario where neighbors can\'t reach each other
    // Should return incomplete set
  });
});
```

### 5.2 Simple Debug Tools

```typescript
// debug-utils.ts
export class DebugRenderer {
  static renderGrid(grid: Grid): string {
    // ASCII representation: '#' = obstacle, '.' = free
    // Include coordinate labels for debugging
  }

  static verifyConnectivity(grid: Grid): boolean {
    // Full BFS/DFS connectivity check for validation
    // Use after generation to verify algorithm correctness
  }
}

export class PerformanceProfiler {
  static timeGeneration(generationFn: () => GenerationResult): {
    result: GenerationResult;
    timeMs: number;
  } {
    // Simple timing wrapper for performance validation
  }
}
```

## Success Criteria

### Functional Requirements
- ✅ **Connectivity Guarantee**: All generated grids maintain full connectivity
- ✅ **Deterministic Generation**: Same seed produces identical results
- ✅ **Parameter Validation**: Graceful handling of invalid inputs
- ✅ **Density Achievement**: Reaches target density or fails gracefully
- ✅ **Edge Case Handling**: Works correctly for corners, borders, small grids

### Performance Requirements  
- ✅ **100×100 Grid Generation**: Completes in <100ms
- ✅ **50×50 Grid Generation**: Completes in <20ms  
- ✅ **Memory Efficiency**: No excessive allocations during generation
- ✅ **BFS Efficiency**: Early termination reduces search space effectively

### Architecture Requirements
- ✅ **Clean Separation**: Generation and validation are completely decoupled
- ✅ **Pluggable Interface**: Easy to add new CandidateGenerator implementations
- ✅ **Simple Codebase**: Core algorithm under 200 lines
- ✅ **Maintainable Code**: Clear interfaces, good error messages, debuggable

### API Requirements
- ✅ **Simple Usage**: Common case requires minimal setup
- ✅ **Flexible Options**: Advanced users can configure all aspects
- ✅ **Clear Results**: Generation results include metadata and diagnostics
- ✅ **Good Defaults**: Sensible parameter defaults for typical usage

## Implementation Notes

### Seeded Random Number Generation
Use a simple but reliable seeded RNG for deterministic generation:

```typescript
class SeededRNG {
  private seed: number;
  
  constructor(seed: number) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }
  
  next(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646; // [0, 1)
  }
}
```

### BFS Coordinate Key Strategy
Using string keys `"x,y"` for the visited set provides:
- Simple implementation and debugging
- Clear separation from any internal indexing
- Easy visual verification of algorithm behavior

### Parameter Validation Strategy
Validate all parameters at the public API boundary:
- Grid dimensions: MIN_GRID_SIZE ≤ size ≤ MAX_GRID_SIZE
- Target density: 0 < density ≤ MAX_DENSITY
- Seed: any valid number (handle NaN, undefined)

### Performance Monitoring
Track key metrics during development:
- Average BFS cells explored per validation
- Success/failure ratio at different densities
- Generation time vs grid size scaling
- Memory allocation patterns

## Future Extension Points

### Additional Generator Strategies (Post-v1)
- **PerlinNoiseCandidateGenerator**: Natural-looking clustered obstacles
- **WeightedCandidateGenerator**: Bias toward edges or existing obstacles
- **CellularAutomataCandidateGenerator**: Cave-like organic patterns

### Advanced Features (Out of Scope)
- Multi-threading support for large grids
- Progressive density strategies (start sparse, increase complexity)
- Terrain quality metrics (passage width, dead-end analysis)
- Integration with game-specific constraints

### Optimization Opportunities (If Needed)
- Bidirectional BFS for very large connected components
- Spatial data structures for faster neighbor queries
- Adaptive failure thresholds based on current grid state

---

This implementation plan provides a clear roadmap for building the terrain generation v2 system with strong architectural foundations and room for future enhancement.
