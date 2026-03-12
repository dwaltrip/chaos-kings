# IPriorityQueue Test Plan (TDD)

Tests are written against the `IPriorityQueue<T>` interface. Implementation will be plugged in later.

---

## Empty queue behavior
- `size` is 0
- `isEmpty()` returns true
- `peek()` returns undefined
- `pop()` returns undefined
- `has(anything)` returns false

## Single item
- After one `insert(item, priority)`: `size` is 1, `isEmpty()` false
- `has(item)` returns true
- `peek()` returns `{ item, priority }`
- `pop()` returns `{ item, priority }` and queue is empty afterwards (`size` 0, `isEmpty()` true, `has(item)` false)

## peek() is non-destructive
- Calling `peek()` multiple times in a row returns the same result
- `size` doesn't change after peek

## peek() after pop returns new min
- Insert A(1), B(2), C(3). Pop (get A). `peek()` should return `{ item: B, priority: 2 }`

## Min-ordering (pop/peek)
- Insert several items with distinct priorities; `peek()` returns the one with the lowest priority
- `pop()` returns items in ascending priority order
- Full drain: pop all N items, collect results, verify sorted ascending by priority

## Interleaved insert and pop
- Insert A(5), B(3), pop (expect B), insert C(1), pop (expect C), pop (expect A)
- Verifies ordering is maintained as the queue changes dynamically

## Duplicate insert — higher (worse) priority
- Insert item with priority 3, then insert same item with priority 5
- Priority should remain 3 (no-op for worse priority)
- `size` stays 1
- `pop()` returns `{ item, priority: 3 }`

## Duplicate insert — equal priority
- Insert item with priority 3, then insert same item with priority 3
- No-op — equal is not "higher (worse)", so no update
- `size` stays 1
- `pop()` returns `{ item, priority: 3 }`

## Duplicate insert — lower (better) priority
- Insert item with priority 5, then insert same item with priority 2
- Priority should update to 2
- `size` stays 1
- `pop()` returns `{ item, priority: 2 }`

## Re-insert after pop
- Insert A(5), pop A, insert A(3)
- `has(A)` is true, `size` is 1, `pop()` returns `{ item: A, priority: 3 }`
- Verifies implementation properly cleans up internal state after pop

## decreasePriority — basic
- Insert item with priority 10, call `decreasePriority(item, 3)`
- `peek()`/`pop()` returns priority 3
- `has(item)` still true after decrease (before pop)

## decreasePriority — changes the min
- Insert A(2), B(5); `peek()` returns `{ item: A, priority: 2 }`
- `decreasePriority(B, 1)`; now `peek()` returns `{ item: B, priority: 1 }`

## decreasePriority — successive decreases on same item
- Insert item with priority 10
- `decreasePriority(item, 7)`, then `decreasePriority(item, 3)`, then `decreasePriority(item, 1)`
- `size` stays 1 throughout
- `pop()` returns `{ item, priority: 1 }`

## decreasePriority — no-op when new priority is equal or higher
- "Strictly lower" means equal does NOT count as lower
- Insert item with priority 3, call `decreasePriority(item, 3)` — priority stays 3
- Insert item with priority 3, call `decreasePriority(item, 7)` — priority stays 3

## decreasePriority — missing item acts as insert
- Call `decreasePriority(newItem, 5)` on empty or non-containing queue
- `has(newItem)` returns true, `size` incremented, `pop()` returns it with priority 5

## decreasePriority — on previously-popped item acts as insert
- Insert item with priority 5, pop it
- Call `decreasePriority(item, 3)` — should re-insert
- `has(item)` true, `size` is 1, `pop()` returns `{ item, priority: 3 }`

## has() correctness
- Returns false for never-inserted item
- Returns true after insert
- Returns false after item is popped
- Returns true after decreasePriority (item still present)
- Returns false for a different item that was never inserted, even when queue is non-empty

## size accuracy through mixed operations
- Track `size` after each operation in a sequence: insert, insert duplicate (no size change), insert new, pop (size decreases), decreasePriority on existing (no size change), decreasePriority on missing (size increases)

## Priority edge cases
- Negative priorities: insert items with priorities -10, -5, 0; pop order is -10, -5, 0
- Zero priority: insert item with priority 0, it behaves normally
- Very large priorities: insert with Number.MAX_SAFE_INTEGER, still works
- Fractional priorities: insert with 1.5, 2.7, 0.1; pop order respects fractional ordering

## Equal priorities (ties)
- Insert A(3) and B(3); both are popped — each pop returns priority 3
- Order among ties is unspecified, but both items must appear
- `size` is 2 (not 1 — they are different items)

## Item type diversity

### Object references as keys
- Use object references (e.g. `{ id: 1 }`) as items
- `has()`, `insert()`, `decreasePriority()` work based on reference identity
- Two objects with same shape but different references are treated as distinct items
- `pop()`/`peek()` return the same object reference that was inserted (identity preservation)

### String keys
- Insert "foo" with priority 3, "bar" with priority 1
- Pop order: "bar", "foo"

### Number keys (items are numbers, distinct from priorities)
- Insert item `42` with priority 3, item `7` with priority 1
- Verify implementation doesn't confuse items with priorities
- Pop order: `{ item: 7, priority: 1 }`, `{ item: 42, priority: 3 }`

## Stress / large queue
- Insert 1000 items with random priorities, pop all, verify output is sorted ascending
- Verify `size` is correct after all inserts, during drain, and after full drain (0)

## Stress — with decreasePriority
- Insert 1000 items, decrease priority on ~half of them, then drain
- Verify output is correctly sorted and size tracks accurately throughout
- Exercises lazy deletion path under load
