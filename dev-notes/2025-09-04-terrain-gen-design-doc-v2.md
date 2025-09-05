# Dynamic Terrain Generation with Connectivity Preservation

## Goal
Generate interesting 2D grid-based terrains by incrementally placing obstacles while maintaining global connectivity. The resulting grids should resemble abstract paths or mazes where all free cells remain reachable from each other, creating natural corridors and passages without isolated regions.

## Core Requirements

### Functional Requirements
- Always start with a completely empty grid (all cells free)
- Incrementally add obstacles until 20-40% of cells are blocked
- **Invariant**: All free cells must remain connected at all times
- Support grid sizes from 20×20 up to 100×100
- Reject obstacle placements that would partition the grid
- Uses 4-connectivity (matching game movement rules)
- Deterministic generation via seed (passed to candidate generator)

### Non-Functional Requirements
- Fast generation (< 100ms for 100×100 grids)
- Simple, maintainable implementation
- Predictable performance characteristics
- Easy to debug and visualize

## Explicit Scope Boundaries

This design focuses solely on **connectivity-preserving obstacle placement**. The following are explicitly OUT OF SCOPE:

- **Gameplay integration**: Spawn points, objectives, and game-specific constraints will be handled in separate passes after terrain generation
- **Terrain quality metrics**: Path diversity, passage width, dead-end prevention, and other gameplay quality concerns are deferred to future work
- **Pre-placed obstacles**: No support for starting with non-empty grids
- **Complex optimizations**: Backtracking, adaptive density adjustment, and other sophisticated failure recovery strategies are not included unless performance issues arise in practice
- **Navigation quality**: Minimum passage widths and movement comfort are not addressed in this phase

## Algorithm: BFS-Based Local Connectivity Validation

### Core Insight
When placing an obstacle, we only need to verify that its immediate neighbors remain connected to each other (local validation), not that every cell in the grid can reach every other cell (global pathfinding). If neighbors remain connected locally, the global connectivity is preserved.

### Why Local Validation Works
- We maintain "grid is always connected" as an invariant
- An obstacle can only break connectivity if it disconnects its immediate neighbors
- By validating that neighbors remain connected, we ensure global connectivity
- This reduces validation from O(n²) global check to O(k) local check where k << n²
- **Note**: This correctly handles articulation points - if a cell's removal would disconnect the grid, its neighbors cannot reach each other without going through it, so the local BFS will correctly reject the placement

### Validation Strategy

When considering obstacle at position (x,y):
1. Identify free neighbors (0-4 cells)
2. If ≤1 neighbor: Safe to add (can't disconnect anything)
3. If ≥2 neighbors: BFS from one neighbor avoiding (x,y) to verify all others reachable
4. Accept if connected, reject otherwise

**Key optimization**: BFS uses early termination - stops as soon as all target neighbors are found, typically exploring only 10-200 cells rather than the entire grid.

## Performance Profile

### Expected Performance by Fill Percentage
- **0-10% filled**: BFS explores ~10-30 cells, <0.01ms per obstacle
- **10-25% filled**: BFS explores ~30-100 cells, ~0.02ms per obstacle  
- **25-35% filled**: BFS explores ~50-200 cells, ~0.05ms per obstacle
- **35-40% filled**: BFS explores 100-500 cells, ~0.1ms per obstacle

### Total Generation Time
- **100×100 grid** (30% fill): ~50-150ms
- **50×50 grid** (30% fill): ~10-20ms
- **20×20 grid** (30% fill): ~1-2ms

*Performance Note*: The 50-200 cell estimate for typical BFS exploration is theoretical. In practice, instrument the BFS to track actual cells explored and consider optimizations if the average significantly exceeds expectations.

## Architecture: Separation of Concerns

The connectivity validation algorithm is **completely agnostic** to how obstacle candidates are chosen. This clean separation allows for flexible and extensible terrain generation.

### Interface Contract
```
CandidateGenerator -> (x, y) coordinate
ConnectivityValidator -> boolean (accept/reject)
GridManager -> updates state if accepted
```

**Determinism Note**: The generation loop itself contains no randomness. All non-determinism comes from the candidate generator, which should accept a seed for reproducible generation.

### Benefits of Decoupling
1. **Modularity**: Swap generation strategies without touching validation code
2. **Experimentation**: Test different patterns while maintaining connectivity guarantee
3. **Composability**: Combine multiple generation strategies in same map
4. **Testing**: Test validation and generation independently
5. **Evolution**: Improve generation strategies over time without risking connectivity bugs

### Example Generation Strategies (Pluggable)
- **Random**: Uniform distribution across grid
- **Perlin Noise**: Natural-looking clustered obstacles
- **Cellular Automata**: Cave-like organic patterns
- **Room & Corridor**: Dungeon-style layouts
- **Weighted**: Bias toward edges, corners, or existing obstacles
- **Progressive**: Different strategies for different fill percentages

---

# Implementation Plan

## Phase 1: Core Data Structures

### 1.1 Grid Representation
```
- 2D array of cell states (FREE, OBSTACLE)
- Coordinate system (x, y) with bounds checking
- Neighbor enumeration helper (up, down, left, right)
```

## Phase 2: BFS Validation

### 2.1 BFS Implementation
```
- Standard queue-based BFS
- Visited array
- Takes: start cell, target cells, avoided cell
- Returns: boolean (all targets reachable)
- Early termination when all targets found
```

### 2.2 Connectivity Validator
```
Function: canPlaceObstacle(x, y)
- Get free neighbors of (x,y)
- Handle trivial cases (≤1 neighbor)
- Run BFS validation for multiple neighbors
- Return true/false
```

## Phase 3: Terrain Generation

### 3.1 Core Generation Loop
```
Function: generateTerrain(width, height, obstacle_percentage, candidate_generator)
- Initialize empty grid
- Calculate target obstacle count
- Define MAX_TOTAL_FAILURES (e.g., 1000 consecutive rejections)
- While obstacles_placed < target:
    - candidate = candidate_generator.next()
    - If canPlaceObstacle(candidate.x, candidate.y):
        - Place obstacle
    - If MAX_TOTAL_FAILURES reached:
        - Accept current density even if below target
- Return grid
```

### 3.2 Candidate Generator Interface
```
Interface: CandidateGenerator
- constructor(seed): Initialize with seed for deterministic generation
- next(): returns (x, y) coordinate
- reset(): reset internal state if needed
- configure(params): adjust generation parameters

Note: Generator doesn't need to check if cell is free.
If occupied, validation will reject and request another candidate.
Generator should handle its own RNG/determinism via the seed.
```

## Phase 4: Optional Optimizations (Only If Performance Issues Arise)

**Note**: These optimizations are NOT expected to be needed for target grid sizes and densities. Only implement if profiling reveals performance problems.

### 4.1 Early Rejection
If BFS explores more than a threshold (e.g., 500-1000 cells) without finding all neighbors, assume the placement would disconnect the grid and reject early. This prevents pathological cases with very long corridors from consuming excessive time.

### 4.2 Additional Optimizations (If Needed)
- Bidirectional BFS: Search from multiple neighbors simultaneously
- Adaptive strategies: Change generation approach as density increases
- Cache recent BFS paths (though cache invalidation adds complexity)

**Explicitly Out of Scope**: Complex failure recovery like backtracking or adaptive density adjustment. The simple MAX_TOTAL_FAILURES approach should suffice for the prototype.

## Phase 5: Testing & Debugging

### 5.1 Validation Tests
```
- Verify connectivity after generation (full BFS/DFS check)
- Test edge cases: corners, borders, single passages
- Verify obstacle percentage achieved
- Test various grid sizes
- Test deterministic generation (same seed → same output)
```

### 5.2 Visualization
```
- ASCII art renderer for debugging
- Show obstacles as '#', free as '.'
- Optional: Show BFS exploration count heat map
```

## Success Metrics

- ✓ Generates connected terrains reliably
- ✓ 100×100 grids generate in <100ms  
- ✓ Achieves target obstacle density (or accepts lower density if generation becomes difficult)
- ✓ Code is <200 lines for core algorithm
- ✓ No isolated regions ever created
- ✓ Easy to add new generation strategies
- ✓ Clear separation between generation and validation
- ✓ Deterministic generation with same seed

## Summary

This design provides a robust, extensible foundation for terrain generation that:
1. **Guarantees** connectivity through local BFS validation
2. **Allows** creative freedom through pluggable generators
3. **Performs** well for target grid sizes (50-150ms for 100×100)
4. **Remains** simple to understand and maintain
5. **Focuses** solely on connectivity-preserving obstacle placement

The key insight is using local validation to maintain global connectivity, combined with separation between the creative aspect (choosing where to place obstacles) and the correctness aspect (ensuring connectivity). This allows both to evolve independently while maintaining system invariants.

Gameplay considerations, terrain quality metrics, and sophisticated optimizations are intentionally deferred, allowing this core system to be implemented, tested, and validated before adding additional complexity.
