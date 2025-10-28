async function requireEntity<T>(
  entity: Promise<T | null>,
  errorMessage: string,
): Promise<T> {
  const result = await entity;
  if (!result) {
    throw new Error(errorMessage);
  }
  return result;
}

export { requireEntity };
