type EmptyPayload = Record<string, never>;

type ExtractMsg<MsgUnion, MsgType> = Extract<MsgUnion, { type: MsgType }>;

export type { EmptyPayload, ExtractMsg };
