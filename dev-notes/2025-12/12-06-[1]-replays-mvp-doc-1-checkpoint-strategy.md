# Replay Frame Computation Strategy

**Date:** 2025-12-06
**Context:** Replay viewer MVP - deciding how to compute and cache replay frames

## Decision: Lazy Computation with Checkpoint Caching

We chose **lazy frame computation with checkpoint caching** over pre-computing all frames upfront.

### Key Parameters

- **Checkpoint interval:** N = 25 steps
- **Cache:** LRU cache (bare bones implementation)
- **Background building:** No - compute on-demand only
- **Total steps:** Estimate from `lastEventStep`, refine when reaching end

## Rationale

**Why not pre-compute all frames?**
- Multi-second load times (1000 steps = 1-2 sec, 5000 steps = 5-10 sec)
- User must wait before seeing anything
- Wasted computation if user only watches beginning

**Why checkpoints work:**
- Initial load: <100ms (compute only step 0)
- User sees replay instantly
- Acceptable seek performance: worst case ~300ms for 300-step jump from nearest checkpoint
- Memory usage comparable to pre-compute after full viewing

## Implementation Approach

```typescript
// Checkpoint every 25 steps
const CHECKPOINT_INTERVAL = 25;

// Core computation function
getFrameAt(targetStep: number): ReplayFrame {
  // 1. Check cache first
  if (frameCache.has(targetStep)) {
    return frameCache.get(targetStep);
  }

  // 2. Find nearest checkpoint <= targetStep
  const checkpointStep = Math.floor(targetStep / 25) * 25;
  const checkpoint = checkpoints.get(checkpointStep);

  // 3. Clone checkpoint board and simulate forward
  let board = deepCloneBoard(checkpoint.board);
  for (let step = checkpointStep + 1; step <= targetStep; step++) {
    const events = eventsByStep.get(step) ?? [];
    const result = processStep(board, step, events, config.timing);

    const frame = { step, board: deepCloneBoard(board), ...result };
    frameCache.set(step, frame); // LRU cache

    // Save checkpoint every 25 steps
    if (step % CHECKPOINT_INTERVAL === 0) {
      checkpoints.set(step, frame);
    }

    if (result.gameEnded) break;
  }

  return frameCache.get(targetStep);
}
```

## Performance Characteristics

**With N=25 checkpoint interval:**

| Scenario | Performance |
|----------|-------------|
| Initial load | ~50-100ms (just step 0) |
| Play from start | Smooth (caching as we go) |
| Seek to step 500 (cold) | ~500ms (compute 500 frames, create 20 checkpoints) |
| Seek to step 300 (after above) | ~25ms (resume from checkpoint 275) |
| Seek to step 800 (after above) | ~300ms (resume from checkpoint 500) |
| Memory (1000 steps viewed) | ~40 checkpoints + LRU cache |

**Key insight:** First seeks are slower, but each seek builds checkpoint infrastructure. After scrubbing around, performance approaches pre-computed behavior.

## LRU Cache Details

- **Purpose:** Prevent unbounded memory growth
- **Implementation:** Bare bones - simple Map with size limit
- **Eviction:** When cache exceeds limit, remove least recently used frames
- **Checkpoints never evicted:** Separate from frame cache

## Future Optimizations (Post-MVP)

If needed, we can add:
1. Background checkpoint building (pre-compute ahead of current position)
2. Smarter cache eviction (keep frames near current position)
3. Larger checkpoint interval for very long games (>5000 steps)
4. `stopAfterLastEvent` optimization to avoid empty trailing steps

## Trade-offs Accepted

**Pros:**
- Fast initial load (instant perceived performance)
- Memory efficient for users who don't watch full replay
- Simple implementation

**Cons:**
- First-time seeks have variable latency (50-500ms depending on distance)
- Slightly more complex than pre-compute
- Cache management adds code

For MVP, the instant load time and good-enough seek performance outweigh the implementation complexity.
