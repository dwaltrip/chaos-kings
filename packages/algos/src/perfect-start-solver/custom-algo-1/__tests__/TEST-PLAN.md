# custom-algo-1 test plan

## Files

### bitmask.test.ts
- `tilesToMask`: empty array, single tile, multiple tiles
- `maskToTiles`: roundtrip with tilesToMask
- `hasOverlap`: overlapping masks, non-overlapping masks
- `popcount`: zero, small values, larger masks

### get-burst-info.test.ts
- `getMoveTicksForBurstPattern`: port the 7 test cases from tmp-scripts/test-move-ticks.ts
- `getBurstInfos`: verify startTick/endTick for a few known patterns

### burst-patterns.test.ts
- `genDescendingPartitions`: all partitions sum to target, all are descending, known counts for small values
- `genValidBurstPatterns`: known pattern [10,8,4,2] is in the set for total=24, zero valid patterns for total=25, all results fit within maxTicks

### gen-paths.test.ts
- path counts match expected values on open boards (use the known counts from the notes doc as ground truth)
- paths respect mountains (fewer paths on sparse-mtns than open)
- all paths start from the given start tile

### path-search.test.ts
- `buildPathEntries`: strips general tile, re-keys by new length, masks exclude general
- `findPaths`: finds solution on open-11x11 with [10,8,4,2], no solution on corridor-7x7 with [10,8,4,2]

### solver.test.ts
- end-to-end: open boards get 24 captures, corridor/maze get 23
- solution paths are non-overlapping (bitmask AND = 0)

## Helpers
- Board setup helper: `makeTestBoard(name)` → returns `{ board, generalPos }` ready for use
- Probably a shared file like `__tests__/helpers.ts`

## Notes
- Keep individual test files focused. If a file has many data-driven cases, use `it.each` or a loop with descriptive names.
- Helpers go in a shared file to avoid repetition across test files.
