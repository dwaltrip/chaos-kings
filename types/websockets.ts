
interface WsMessage {
  domain: string;
  payload: {
    type: string;
    data: any;
  }
  user: string;
  timestamp: number;
}

export type { WsMessage };
