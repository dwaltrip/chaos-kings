import { PriorityQueue } from '../priority-queue';

function createQueue<T>(): PriorityQueue<T> {
  return new PriorityQueue<T>();
}

// ---------------------------------------------------------------------------
// Empty queue behavior
// ---------------------------------------------------------------------------

describe('empty queue', () => {
  it('has size 0', () => {
    const q = createQueue<string>();
    expect(q.size).toBe(0);
  });

  it('isEmpty() returns true', () => {
    const q = createQueue<string>();
    expect(q.isEmpty()).toBe(true);
  });

  it('peek() returns undefined', () => {
    const q = createQueue<string>();
    expect(q.peek()).toBeUndefined();
  });

  it('pop() returns undefined', () => {
    const q = createQueue<string>();
    expect(q.pop()).toBeUndefined();
  });

  it('has() returns false for any item', () => {
    const q = createQueue<string>();
    expect(q.has('anything')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Single item
// ---------------------------------------------------------------------------

describe('single item', () => {
  it('insertOrDecrease updates size and isEmpty', () => {
    const q = createQueue<string>();
    q.insertOrDecrease('a', 5);
    expect(q.size).toBe(1);
    expect(q.isEmpty()).toBe(false);
  });

  it('has() returns true for inserted item', () => {
    const q = createQueue<string>();
    q.insertOrDecrease('a', 5);
    expect(q.has('a')).toBe(true);
  });

  it('peek() returns the item and priority', () => {
    const q = createQueue<string>();
    q.insertOrDecrease('a', 5);
    expect(q.peek()).toEqual({ item: 'a', priority: 5 });
  });

  it('pop() returns item and leaves queue empty', () => {
    const q = createQueue<string>();
    q.insertOrDecrease('a', 5);
    expect(q.pop()).toEqual({ item: 'a', priority: 5 });
    expect(q.size).toBe(0);
    expect(q.isEmpty()).toBe(true);
    expect(q.has('a')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// peek() behavior
// ---------------------------------------------------------------------------

describe('peek()', () => {
  it('is non-destructive — repeated calls return the same result', () => {
    const q = createQueue<string>();
    q.insertOrDecrease('a', 3);
    q.insertOrDecrease('b', 1);
    expect(q.peek()).toEqual({ item: 'b', priority: 1 });
    expect(q.peek()).toEqual({ item: 'b', priority: 1 });
    expect(q.size).toBe(2);
  });

  it('returns new min after pop', () => {
    const q = createQueue<string>();
    q.insertOrDecrease('a', 1);
    q.insertOrDecrease('b', 2);
    q.insertOrDecrease('c', 3);
    q.pop();
    expect(q.peek()).toEqual({ item: 'b', priority: 2 });
  });
});

// ---------------------------------------------------------------------------
// Min-ordering (pop/peek)
// ---------------------------------------------------------------------------

describe('min-ordering', () => {
  it('peek() returns the lowest priority item', () => {
    const q = createQueue<string>();
    q.insertOrDecrease('a', 10);
    q.insertOrDecrease('b', 3);
    q.insertOrDecrease('c', 7);
    expect(q.peek()).toEqual({ item: 'b', priority: 3 });
  });

  it('pop() returns items in ascending priority order', () => {
    const q = createQueue<string>();
    q.insertOrDecrease('a', 10);
    q.insertOrDecrease('b', 3);
    q.insertOrDecrease('c', 7);
    q.insertOrDecrease('d', 1);
    expect(q.pop()).toEqual({ item: 'd', priority: 1 });
    expect(q.pop()).toEqual({ item: 'b', priority: 3 });
    expect(q.pop()).toEqual({ item: 'c', priority: 7 });
    expect(q.pop()).toEqual({ item: 'a', priority: 10 });
  });

  it('full drain produces sorted output', () => {
    const q = createQueue<string>();
    const entries = [5, 2, 8, 1, 9, 3];
    entries.forEach((p, i) => q.insertOrDecrease(`item-${i}`, p));

    const results: number[] = [];
    while (!q.isEmpty()) {
      results.push(q.pop()!.priority);
    }
    expect(results).toEqual([1, 2, 3, 5, 8, 9]);
  });
});

// ---------------------------------------------------------------------------
// Interleaved insert and pop
// ---------------------------------------------------------------------------

describe('interleaved insert and pop', () => {
  it('maintains ordering as queue changes dynamically', () => {
    const q = createQueue<string>();
    q.insertOrDecrease('a', 5);
    q.insertOrDecrease('b', 3);
    expect(q.pop()).toEqual({ item: 'b', priority: 3 });

    q.insertOrDecrease('c', 1);
    expect(q.pop()).toEqual({ item: 'c', priority: 1 });
    expect(q.pop()).toEqual({ item: 'a', priority: 5 });
    expect(q.isEmpty()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Duplicate / decrease behavior
// ---------------------------------------------------------------------------

describe('duplicate / decrease behavior', () => {
  it('higher (worse) priority is a no-op', () => {
    const q = createQueue<string>();
    q.insertOrDecrease('a', 3);
    q.insertOrDecrease('a', 5);
    expect(q.size).toBe(1);
    expect(q.pop()).toEqual({ item: 'a', priority: 3 });
  });

  it('equal priority is a no-op', () => {
    const q = createQueue<string>();
    q.insertOrDecrease('a', 3);
    q.insertOrDecrease('a', 3);
    expect(q.size).toBe(1);
    expect(q.pop()).toEqual({ item: 'a', priority: 3 });
  });

  it('lower (better) priority updates the item', () => {
    const q = createQueue<string>();
    q.insertOrDecrease('a', 5);
    q.insertOrDecrease('a', 2);
    expect(q.size).toBe(1);
    expect(q.pop()).toEqual({ item: 'a', priority: 2 });
  });

  it('can change which item is the min', () => {
    const q = createQueue<string>();
    q.insertOrDecrease('a', 2);
    q.insertOrDecrease('b', 5);
    expect(q.peek()).toEqual({ item: 'a', priority: 2 });

    q.insertOrDecrease('b', 1);
    expect(q.peek()).toEqual({ item: 'b', priority: 1 });
  });

  it('successive decreases on the same item', () => {
    const q = createQueue<string>();
    q.insertOrDecrease('a', 10);
    q.insertOrDecrease('a', 7);
    q.insertOrDecrease('a', 3);
    q.insertOrDecrease('a', 1);
    expect(q.size).toBe(1);
    expect(q.pop()).toEqual({ item: 'a', priority: 1 });
  });

  it('allows reinsertion of a previously popped item', () => {
    const q = createQueue<string>();
    q.insertOrDecrease('a', 5);
    q.pop();
    q.insertOrDecrease('a', 3);
    expect(q.has('a')).toBe(true);
    expect(q.size).toBe(1);
    expect(q.pop()).toEqual({ item: 'a', priority: 3 });
  });
});

// ---------------------------------------------------------------------------
// has()
// ---------------------------------------------------------------------------

describe('has()', () => {
  it('returns false for never-inserted item', () => {
    const q = createQueue<string>();
    q.insertOrDecrease('a', 1);
    expect(q.has('b')).toBe(false);
  });

  it('returns true after insert', () => {
    const q = createQueue<string>();
    q.insertOrDecrease('a', 1);
    expect(q.has('a')).toBe(true);
  });

  it('returns false after item is popped', () => {
    const q = createQueue<string>();
    q.insertOrDecrease('a', 1);
    q.pop();
    expect(q.has('a')).toBe(false);
  });

  it('returns true after decrease', () => {
    const q = createQueue<string>();
    q.insertOrDecrease('a', 5);
    q.insertOrDecrease('a', 2);
    expect(q.has('a')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// size accuracy through mixed operations
// ---------------------------------------------------------------------------

describe('size tracking', () => {
  it('stays accurate through a sequence of mixed operations', () => {
    const q = createQueue<string>();
    expect(q.size).toBe(0);

    q.insertOrDecrease('a', 5);
    expect(q.size).toBe(1);

    // duplicate insert — no size change
    q.insertOrDecrease('a', 10);
    expect(q.size).toBe(1);

    q.insertOrDecrease('b', 3);
    expect(q.size).toBe(2);

    q.pop();
    expect(q.size).toBe(1);

    // decrease on existing — no size change
    q.insertOrDecrease('a', 1);
    expect(q.size).toBe(1);

    // insertOrDecrease on missing — acts as insert
    q.insertOrDecrease('c', 4);
    expect(q.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Priority edge cases
// ---------------------------------------------------------------------------

describe('priority edge cases', () => {
  it('handles negative priorities', () => {
    const q = createQueue<string>();
    q.insertOrDecrease('a', 0);
    q.insertOrDecrease('b', -5);
    q.insertOrDecrease('c', -10);
    expect(q.pop()!.priority).toBe(-10);
    expect(q.pop()!.priority).toBe(-5);
    expect(q.pop()!.priority).toBe(0);
  });

  it('handles zero priority', () => {
    const q = createQueue<string>();
    q.insertOrDecrease('a', 0);
    expect(q.peek()).toEqual({ item: 'a', priority: 0 });
  });

  it('handles very large priorities', () => {
    const q = createQueue<string>();
    q.insertOrDecrease('a', Number.MAX_SAFE_INTEGER);
    q.insertOrDecrease('b', 1);
    expect(q.pop()).toEqual({ item: 'b', priority: 1 });
    expect(q.pop()).toEqual({ item: 'a', priority: Number.MAX_SAFE_INTEGER });
  });

  it('handles fractional priorities', () => {
    const q = createQueue<string>();
    q.insertOrDecrease('a', 2.7);
    q.insertOrDecrease('b', 0.1);
    q.insertOrDecrease('c', 1.5);
    expect(q.pop()!.priority).toBe(0.1);
    expect(q.pop()!.priority).toBe(1.5);
    expect(q.pop()!.priority).toBe(2.7);
  });
});

// ---------------------------------------------------------------------------
// Equal priorities (ties)
// ---------------------------------------------------------------------------

describe('equal priorities (ties)', () => {
  it('returns all items with the same priority', () => {
    const q = createQueue<string>();
    q.insertOrDecrease('a', 3);
    q.insertOrDecrease('b', 3);
    expect(q.size).toBe(2);

    const results = [q.pop()!, q.pop()!];
    const items = results.map((r) => r.item).sort();
    expect(items).toEqual(['a', 'b']);
    results.forEach((r) => expect(r.priority).toBe(3));
  });
});

// ---------------------------------------------------------------------------
// Item type diversity
// ---------------------------------------------------------------------------

describe('object references as keys', () => {
  it('works with object references using identity', () => {
    const obj1 = { id: 1 };
    const obj2 = { id: 2 };
    const q = createQueue<{ id: number }>();
    q.insertOrDecrease(obj1, 5);
    q.insertOrDecrease(obj2, 3);
    expect(q.has(obj1)).toBe(true);
    expect(q.has(obj2)).toBe(true);
    expect(q.pop()!.item).toBe(obj2);
  });

  it('treats objects with same shape but different references as distinct', () => {
    const a = { id: 1 };
    const b = { id: 1 };
    const q = createQueue<{ id: number }>();
    q.insertOrDecrease(a, 5);
    q.insertOrDecrease(b, 3);
    expect(q.size).toBe(2);
  });

  it('preserves object reference identity on pop/peek', () => {
    const obj = { id: 42 };
    const q = createQueue<{ id: number }>();
    q.insertOrDecrease(obj, 1);
    expect(q.peek()!.item).toBe(obj);
    expect(q.pop()!.item).toBe(obj);
  });
});

describe('string keys', () => {
  it('works with string items', () => {
    const q = createQueue<string>();
    q.insertOrDecrease('foo', 3);
    q.insertOrDecrease('bar', 1);
    expect(q.pop()).toEqual({ item: 'bar', priority: 1 });
    expect(q.pop()).toEqual({ item: 'foo', priority: 3 });
  });
});

describe('number keys', () => {
  it('does not confuse number items with priorities', () => {
    const q = createQueue<number>();
    q.insertOrDecrease(42, 3);
    q.insertOrDecrease(7, 1);
    expect(q.pop()).toEqual({ item: 7, priority: 1 });
    expect(q.pop()).toEqual({ item: 42, priority: 3 });
  });
});

// ---------------------------------------------------------------------------
// Stress tests
// ---------------------------------------------------------------------------

describe('stress', () => {
  it('1000 items — insert all then drain in sorted order', () => {
    const q = createQueue<number>();
    const priorities = Array.from({ length: 1000 }, () => Math.random() * 10000);
    priorities.forEach((p, i) => q.insertOrDecrease(i, p));
    expect(q.size).toBe(1000);

    const results: number[] = [];
    while (!q.isEmpty()) {
      results.push(q.pop()!.priority);
    }
    expect(q.size).toBe(0);

    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toBeGreaterThanOrEqual(results[i - 1]);
    }
  });

  it('1000 items — insert, decrease half, then drain in sorted order', () => {
    const q = createQueue<number>();
    const count = 1000;
    Array.from({ length: count }, (_, i) => q.insertOrDecrease(i, i * 10));
    expect(q.size).toBe(count);

    // decrease priority on even-indexed items
    for (let i = 0; i < count; i += 2) {
      q.insertOrDecrease(i, i * 10 - 5000);
    }
    expect(q.size).toBe(count);

    const results: number[] = [];
    while (!q.isEmpty()) {
      results.push(q.pop()!.priority);
    }
    expect(q.size).toBe(0);

    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toBeGreaterThanOrEqual(results[i - 1]);
    }
  });
});
