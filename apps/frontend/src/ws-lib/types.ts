const ConnectionState = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
} as const;

type ConnectionState = (typeof ConnectionState)[keyof typeof ConnectionState];

type MessageHandler<TMessage extends { type: string; payload: unknown }> = (
  payload: TMessage['payload'],
) => void | Promise<void>;

type HandlerMap<TMessage extends { type: string; payload: unknown }> = {
  [K in TMessage['type']]: MessageHandler<Extract<TMessage, { type: K }>>;
};

type WSClientConfig = {
  url: string;
  reconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
  onStateChange?: (state: ConnectionState) => void;
  onReconnectAttempt?: (attempt: number) => void;
};

interface WsBridge<TMessage> {
  send(message: TMessage): void;
}

export { ConnectionState };
export type { MessageHandler, HandlerMap, WSClientConfig, WsBridge };
