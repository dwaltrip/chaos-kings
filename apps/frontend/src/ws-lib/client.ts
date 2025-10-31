import { ConnectionState } from './types';
import type { HandlerMap, WSClientConfig } from './types';

class WSClient<
  TIncoming extends { type: string; payload: unknown },
  TOutgoing extends { type: string; payload: unknown },
> {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private readonly handlers: HandlerMap<TIncoming>;
  private readonly messageQueue: TOutgoing[] = [];
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly config: Required<
    Omit<WSClientConfig, 'onStateChange' | 'onReconnectAttempt'>
  > & {
    onStateChange: NonNullable<WSClientConfig['onStateChange']>;
    onReconnectAttempt: NonNullable<WSClientConfig['onReconnectAttempt']>;
  };
  private shouldReconnect: boolean;

  constructor(
    url: string,
    handlers: HandlerMap<TIncoming>,
    config?: Partial<WSClientConfig>,
  ) {
    this.url = url;
    this.handlers = handlers;
    this.config = {
      url,
      reconnect: config?.reconnect ?? true,
      maxReconnectAttempts: config?.maxReconnectAttempts ?? 10,
      reconnectInterval: config?.reconnectInterval ?? 1000,
      onStateChange: config?.onStateChange ?? (() => {}),
      onReconnectAttempt: config?.onReconnectAttempt ?? (() => {}),
    };
    this.shouldReconnect = this.config.reconnect;

    this.connect();
  }

  send(message: TOutgoing) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return;
    }

    this.messageQueue.push(message);
  }

  disconnect() {
    this.shouldReconnect = false;
    this.config.onStateChange(ConnectionState.CLOSING);

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      this.ws.close();
    } else {
      this.config.onStateChange(ConnectionState.CLOSED);
    }

    this.ws = null;
  }

  getState(): ConnectionState {
    return (this.ws?.readyState as ConnectionState) ?? ConnectionState.CLOSED;
  }

  private isValidMessageType(type: string): type is TIncoming['type'] {
    return type in this.handlers;
  }

  private connect() {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.ws = new WebSocket(this.url);
    this.shouldReconnect = this.config.reconnect;
    this.config.onStateChange(ConnectionState.CONNECTING);

    this.ws.onopen = () => {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.reconnectAttempts = 0;
      this.config.onStateChange(ConnectionState.OPEN);
      this.config.onReconnectAttempt(this.reconnectAttempts);
      this.flushMessageQueue();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.ws.onerror = (event) => {
      console.error('WebSocket error:', event);
    };

    this.ws.onclose = () => {
      this.config.onStateChange(ConnectionState.CLOSED);
      this.scheduleReconnect();
    };
  }

  private handleMessage(rawMessage: string) {
    let parsed: unknown;

    try {
      parsed = JSON.parse(rawMessage);
    } catch (error) {
      console.error('Failed to parse incoming WebSocket message', error);
      return;
    }

    const message = parsed as TIncoming;

    if (!this.isValidMessageType(message.type)) {
      console.warn(`No handler registered for message type "${message.type}"`);
      return;
    }

    const handler = this.handlers[message.type];

    try {
      handler(message.payload);
    } catch (error) {
      console.error(`Error executing handler for message type "${message.type}"`, error);
    }
  }

  private flushMessageQueue() {
    while (
      this.messageQueue.length > 0 &&
      this.ws &&
      this.ws.readyState === WebSocket.OPEN
    ) {
      const message = this.messageQueue.shift();
      if (!message) {
        continue;
      }

      this.ws.send(JSON.stringify(message));
    }
  }

  private scheduleReconnect() {
    if (!this.shouldReconnect) {
      return;
    }

    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('Maximum WebSocket reconnect attempts reached');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts += 1;
      this.config.onReconnectAttempt(this.reconnectAttempts);
      this.connect();
    }, delay);
  }
}

export { WSClient };
