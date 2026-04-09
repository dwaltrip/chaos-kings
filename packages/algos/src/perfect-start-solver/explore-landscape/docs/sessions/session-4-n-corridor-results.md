# N-Corridor Results

## Model

Generalization of the double-sided corridor (session 3, q3) to N corridors radiating from a central general.

- State: `(tick, generalArmy, frontiers[0..N-1])`
- Each burst picks a direction (0..N-1), waits for sufficient army, then deploys
- Re-traversal cost = that direction's frontier (walk back through owned tiles)
- Burst size = targetArmy - 1 (you always move all troops minus 1)
- Production: general produces +1 army every 2 ticks (on even ticks, starting from tick 2)
- After burst: generalArmy = 1 + production ticks earned during the burst

Two chains are equivalent if they produce the same state.

## Results (maxTick=50)

| corridors | total chains | unique states | edges | collapse ratio |
|-----------|-------------|---------------|-------|----------------|
| 1 | 1,019 | 24 | (not measured) | 42.5x |
| 2 | 376,916 | 431 | 3,164 | 874.5x |
| 3 | 98,897,859 | 4,893 | 40,848 | 20,212x |
| 4 | 20,821,807,328 | 41,828 | 382,448 | 497,796x |

### State growth decelerates

| step | multiplier |
|------|-----------|
| 1→2 | 18x |
| 2→3 | 11.4x |
| 3→4 | 8.5x |

Adding a corridor gives diminishing new states. The shared army/tick budget limits how much can be done in a new direction — most of the tick budget is already committed, so the extra corridor mostly adds direction permutations (which collapse via equivalence) rather than genuinely new frontier configurations.

### Collapse ratio grows super-linearly

Each added corridor multiplies the chain count dramatically (370x, 262x, 211x for 1→2, 2→3, 3→4 respectively) but the state count by only ~8-18x. The equivalence structure absorbs the combinatorial explosion of direction orderings.

## States-per-frontier-config

A frontier config is a specific tuple like `(3, 5, 0, 2)`. Multiple chains can reach the same frontier config but arrive at different (tick, army) values — those are different states sharing the same frontier config.

| corridors | max states per config |
|-----------|----------------------|
| 2 | 4 |
| 3 | 6 |
| 4 | 8 |

Empirical pattern (tested up to 4 corridors): max = 2 * numCorridors. This is a tight bound — knowing the frontiers almost determines the rest of the state. Only a small number of (tick, army) pairs are possible for any given frontier configuration.

Distribution for 4-corridor:

| states per config | number of configs |
|-------------------|-------------------|
| 1 | 2,132 |
| 2 | 2,801 |
| 3 | 1,918 |
| 4 | 2,366 |
| 5 | 1,788 |
| 6 | 1,176 |
| 7 | 384 |
| 8 | 24 |

## Free threshold

For each total frontier value F (sum of all corridors' frontiers), we check whether ALL frontier configs with that total collapse to exactly 1 state (meaning all chains reaching that frontier config produce the same tick and army).

| corridors | free threshold (total frontier) |
|-----------|-------------------------------|
| 2 | F <= 2 |
| 3 | F <= 2 |
| 4 | F <= 2 |

Consistent across corridor counts. This is compatible with the single-sided finding of per-direction frontier <= 3 (session 3) — with multiple corridors, total frontier 3 can be distributed across directions in ways that create splits (e.g., (3,0,0,0) vs (1,1,1,0) can produce different states).

Implication for solver: at very low total frontiers, history doesn't matter — all paths to a given frontier config produce the same state. This could allow early-search pruning.

## Files

- `questions/q4-equiv-burst-multi-corridor-state-traverse.ts` — state enumeration via DAG DP
- `questions/q4-multi-corridor-analysis.ts` — states-per-frontier and free threshold analysis
