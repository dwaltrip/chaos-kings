class InvariantError extends Error {
  constructor(message?: string) {
    super(message || 'Invariant failed.');
    this.name = 'InvariantError';
    Error.captureStackTrace?.(this, invariant);
  }
}

function invariant(condition: boolean, message?: string): asserts condition {
  if (!condition) {
    throw new InvariantError(message);
  }
}

export { invariant };
