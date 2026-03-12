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

  /** Insert an item with a given priority. If the item already exists
   *  with a higher (worse) priority, updates it to the new priority. */
  insert(item: T, priority: number): void;

  /** Lower the priority of an existing item.
   *  - If the item doesn't exist, inserts it with the given priority.
   *  - If the new priority isn't strictly lower, this is a no-op. */
  decreasePriority(item: T, newPriority: number): void;

  /** Return the item with the lowest priority without removing it,
   *  or undefined if the queue is empty. */
  peek(): { item: T; priority: number } | undefined;

  /** Remove and return the item with the lowest priority,
   *  or undefined if the queue is empty. */
  pop(): { item: T; priority: number } | undefined;

  /** Check whether an item is currently in the queue. */
  has(item: T): boolean;
}
