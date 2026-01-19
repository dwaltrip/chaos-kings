interface DebugOutput {
  sessionId: string;
  traceName: string | null;
  startedAt: number;
  endedAt: number | null;
  entries: DebugEntry[];
}

interface DebugEntry {
  timestamp: number; // ms since session start
  type: 'snapshot' | 'store-change' | 'console';
  label: string;
  data: unknown;
  meta?: {
    level?: 'log' | 'warn' | 'error'; // for console entries
    prevValue?: unknown; // for store changes
  };
}

interface DebugConfig {
  maxEntries: number;
  autoStartConsole: boolean;
}

type ConsoleLevel = 'log' | 'warn' | 'error';

type AddEntryFn = (
  type: DebugEntry['type'],
  label: string,
  data: unknown,
  meta?: DebugEntry['meta'],
) => void;

export type { DebugOutput, DebugEntry, DebugConfig, ConsoleLevel, AddEntryFn };
