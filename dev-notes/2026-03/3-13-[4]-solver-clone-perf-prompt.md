# Solver Clone Performance — Session Prompt

## Context

The perfect-start solver uses beam search (`packages/algos/src/perfect-start-solver/prototyping/`). Clone+step is **80-98% of runtime** — `structuredClone(gameState)` is the bottleneck. At beam=200 on 7x7, ~50k clones per run, each deep-copying 49 Square objects + coord objects.

## Goal

Replace `structuredClone` in `solver.ts:cloneState` with a manual clone that avoids unnecessary work.

## Key insight

Most squares don't change on any given tick. Neutral squares (BLANK, MOUNTAIN) are immutable until captured. Coord objects never change. Only player-owned squares mutate (units change, type changes on capture).

## Recommended approach

Write a `cloneGameState(gameState)` that:
1. Reuses neutral square objects directly (no copy needed — they're immutable)
2. Shallow-copies player squares (new object, same coord ref)
3. Creates new row arrays and grid array (since array refs would alias)
4. Shallow-copies the players array (just `{ status, armyCount, landCount }`)

This should roughly halve allocations. Measure before/after with the existing perf instrumentation (clone+step ms in comparison output).

## Files

- `solver.ts` — `cloneState` function to replace
- `@core/types.ts` — GameState, BoardState, Square types
- `run-comparison.ts` — run with `--beam=50 --score=land-only` for quick benchmarks

## Stretch

If manual clone isn't enough, consider sparse clone: only copy squares that are player-owned or adjacent to player territory. More complex but much fewer allocations in early game when territory is small relative to board.
