import type { AddEntryFn, ConsoleLevel } from './types';

type OriginalConsoleMethods = {
  log: typeof console.log;
  warn: typeof console.warn;
  error: typeof console.error;
};

let originalMethods: OriginalConsoleMethods | null = null;
let isCapturing = false;

function startConsoleCapture(addEntry: AddEntryFn): void {
  if (isCapturing) return;

  originalMethods = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  const createInterceptor = (level: ConsoleLevel) => {
    return (...args: unknown[]) => {
      // Call original method
      originalMethods![level](...args);

      // Capture the log
      const message = args
        .map((arg) => {
          if (typeof arg === 'string') return arg;
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        })
        .join(' ');

      addEntry('console', message, args, { level });
    };
  };

  console.log = createInterceptor('log');
  console.warn = createInterceptor('warn');
  console.error = createInterceptor('error');

  isCapturing = true;
}

function stopConsoleCapture(): void {
  if (!isCapturing || !originalMethods) return;

  console.log = originalMethods.log;
  console.warn = originalMethods.warn;
  console.error = originalMethods.error;

  originalMethods = null;
  isCapturing = false;
}

function isConsoleCapturing(): boolean {
  return isCapturing;
}

export { startConsoleCapture, stopConsoleCapture, isConsoleCapturing };
