
# Getting up to speed

Please read the following recnet dev-notes to see what we've been working on

- dev-notes/2026-03/3-18-[1]-notes-for-custom-algo-burst-path-search.md
- dev-notes/2026-03/3-19-[1]-custom-algo-session-notes.md
- dev-notes/2026-03/3-19-[3]-overlap-design-sketch.md
- dev-notes/2026-03/3-19-[6]-overlap-implementation-session-notes.md

Check out recent git log history:

```
git loggs -30
```

---

# Suggestions for what to work on next

At the end of last session, claude suggest the following items to look at next:


```
Based on where things stand, here are the options roughly in order of impact:

**1. Performance optimizations (highest leverage)**

The reviewer identified three cheap wins that could significantly cut corridor-7x7's 2.8s:

- `maxBursts` config on `genDescendingPartitions` — optimal solutions use 4-6 bursts, not 10+. Cutting from unlimited to ~8 slashes the pattern space.
- Pre-filter patterns by available path lengths — skip any pattern containing a burst length with no paths in `entriesByLen`. One `Map.has()` per burst, eliminates many patterns before backtracking.
- Reachability pre-check — BFS from general, skip capture targets above reachable tile count.

These are all small, isolated changes. Good warm-up task.

**2. More test boards**

The current 8 boards are mostly open/sparse. Adding boards with tighter corridors, multiple chokepoints, or asymmetric walls would stress-test overlap more and might reveal cases where `maxOverlapPerBurst=3` isn't enough or prefix-only is too restrictive.

**3. Larger boards / path generation scaling**

`maxBurst=12` is the current cap due to OOM at length 14+ on open-11x11. If you want to explore whether longer first bursts yield better solutions, this is the next frontier. Options: lazy path generation, pruning during generation, or just accepting the cap since 12 seems sufficient.
```

---

Lets discuss :)
