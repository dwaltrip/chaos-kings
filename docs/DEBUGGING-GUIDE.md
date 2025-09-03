# Debugging Guide - Tricky Patterns & Solutions

This document captures non-obvious debugging insights, gotchas, and solutions for common but tricky issues in our codebase. Refer to this when debugging complex issues or unexpected behavior.

## Zustand Store Patterns

### ❌ Infinite Re-render Loop: Hooks Inside Selectors

**Symptoms:**
- "Maximum update depth exceeded" error
- Exponential subscription creation logs
- App becomes unresponsive/crashes

**Root Cause:**
```typescript
// ❌ NEVER do this - calling hooks inside selectors
const useMySelector = () =>
  useShallow((state: StoreA) => {
    const externalData = useStoreB(selector); // Hook inside selector = death spiral
    return state.data + externalData;
  });
```

**Why This Breaks:**
1. Selector execution calls `useStoreB()` hook
2. Hook creates subscription to Store B
3. Subscription creation triggers selector re-execution
4. New selector execution creates another subscription
5. Infinite recursive loop until React gives up

**Solution Options:**

**Option 1: Component-Level Combination (Recommended default)**
```typescript
// ✅ Combine data at component level - simple and explicit
const MyComponent = () => {
  const dataA = useStoreA(state => state.data);
  const dataB = useStoreB(state => state.value);
  
  const combined = dataA + dataB; // Combine in component, not selector
  
  return <div>{combined}</div>;
};
```

**Option 2: Store-to-Store Subscriptions (For performance-critical cases)**
```typescript
// ✅ Cache external data in store setup
const useStoreA = create<StoreAState>((set, get) => {
  // Subscribe during store creation, not selector execution
  useStoreB.subscribe((stateBData) => {
    const current = get();
    if (current.cachedBData !== stateBData.value) {
      set({ cachedBData: stateBData.value });
    }
  });
  
  return {
    data: 'initial',
    cachedBData: useStoreB.getState().value, // Initialize with current value
  };
});

// ✅ Pure selector using cached data
const useMySelector = () =>
  useShallow((state: StoreAState) => 
    state.data + state.cachedBData
  );
```

**When to Use Which:**
- **Component-level (default)**: Simple dependencies, one-off combinations, easier debugging
- **Store-to-store (performance upgrade)**: 50+ components with same logic, complex derived state, consistency critical

**Key Insight:** Move cross-store dependencies from selector execution (runtime) to either store initialization (setup time) or component level.

### Store-to-Store Subscriptions Best Practices

**Pattern:**
```typescript
const useDependentStore = create<State>((set, get) => {
  // Set up subscriptions in store creator
  externalStore.subscribe((externalState) => {
    const currentState = get();
    if (currentState.cachedValue !== externalState.relevantValue) {
      set({ cachedValue: externalState.relevantValue });
    }
  });

  return {
    localData: 'initial',
    cachedValue: externalStore.getState().relevantValue,
  };
});
```

**Best Practices:**
1. Always check if cached value actually changed before calling `set()`
2. Initialize cached values with current state from external store
3. Use specific subscriptions - don't subscribe to entire store if you only need one field

---

## React + TypeScript Gotchas

### Rules of Hooks Violations

**Common Pattern:** Conditional hook calling
```typescript
// ❌ This will break
const MyComponent = () => {
  const [enabled, setEnabled] = useState(false);
  
  if (enabled) {
    const data = useMyHook(); // Conditional hook call
  }
  
  // ...
};
```

**Solution:** Always call hooks, conditionally use results
```typescript
// ✅ This works
const MyComponent = () => {
  const [enabled, setEnabled] = useState(false);
  const data = useMyHook(); // Always call hook
  
  const effectiveData = enabled ? data : null; // Conditionally use result
  // ...
};
```

---

## Performance Debugging

### Excessive Re-renders

**Debugging Tools:**
- Add render counters: `let renderCount = 0; console.log('render #', ++renderCount);`
- Log selector calls with timestamps
- Use React DevTools Profiler

**Common Causes:**
1. Non-memoized objects/arrays in selectors
2. Cross-store subscription loops
3. Over-broad selectors (selecting too much data)

---

## Future Sections

Add new sections here as we encounter more tricky patterns:

### Backend Patterns
*TODO: Add backend debugging patterns*

### WebSocket Issues  
*TODO: Add WebSocket debugging patterns*

### Database Query Gotchas
*TODO: Add Kysely/PostgreSQL patterns*

---

## How to Use This Guide

1. **When debugging:** Search for symptoms or error messages
2. **When reviewing code:** Check for anti-patterns listed here
3. **When adding new patterns:** Follow the format above with symptoms → cause → solution
4. **Keep it practical:** Focus on non-obvious issues that took time to figure out