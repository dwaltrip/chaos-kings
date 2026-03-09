// NOTE: Action batching. Currently each makeAction call triggers the full
// cycle (onChange → version++ → notify). If a user interaction needs
// multiple mutations in one cycle, add a batch() function here that
// suppresses onChange/notify during the batch and runs once at the end.

// NOTE: `derive` as a lib concept. Currently thin — calls a function and
// stores the result, guaranteeing it runs before onChange. May evolve or
// move out if the needs for managing dependencies between data values change
// (e.g. derived state that depends on other derived state, conditional
// derivation, etc.). It's nice to have in the lib as it enforces the sequencing
// of derived state updating before the rest of the update flow.

interface StoreConfig<State, Derived = {}> {
  initialState: State;
  derive?: (state: State) => Derived;
  onChange?: (merged: State & Derived) => void;
  onReset?: () => void;
}

function createStore<State, Derived = {}>(config: StoreConfig<State, Derived>) {
  let state = config.initialState;
  let derived = (config.derive ? config.derive(state) : {}) as Derived;
  let version = 0;
  const subscribers = new Set<() => void>();

  function getMerged(): State & Derived {
    return { ...state, ...derived } as State & Derived;
  }

  function runLifecycle(): void {
    if (config.derive) {
      derived = config.derive(state);
      warnDerivedKeyCollisions(state, derived);
    }
    config.onChange?.(getMerged());
    version++;
    for (const cb of subscribers) cb();
  }

  function makeAction<Args extends unknown[]>(
    fn: (state: State, ...args: Args) => void,
  ): (...args: Args) => void {
    return (...args: Args) => {
      fn(state, ...args);
      runLifecycle();
    };
  }

  function subscribe(cb: () => void): () => void {
    subscribers.add(cb);
    return () => subscribers.delete(cb);
  }

  function reset(newState: State): void {
    state = newState;
    config.onReset?.();
    if (config.derive) {
      derived = config.derive(state);
    }
    config.onChange?.(getMerged());
    version = 0;
    for (const cb of subscribers) cb();
  }

  return {
    get state() {
      return state;
    },
    get derived() {
      return derived;
    },
    get version() {
      return version;
    },
    makeAction,
    subscribe,
    reset,
  };
}

function warnDerivedKeyCollisions<State, Derived>(state: State, derived: Derived): void {
  if (process.env.NODE_ENV !== 'production' && derived && typeof derived === 'object') {
    const stateKeys = Object.keys(state as object);
    const derivedKeys = Object.keys(derived as object);
    for (const key of derivedKeys) {
      if (stateKeys.includes(key)) {
        console.warn(
          `[createStore] Derived key "${key}" collides with a state key. ` +
            `The derived value will overwrite the state value in the merged object.`,
        );
      }
    }
  }
}

export type { StoreConfig };
export { createStore };
