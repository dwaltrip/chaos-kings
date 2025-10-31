import type { WSClient } from './client';

class ClientBridge<TMessage extends { type: string; payload: unknown }> {
  private client: WSClient<any, TMessage> | null = null;

  init(client: WSClient<any, TMessage>) {
    if (this.client) {
      throw new Error('ClientBridge already initialized');
    }
    this.client = client;
  }

  reset() {
    this.client = null;
  }

  send(message: TMessage) {
    this.getClient().send(message);
  }

  private getClient() {
    if (!this.client) {
      throw new Error('ClientBridge not initialized. Call init() first.');
    }
    return this.client;
  }
}

export { ClientBridge };
