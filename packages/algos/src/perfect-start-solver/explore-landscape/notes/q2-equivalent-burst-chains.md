
# Equivalent Burst Chains (simple version)

Board:

* Single corridor with the general at the far left end (x=0)
* Immediate neighbor of general is to the right, at x=1

## Example

These two chains, A and B, feel equivalent to me.

**Chain A:**

| Burst # | Ticks      | General | Path (x)    | Moves   | Re-traversals | New Tiles (x) |
|---------|------------|---------|-------------|---------|---------------|---------------|
| 1       | (3, 3)     | 2 / 1   | 1           | 1       | 0             | 1             |
| 2       | (5, 6)     | 2 / 1   | 1, 2        | 2       | 1             | 2             |
| 3       | (7, 9)     | 2 / 2   | 1, 2, 3     | 3       | 2             | 3             |

* Before
    * Tick = 0
    * General Army = 1
    * Tiles = { 0 }
* After
    * Tick = 9
    * General Army = 2
    * Tiles = { 0, 1, 2, 3 }

**Chain B:**

| Burst # | Ticks      | General | Path (x)    | Moves   | Re-traversals | New Tiles (x) |
|---------|------------|---------|-------------|---------|---------------|---------------|
| 1       | (5, 6)     | 3 / 1   | 1, 2        | 2       | 0             | 1, 2          |
| 2       | (7, 9)     | 2 / 2   | 1, 2, 3     | 3       | 2             | 3             |

* Before
    * Tick = 0
    * General Army = 1
    * Tiles = { 0 }
* After
    * Tick = 9
    * General Army = 2
    * Tiles = { 0, 1, 2, 3 }

