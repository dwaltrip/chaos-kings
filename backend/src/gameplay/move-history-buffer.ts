import type { MoveEvent, MoveHistoryV1 } from '@core/replay/types';

class MoveHistoryBuffer {
  private events: MoveEvent[] = [];
  private lastFlushedCount = 0;

  append(events: MoveEvent[]): void {
    if (events.length === 0) return;
    this.events.push(...events);
  }

  getCount(): number {
    return this.events.length;
  }

  buildHistory(): MoveHistoryV1 {
    return { version: 1, events: this.events };
  }

  async flush(
    save: (history: MoveHistoryV1) => Promise<void>,
    force: boolean = false,
  ): Promise<void> {
    const count = this.events.length;
    if (!force && count === this.lastFlushedCount) return;
    await save(this.buildHistory());
    this.lastFlushedCount = count;
  }
}

export { MoveHistoryBuffer };
