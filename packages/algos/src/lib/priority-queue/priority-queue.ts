import { IPriorityQueue } from './interface';

/**
 * Min Priority Queue backed by a binary heap with lazy deletion.
 *
 * - insertOrDecrease(item, priority): O(log n) — O(1) when priority is not an improvement
 * - pop(): O(log n) amortized (skips stale entries)
 * - peek(): O(1) amortized
 * - isEmpty(): O(1)
 * - has(item): O(1)
 *
 * Items must be usable as Map keys (primitives or object references).
 */

class PriorityQueue<T> implements IPriorityQueue<T> {
  private heap: { item: T; priority: number }[] = [];
  /** Tracks the *current* best priority for each item. */
  private bestPriority: Map<T, number> = new Map();

  get size(): number {
    return this.bestPriority.size;
  }

  isEmpty(): boolean {
    return this.bestPriority.size === 0;
  }

  /** Insert an item, or decrease its priority if it already exists with a higher value.
   *  No-op if the item already has an equal or lower priority. */
  insertOrDecrease(item: T, priority: number): void {
    const existing = this.bestPriority.get(item);
    if (existing !== undefined && existing <= priority) return; // already have equal or better

    this.bestPriority.set(item, priority);
    this.heap.push({ item, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  /** Return the min-priority item without removing it, or undefined if empty. */
  peek(): { item: T; priority: number } | undefined {
    this.skipStale();
    if (this.heap.length === 0) return undefined;
    const { item, priority } = this.heap[0];
    return { item, priority };
  }

  /** Remove and return the min-priority item, or undefined if empty. */
  pop(): { item: T; priority: number } | undefined {
    this.skipStale();
    if (this.heap.length === 0) return undefined;

    const top = this.heap[0];
    this.bestPriority.delete(top.item);

    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }

    // There may be more stale entries now at the top — clean eagerly so
    // isEmpty() / size stay accurate after a pop+skip sequence.
    this.skipStale();
    return top;
  }

  /** Check whether an item is currently in the queue. */
  has(item: T): boolean {
    return this.bestPriority.has(item);
  }

  // ── internal ──────────────────────────────────────────────

  /** Discard heap entries whose priority doesn't match the current best. */
  private skipStale(): void {
    while (this.heap.length > 0) {
      const { item, priority } = this.heap[0];
      const best = this.bestPriority.get(item);
      // Stale if: item was already popped (best === undefined)
      //        or a newer entry with lower priority exists (best < priority)
      if (best === undefined || best < priority) {
        const last = this.heap.pop()!;
        if (this.heap.length > 0) {
          this.heap[0] = last;
          this.sinkDown(0);
        }
      } else {
        break;
      }
    }
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.heap[i].priority < this.heap[parent].priority) {
        this.swap(i, parent);
        i = parent;
      } else {
        break;
      }
    }
  }

  private sinkDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;

      if (left < n && this.heap[left].priority < this.heap[smallest].priority) {
        smallest = left;
      }
      if (right < n && this.heap[right].priority < this.heap[smallest].priority) {
        smallest = right;
      }
      if (smallest === i) break;
      this.swap(i, smallest);
      i = smallest;
    }
  }

  private swap(a: number, b: number): void {
    [this.heap[a], this.heap[b]] = [this.heap[b], this.heap[a]];
  }
}

export { PriorityQueue };
