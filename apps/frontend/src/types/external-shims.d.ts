declare module 'react' {
  type EffectCallback = () => void | (() => void);
  type DependencyList = ReadonlyArray<unknown>;

  export function useEffect(effect: EffectCallback, deps?: DependencyList): void;
  export function useState<S>(
    initialState: S | (() => S),
  ): [S, (value: S | ((prevState: S) => S)) => void];
}

declare module 'zustand' {
  type SetState<TState> = (
    partial: Partial<TState> | ((state: TState) => Partial<TState>),
    replace?: boolean,
  ) => void;
  type GetState<TState> = () => TState;
  type StateCreator<TState> = (
    setState: SetState<TState>,
    getState: GetState<TState>,
  ) => TState;

  type StoreApi<TState> = {
    (): TState;
    <Selected>(selector: (state: TState) => Selected): Selected;
    getState: GetState<TState>;
    setState: SetState<TState>;
    subscribe: (listener: (state: TState) => void) => () => void;
  };

  export function create<TState>(creator: StateCreator<TState>): StoreApi<TState>;
  export default create;
}
