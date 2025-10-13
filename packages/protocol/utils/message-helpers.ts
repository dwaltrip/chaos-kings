type MessageShapeMap = Record<string, unknown>;

type MessageUnion<TMap extends MessageShapeMap> = {
  [TType in keyof TMap]: {
    type: TType extends string ? TType : never;
    payload: TMap[TType];
  };
}[keyof TMap];

type MessageType<TUnion extends { type: string }> = TUnion['type'];

type PayloadFor<
  TUnion extends { type: string; payload: unknown },
  TType extends MessageType<TUnion>,
> = Extract<TUnion, { type: TType }>['payload'];

type HandlerMap<TUnion extends { type: string; payload: unknown }> = {
  [TType in MessageType<TUnion>]: (payload: PayloadFor<TUnion, TType>) => void;
};

type HandlerMapWithCtx<TUnion extends { type: string; payload: unknown }, TCtx> = {
  [TType in MessageType<TUnion>]: (payload: PayloadFor<TUnion, TType>, ctx: TCtx) => void;
};

export type {
  MessageShapeMap,
  MessageUnion,
  MessageType,
  PayloadFor,
  HandlerMap,
  HandlerMapWithCtx,
};
