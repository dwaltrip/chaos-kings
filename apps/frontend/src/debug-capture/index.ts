import type { StoreApi } from 'zustand';

import { createDebugCapture } from './capture';
import type { DebugConfig } from './types';

// Re-export types for external use
export type { DebugOutput, DebugEntry, DebugConfig } from './types';
export type { DebugCapture } from './capture';

// Extend window type
declare global {
  interface Window {
    debug: DebugAPI | undefined;
  }
}

interface DebugAPI {
  // Core API
  snapshot: (label: string, data?: Record<string, unknown>) => void;
  startTrace: (name: string) => void;
  endTrace: () => void;
  watchStore: (name: string, store: StoreApi<unknown>) => () => void;
  unwatchAll: () => void;
  startConsoleCapture: () => void;
  stopConsoleCapture: () => void;
  save: (name?: string) => Promise<string>;
  dump: () => void;
  clear: () => void;

  // Convenience: register a store for easy watching
  registerStore: (name: string, store: StoreApi<unknown>) => void;
  watch: (storeName: string) => () => void;
  watchAll: () => void;
}

let debugInstance: ReturnType<typeof createDebugCapture> | null = null;
const registeredStores = new Map<string, StoreApi<unknown>>();

// Check if this page was opened with a debug capture session param
function getDebugSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('debug_capture');
}

function isDebugCaptureSession(): boolean {
  return getDebugSessionId() !== null;
}

function initializeDebug(config: Partial<DebugConfig> = {}): void {
  if (typeof window === 'undefined') return;
  if (!import.meta.env.DEV) return;

  debugInstance = createDebugCapture(config);

  const api: DebugAPI = {
    // Core API pass-through
    snapshot: debugInstance.snapshot,
    startTrace: debugInstance.startTrace,
    endTrace: () => {
      debugInstance!.endTrace();
    },
    watchStore: debugInstance.watchStore,
    unwatchAll: debugInstance.unwatchAll,
    startConsoleCapture: debugInstance.startConsoleCapture,
    stopConsoleCapture: debugInstance.stopConsoleCapture,
    save: debugInstance.save,
    dump: debugInstance.dump,
    clear: debugInstance.clear,

    // Store registry for convenience
    registerStore: (name: string, store: StoreApi<unknown>) => {
      registeredStores.set(name, store);
    },

    watch: (storeName: string) => {
      const store = registeredStores.get(storeName);
      if (!store) {
        console.error(
          `[debug] Store "${storeName}" not registered. Available:`,
          Array.from(registeredStores.keys()),
        );
        return () => {};
      }
      return debugInstance!.watchStore(storeName, store);
    },

    watchAll: () => {
      registeredStores.forEach((store, name) => {
        debugInstance!.watchStore(name, store);
      });
    },
  };

  window.debug = api;

  console.log('[debug] Debug capture initialized. Available commands:');
  console.log('  debug.snapshot(label, data?) - Capture a snapshot');
  console.log('  debug.startTrace(name)       - Start a named trace');
  console.log('  debug.endTrace()             - End trace and auto-save');
  console.log('  debug.watch(storeName)       - Watch a registered store');
  console.log('  debug.watchAll()             - Watch all registered stores');
  console.log('  debug.startConsoleCapture()  - Start capturing console logs');
  console.log('  debug.save(name?)            - Save to .debug/{sessionId}[-name].json');
  console.log('  debug.dump()                 - Pretty-print to console');
  console.log('  debug.clear()                - Clear all captured data');
}

function registerDebugStore(name: string, store: StoreApi<unknown>): void {
  registeredStores.set(name, store);
}

export { initializeDebug, registerDebugStore, isDebugCaptureSession, getDebugSessionId };
