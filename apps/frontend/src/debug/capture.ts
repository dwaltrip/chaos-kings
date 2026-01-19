import type { StoreApi } from 'zustand';

import type { DebugConfig, DebugEntry, DebugOutput } from './types';
import { startConsoleCapture, stopConsoleCapture } from './console-interceptor';
import { createStoreWatcher } from './store-watcher';

const DEFAULT_CONFIG: DebugConfig = {
  maxEntries: 1000,
  autoStartConsole: false,
};

interface DebugCapture {
  snapshot: (label: string, data?: Record<string, unknown>) => void;
  startTrace: (name: string) => void;
  endTrace: () => DebugOutput;
  watchStore: (name: string, store: StoreApi<unknown>) => () => void;
  unwatchAll: () => void;
  startConsoleCapture: () => void;
  stopConsoleCapture: () => void;
  getOutput: () => DebugOutput;
  save: (name?: string) => Promise<string>;
  dump: () => void;
  clear: () => void;
}

function createDebugCapture(config: Partial<DebugConfig> = {}): DebugCapture {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  let sessionId = generateSessionId();
  let sessionStartedAt = performance.now();
  let traceName: string | null = null;
  let entries: DebugEntry[] = [];

  function generateSessionId(): string {
    return `debug-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function addEntry(
    type: DebugEntry['type'],
    label: string,
    data: unknown,
    meta?: DebugEntry['meta'],
  ): void {
    const timestamp = performance.now() - sessionStartedAt;

    entries.push({ timestamp, type, label, data, meta });

    // Ring buffer: remove oldest if over limit
    if (entries.length > cfg.maxEntries) {
      entries = entries.slice(-cfg.maxEntries);
    }
  }

  const storeWatcher = createStoreWatcher(addEntry);

  function snapshot(label: string, data?: Record<string, unknown>): void {
    addEntry('snapshot', label, data ?? null);
  }

  function startTrace(name: string): void {
    clear();
    traceName = name;
  }

  function endTrace(): DebugOutput {
    const output = getOutput();
    output.endedAt = performance.now() - sessionStartedAt;

    // Auto-save on trace end
    save().catch((err) => {
      console.error('[debug] Failed to auto-save trace:', err);
    });

    traceName = null;

    return output;
  }

  function getOutput(): DebugOutput {
    return {
      sessionId,
      traceName,
      startedAt: sessionStartedAt,
      endedAt: null,
      entries: [...entries],
    };
  }

  async function save(name?: string): Promise<string> {
    const output = getOutput();
    output.endedAt = performance.now() - sessionStartedAt;

    const payload = {
      ...output,
      saveName: name ?? null,
    };

    try {
      const response = await fetch('/__debug_save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload, null, 2),
      });

      if (!response.ok) {
        throw new Error(`Save failed: ${response.status}`);
      }

      const result = await response.json();
      console.log(`[debug] Saved to ${result.path}`);
      return result.path;
    } catch (err) {
      console.error('[debug] Save failed:', err);
      throw err;
    }
  }

  function dump(): void {
    const output = getOutput();
    output.endedAt = performance.now() - sessionStartedAt;

    console.group(`[debug] Session: ${sessionId}`);
    console.log('Trace:', traceName ?? '(none)');
    console.log('Entries:', entries.length);
    console.log('Duration:', output.endedAt.toFixed(2), 'ms');
    console.log('---');

    entries.forEach((entry) => {
      const prefix = `[${entry.timestamp.toFixed(1)}ms] ${entry.type}:`;
      console.log(prefix, entry.label, entry.data);
    });

    console.groupEnd();
  }

  function clear(): void {
    sessionId = generateSessionId();
    sessionStartedAt = performance.now();
    traceName = null;
    entries = [];
  }

  // Initialize console capture if configured
  if (cfg.autoStartConsole) {
    startConsoleCapture(addEntry);
  }

  return {
    snapshot,
    startTrace,
    endTrace,
    watchStore: storeWatcher.watchStore,
    unwatchAll: storeWatcher.unwatchAll,
    startConsoleCapture: () => startConsoleCapture(addEntry),
    stopConsoleCapture,
    getOutput,
    save,
    dump,
    clear,
  };
}

export { createDebugCapture };
export type { DebugCapture };
