type Brand<K, T> = K & { __brand: T };

function idToNumber<T extends string>(id: Brand<number, T>): number {
  return id as number;
}

function idToString<T extends string>(id: Brand<string, T>): string {
  return id as string;
}

export type { Brand };
export { idToNumber, idToString };
