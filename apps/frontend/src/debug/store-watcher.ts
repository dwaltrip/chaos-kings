import type { StoreApi } from 'zustand';

import type { AddEntryFn } from './types';

type Unsubscribe = () => void;

interface StoreWatcher {
  watchStore: (name: string, store: StoreApi<unknown>) => Unsubscribe;
  unwatchAll: () => void;
}

function createStoreWatcher(addEntry: AddEntryFn): StoreWatcher {
  const subscriptions = new Map<string, Unsubscribe>();

  function watchStore(name: string, store: StoreApi<unknown>): Unsubscribe {
    // Don't double-subscribe
    if (subscriptions.has(name)) {
      return subscriptions.get(name)!;
    }

    let prevState = store.getState();

    const unsubscribe = store.subscribe((state) => {
      // Capture full state snapshot
      addEntry('store-change', name, structuredClone(state), {
        prevValue: structuredClone(prevState),
      });
      prevState = state;
    });

    // Wrap unsubscribe to also remove from our map
    const wrappedUnsubscribe = () => {
      unsubscribe();
      subscriptions.delete(name);
    };

    subscriptions.set(name, wrappedUnsubscribe);
    return wrappedUnsubscribe;
  }

  function unwatchAll(): void {
    subscriptions.forEach((unsubscribe) => unsubscribe());
    subscriptions.clear();
  }

  return { watchStore, unwatchAll };
}

export { createStoreWatcher };
