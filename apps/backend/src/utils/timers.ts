/**
 * Simple wrapper around setTimeout for cleaner timer management.
 * Handles null checks and safe cancellation internally.
 */
class Timeout {
  private id: NodeJS.Timeout | null = null;

  start(callback: () => void, ms: number): void {
    this.cancel();
    this.id = setTimeout(callback, ms);
  }

  cancel(): void {
    if (this.id) {
      clearTimeout(this.id);
      this.id = null;
    }
  }

  isActive(): boolean {
    return this.id !== null;
  }
}

/**
 * Simple wrapper around setInterval for cleaner interval management.
 * Handles null checks and safe cancellation internally.
 */
class Interval {
  private id: NodeJS.Timeout | null = null;

  start(callback: () => void, ms: number): void {
    this.cancel();
    this.id = setInterval(callback, ms);
  }

  cancel(): void {
    if (this.id) {
      clearInterval(this.id);
      this.id = null;
    }
  }

  isActive(): boolean {
    return this.id !== null;
  }
}

export { Timeout, Interval };
