# State DAG Traversal Algorithm

## The problem

Brute-force enumeration visits every possible burst chain — every distinct sequence of (direction, burstSize) choices. Chain count explodes combinatorially with more corridors:

| corridors | chains |
|-----------|--------|
| 2 | 376K |
| 3 | 98M |
| 4 | 20.8B |

3-corridor caused OOM when storing chains. Even count-only mode (no chain storage) took ~38 seconds for 3-corridor and was intractable for 4-corridor. The vast majority of work is redundant — millions of chains converge on the same few thousand states.

## The insight

The state graph is a **DAG** (directed acyclic graph). Each burst strictly increases tick, so there are no cycles. This means:

1. We can discover all reachable states without tracing every chain
2. We can count chains via DP — propagating path counts forward through the DAG

If 50,000 chains pass through state S, we don't trace each one forward. We store `pathCount[S] = 50000` and push that count to all successors in one step per outgoing edge.

## The algorithm

### Phase 1: Discovery (BFS)

Starting from the initial state, BFS outward. For each state, try all valid (direction, targetArmy) transitions. If the resulting state is new, add it to the queue. Record every edge.

Each state is processed exactly once. An edge to an already-seen state is recorded but doesn't re-enqueue the target.

Output: all reachable states + all edges in the DAG.

### Phase 2: Path count propagation

Sort all states by tick (topological order for this DAG). Initialize the initial state with pathCount = 1. Walk through in tick order. For each state, push its pathCount to all successor states via the recorded edges.

```
pathCounts[initial] = 1

for each state in tick order:
    for each outgoing edge (state → target):
        pathCounts[target] += pathCounts[state]
```

This works because processing in tick order guarantees all predecessors of a state have already propagated their counts before that state is processed.

### Why two phases?

A single-pass BFS that propagates counts as it goes gives **wrong results**. The issue: BFS order doesn't respect tick order. A state at tick 6 might be dequeued and propagated before a state at tick 5 that also has an edge into a shared successor at tick 9. The tick-9 successor would miss the tick-5 contribution.

The two-phase approach separates discovery (any order is fine) from propagation (must be tick-ordered).

## Concrete example

2 corridors, maxTick=10 — small enough to trace by hand.

**Phase 1** discovers 15 states and 28 edges (vs 48 chains by brute force).

**Phase 2** propagates counts. Here's how state `(10,2,[2,2])` accumulates 14 chains from 5 predecessors:

```
(6,2,[2,0]) contributes 2
(6,2,[0,2]) contributes 2
(7,1,[2,1]) contributes 2
(7,1,[1,2]) contributes 2
(8,2,[1,2]) contributes 3
(8,2,[2,1]) contributes 3
                   total: 14
```

Each predecessor's count was itself accumulated from *its* predecessors. The DP propagates everything forward without ever tracing the 14 individual chains that reach this state.

See `tmp-scripts/visualize-state-dag.ts` for the full step-by-step trace.

## Performance

| corridors | chains (brute force) | edges (DAG) | speedup |
|-----------|---------------------|-------------|---------|
| 2 | 376,916 | 3,164 | ~120x |
| 3 | 98,897,859 | 40,848 | ~2,400x |
| 4 | 20,821,807,328 | 382,448 | ~54,000x |

4-corridor completes in 0.27 seconds. Without the DAG approach, it was completely intractable.

## Complexity

- **Brute force:** O(totalChains) — visits every chain
- **DAG DP:** O(uniqueStates * branchingFactor) — visits every edge once in each phase

The branching factor per state is bounded by numCorridors * maxTargetArmy, but most branches terminate early (endTick > maxTick), so effective branching is much lower. Average edges per state: ~7-9 across corridor counts.
