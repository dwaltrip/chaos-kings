# Map Generation Connectivity Analysis

## Problem Statement

Current map generation places mountains randomly with clustering, then places generals randomly on blank squares. This can trap generals in isolated regions surrounded by mountains, making them unreachable by other players.

## Game Parameters (for performance analysis)
- Map sizes: 20x20 to 50x50 (400-2500 tiles)
- Players: 2-30
- Mountain density: ~10-30% of tiles
- Generation frequency: Once per game start

## Approach 1: Post-Generation Validation + Repair

### Algorithm
1. Generate map normally (mountains + generals)
2. Use BFS to test if all generals can reach each other
3. If disconnected, identify and remove strategic mountains to create connectivity
4. Repeat until all generals are connected

### Performance Analysis
- **Time Complexity:** O(W×H × k) where k = repair iterations (typically 1-5)
- **Space Complexity:** O(W×H) for BFS visited arrays
- **Best case:** O(W×H) - map already connected
- **Worst case:** O(W×H × mountain_count) - but use smart heuristics to avoid this

### Key Optimizations
- **Early BFS termination:** Stop when all generals found, not when entire map traversed
- **Smart barrier removal:** Remove mountains that connect the most isolated components
- **Batch connectivity testing:** Remove multiple strategic mountains at once using binary search
- **Connectivity caching:** Cache results for similar grid configurations

### Pseudo-code
```
function ensureConnectivity(grid, generals):
  while not areAllGeneralsConnected(grid, generals):
    barriers = findCriticalBarriers(grid, generals)
    removeOptimalBarrier(grid, barriers)
    
function areAllGeneralsConnected(grid, generals):
  visited = new Set()
  queue = [generals[0]]
  foundCount = 1
  
  while queue.notEmpty() and foundCount < generals.length:
    current = queue.dequeue()
    for neighbor in getTraversableNeighbors(grid, current):
      if not visited.has(neighbor):
        visited.add(neighbor)
        if isGeneral(neighbor): foundCount++
        queue.enqueue(neighbor)
  
  return foundCount == generals.length
```

### Pros/Cons
- **Pros:** Simple implementation, preserves existing generation logic, maintains randomness
- **Cons:** May create unnatural corridors, requires multiple connectivity tests

## Approach 3: Constraint-Based Mountain Placement

### Algorithm
1. Place generals first with good spatial distribution
2. For each potential mountain placement, run connectivity check
3. Only place mountain if it doesn't isolate any general
4. Use flood-fill or BFS for connectivity testing

### Performance Analysis
- **Time Complexity:** O(W×H × mountain_count × connectivity_check_cost)
- **Space Complexity:** O(W×H) per connectivity test
- **Critical insight:** Raw approach is O((W×H)²) - too expensive for large maps

### Key Optimizations
- **Union-Find data structure:** Reduce connectivity checks from O(W×H) to O(α(n)) amortized
- **Smart placement order:** Place mountains far from generals first (safer), near connections last
- **Incremental connectivity tracking:** Maintain connectivity state as mountains are added
- **Distance-based filtering:** Only test connectivity for mountains within critical distance of generals

### Pseudo-code
```
function constrainedMountainPlacement(grid, generals):
  connectivityTracker = new UnionFindTracker(grid, generals)
  candidates = getAllBlankTiles(grid)
  
  // Sort by safety: farthest from generals first
  candidates.sortByDistanceFromGenerals(generals)
  
  for candidate in candidates:
    if random() < mountainProbability and 
       connectivityTracker.canPlaceMountain(candidate):
      placeMountain(grid, candidate)
      connectivityTracker.addMountain(candidate)
```

### Advanced Optimizations to Explore
- **Connectivity zones:** Pre-compute regions that must remain connected
- **Critical path analysis:** Identify bottleneck areas that need protection
- **Lazy connectivity updates:** Only recompute when placing mountains near critical paths

### Pros/Cons
- **Pros:** Prevents problems during generation, maintains full randomness
- **Cons:** More complex implementation, requires sophisticated optimizations for large maps

## Approach 4: Multi-Pass Generation

### Algorithm
1. Generate N candidate maps quickly (using simpler algorithms)
2. Score each candidate on multiple criteria
3. Select best candidate or use hybrid approach

### Scoring Criteria
- **Connectivity diversity:** Multiple paths between generals (not just one)
- **Mountain distribution:** Avoid large empty areas or overly dense clusters  
- **General spacing:** Penalty for too close/far positioning
- **Aesthetic metrics:** Visual appeal, natural-looking terrain

### Performance Analysis
- **Time Complexity:** O(N × base_generation_time)
- **Space Complexity:** O(N × W×H) to store candidates, or O(W×H) with streaming
- **Highly parallelizable:** Each candidate can be generated independently

### Key Optimizations
- **Early elimination:** Quick scoring to filter candidates before expensive full scoring
- **Streaming generation:** Don't store all candidates, just track the best
- **Parallel generation:** Use multiple threads/workers for candidate generation
- **Adaptive candidate count:** Generate more candidates for larger/more complex maps

### Pseudo-code
```
function multiPassGeneration(size, numPlayers, targetQuality):
  bestMap = null
  bestScore = -infinity
  candidateCount = calculateCandidateCount(size, targetQuality)
  
  for i in 1..candidateCount:
    candidate = generateCandidate(size, numPlayers)
    quickScore = getQuickScore(candidate)
    
    if quickScore > preliminaryThreshold:
      fullScore = getFullScore(candidate)
      if fullScore > bestScore:
        bestMap = candidate
        bestScore = fullScore
  
  return bestMap
```

### Pros/Cons
- **Pros:** Highest quality results, flexible quality vs speed tradeoff
- **Cons:** Higher memory usage, more complex scoring system

## Performance Recommendations by Scale

### Small Maps (20x20, ≤8 players)
- All approaches viable
- Approach 3 reasonable with Union-Find optimization
- Approach 4 feasible with 5-10 candidates

### Medium Maps (30x30, ≤15 players)  
- Approach 1 recommended for simplicity
- Approach 3 viable with heavy optimization
- Approach 4 with 3-5 candidates for quality needs

### Large Maps (50x50, ≤30 players)
- Approach 1 most reliable if repair iterations stay low
- Approach 3 challenging without sophisticated optimizations
- Approach 4 only for premium quality requirements

## Implementation Recommendations

### Phase 1: Start with Approach 1
- Implement basic connectivity validation and repair
- Establish BFS utilities and connectivity testing infrastructure
- Measure actual repair iteration counts on various map configurations

### Phase 2: Optimize Based on Data
- If repair iterations are consistently low (1-3), stick with Approach 1
- If repair creates too many artificial corridors, consider Approach 3 with Union-Find
- If quality requirements are high, explore Approach 4

### Related Ideas to Explore
- **Hybrid approaches:** Combine constraint-based placement for critical areas with post-generation repair
- **Progressive difficulty:** Start with highly connected maps, gradually increase complexity
- **Player-count adaptive generation:** Different algorithms for 2v2 vs large multiplayer
- **Terrain variety:** Extend beyond mountains to include rivers, forests, etc.
- **Seed-based generation:** Reproducible maps for tournaments/testing