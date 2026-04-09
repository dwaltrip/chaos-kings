# Session 4: N-Corridor Generalization + Future Direction Brainstorming

## Overview

Extended the corridor burst-chain model from 2 corridors (session 3) to N corridors (3, 4). Hit a scalability wall — 98M chains for 3-corridor, ~20B for 4-corridor — and solved it with a DAG-based dynamic programming approach that traverses unique states instead of enumerating chains. Used the efficient traversal to run analyses on the N-corridor results. Then stepped back to brainstorm how corridor-model insights connect to the real solver and what to explore next.

## Key results

| corridors | total chains | unique states | edges | collapse ratio |
|-----------|-------------|---------------|-------|----------------|
| 1 | 1,019 | 24 | — | 42.5x |
| 2 | 376,916 | 431 | 3,164 | 874.5x |
| 3 | 98,897,859 | 4,893 | 40,848 | 20,212x |
| 4 | 20,821,807,328 | 41,828 | 382,448 | 497,796x |

- State growth decelerates: 18x, 11.4x, 8.5x per added corridor
- Collapse ratio grows super-linearly
- States-per-frontier-config bounded at 2 * numCorridors
- Free threshold (total frontier): N <= 2

## Detailed docs

- **[State DAG Traversal](session-4-state-dag-traversal.md)** — The DAG DP algorithm: how it works, why naive BFS fails, performance gains
- **[N-Corridor Results](session-4-n-corridor-results.md)** — Concrete analysis: state counts, states-per-frontier, free threshold
- **[Future Directions](session-4-future-directions.md)** — Lane model, connection to existing solver, open questions for next-gen solver

## Files created

- `questions/q4-equiv-burst-multi-corridor-state-traverse.ts` — DAG DP state enumeration (the fast approach)
- `questions/q4-multi-corridor-analysis.ts` — states-per-frontier and free threshold analysis
- `questions/q4-equivalent-burst-chains-multi.ts` — brute-force N-corridor (superseded by DAG approach, can be deleted)
- `tmp-scripts/visualize-state-dag.ts` — step-by-step visualization of DAG vs brute-force
