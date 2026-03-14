# Deep Research Prompt — Optimal Expansion Solver

I have a combinatorial optimization problem on a grid. I'd like you to research and brainstorm approaches broadly — reframing the problem, drawing from different fields, and thinking creatively about how to attack it.

## The problem

A single player starts on one tile of an NxN grid (N=7 to 11). Some tiles are passable, some are walls. The game runs for T discrete ticks (T~50). The goal is to maximize the number of tiles owned at tick T.

**Terminology:** The starting tile is called the **general**. It is the only tile that produces new armies.

**Rules:**
- The general produces +1 army every 2 ticks
- Each tick, the player may make one move: send all-but-1 armies from any owned tile to an adjacent tile (up/down/left/right), or wait (do nothing)
- Moving onto an unowned passable tile captures it — the arriving armies occupy that tile (1 army must remain to hold it)
- Moving onto an already-owned tile merges armies
- Only tiles with >1 army can be a move source (must leave 1 behind)
- "Walls" are impassable tiles

**What a board looks like** (`.` = empty, `G` = general, `#` = wall):

Open board:

```
. . . . . . .
. . . . . . .
. . . . . . .
. . . G . . .
. . . . . . .
. . . . . . .
. . . . . . .
```

Board with a few walls:

```
. . # . . . .
. . . . # . .
. . . . . . .
. . . G . . .
. # . . . . .
. . . . . # .
. . . . . . .
```

Board with many walls:

```
. . . . . . .
. . . # . . .
. . # # . . .
# . # G . # .
. . . . . . .
. # . # # . .
. . . # . . .
```

## The search challenge

The state space is enormous — the number of legal moves per tick varies from as few as 1 (early game) to 10–20 (later, with multiple mobile armies), and the game runs ~50 ticks deep. This makes brute force impossible. The state at any point is fully described by: which tiles are owned, how many armies are on each tile, and the current tick.

A major source of state explosion: the same territory shape with the same total army count can have armies distributed across tiles in many different permutations.

## A core tension

Your general produces armies over time, and you must decide when to accumulate vs when to spend. As an example, two possible extreme strategies might be (illustrated with visuals in the appendix):

**Strategy A: Drip-feed** — move one army out as soon as it's produced. Slow, blobby growth. Each army only captures one tile. Reaches ~24 land by tick 50 on an open 7x7.

**Strategy B: Burst** — accumulate many armies on the general, then chain-capture in rapid succession. Nothing happens for ~20 ticks, then a single large army sweeps a path capturing 10 tiles in 10 moves. Meanwhile the general is already accumulating for the next burst.

The optimal solution on a sufficiently open board at tick 50 is **25 land**. It's known that a burst-strategy with successive movement chains is the easiest way to do this.

## What I'm looking for

**1. Reframings** — Can this be viewed as a fundamentally different kind of problem?
- A **network flow** problem where armies "flow" from the general into unclaimed territory, and we want to maximize throughput or minimize waste?
- A **dynamic programming** problem where we solve on progressively larger boards — start with just the general's neighborhood, expand outward, reuse subsolutions?
- An **efficiency** optimization rather than land maximization — penalizing wasted moves (moving small armies over owned territory) and rewarding productive moves (capturing new land with a larger army that can then continue capturing)?
- Something from **scheduling, routing, or resource allocation** theory?
- Other framings I haven't considered?

**2. State reduction beyond identical-state dedup** — Ways to recognize that certain states are strictly dominated by others, not because they're identical, but because one is provably "at least as good" in every future scenario. For example: if two states have the same territory and same total army, but state A's army distribution can produce any future state B's can (plus more), then B can be pruned. Can the notion of "degrees of freedom" or "flexibility" be formalized to collapse large equivalence classes of states?

**3. Algorithmic approaches from any field** — Graph theory, operations research, AI planning, computational geometry, game theory, compiler optimization, physics simulation — whatever might apply. Interested in both exact methods (guaranteed optimal) and near-exact methods (provable bounds on suboptimality).

**4. Structural properties to exploit** — The grid is spatial. Armies only move locally (one move per tick). Production is fixed, periodic, and localized to one tile. Owned territory is always contiguous. These constraints are strong — what approaches do they enable that wouldn't work on general combinatorial problems?

---

## Appendix: Example strategies on open 7x7

### Strategy A: Blob-expansion

Move one army as soon as it's produced. Expand more uniformly from the general, with small armies frequently moving over already-explored land.

Tick 0 (1 land):

```
. . . . . . .
. . . . . . .
. . . . . . .
. . . G . . .
. . . . . . .
. . . . . . .
. . . . . . .
```

Tick 12 (6 land):

```
. . . . . . .
. . . . . . .
. . . o . . .
. . o G o . .
. . . o . . .
. . . o . . .
. . . . . . .
```

Tick 26 (13 land):

```
. . . . . . .
. . . o . . .
. . o o o . .
. o o G o o .
. . o o o . .
. . . o . . .
. . . . . . .
```

Tick 40 (19 land):

```
. . . . . . .
. . o o . o .
. o o o o o .
. o o G o o .
. . o o o . .
. . . o o o .
. . . . . . .
```

### Strategy B: Burst

Accumulate armies on the general, then chain-capture a long path in rapid succession.

At tick 20, the general has accumulated 11 armies. Then a single large army sweeps a U-shaped path (right 3, down 3, left 4), capturing 10 tiles in 10 moves (leaving 1 on general). The general is already accumulating again for the next burst.

Tick 0 and Tick 20 (1 land):

```
. . . . . . .
. . . . . . .
. . . . . . .
. . . G . . .
. . . . . . .
. . . . . . .
. . . . . . .
```

Tick 21 (2 land, begin moving out with larger army):

```
. . . . . . .
. . . . . . .
. . . . . . .
. . . G o . .
. . . . . . .
. . . . . . .
. . . . . . .
```


Tick 30 (11 land, finish movement burst):

```
. . . . . . .
. . . . . . .
. . . . . . .
. . . G o o o
. . . . . . o
. . . . . . o
. . o o o o o
```

During the first burst (ticks 21-30), the general also produced 5 armies (at ticks 22, 24, 26, 28, 30). These are spent in ticks 31-35 capturing leftward from the general.

Tick 35 (16 land):

```
. . . . . . .
. . . . . . .
. . . . . . .
o o o G o o o
o o . . . . o
. . . . . . o
. . o o o o o
```
