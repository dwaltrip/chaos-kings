// Useful for debugging

interface RenderCount {
  count: number;
  lastLogged: number;
}

const RENDER_COUNTER_LOG_INTERVAL_MS = 1000;
let counts = new Map<string, RenderCount>();

function useRenderCounter(key: string) {
  // TODO: why are returning a function, instead of just directly running the code?
  return () => {
    const now = Date.now();
    const info = counts.get(key) || { count: 0, lastLogged: now };
    info.count++;
    counts.set(key, info);
    if (now - info.lastLogged > RENDER_COUNTER_LOG_INTERVAL_MS) {
      // Log every 1000ms to batch renders
      console.log(
        `[${new Date().toISOString()}] [perf:${key}]` +
          ' ' +
          `${info.count} calls in last ${now - info.lastLogged}ms`,
      );
      info.count = 0;
      info.lastLogged = now;
    }
  };
}

export { useRenderCounter };
