interface WsMessage {
  domain: string;
  type: string;
  payload: any;
}

export type { WsMessage };
