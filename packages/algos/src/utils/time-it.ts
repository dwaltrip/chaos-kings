function timeIt<T>(func: () => T): {
  result: T;
  time: number;
} {
  const t0 = performance.now();
  const result = func();
  const time = performance.now() - t0;
  return { result, time };
}

export { timeIt };
