/**
 * Minimal interface for a min priority queue with lazy deletion support.
 *
 * Items must be usable as Map keys (primitives or object references).
 */
export interface IPriorityQueue<T> {
  /** Number of logical items currently in the queue. */
  readonly size: number;

  /** True if the queue contains no items. */
  isEmpty(): boolean;

  /** Insert an item with a given priority, or decrease its priority if
   *  it already exists with a higher (worse) value. No-op if the item
   *  already has an equal or lower priority. */
  insertOrDecrease(item: T, priority: number): void;

  /** Return the item with the lowest priority without removing it,
   *  or undefined if the queue is empty. */
  peek(): { item: T; priority: number } | undefined;

  /** Remove and return the item with the lowest priority,
   *  or undefined if the queue is empty. */
  pop(): { item: T; priority: number } | undefined;

  /** Check whether an item is currently in the queue. */
  has(item: T): boolean;
}
