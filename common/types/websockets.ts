import type { User } from "./user";

interface WsMessage {
  domain: string;
  type: string;
  payload: any;
  user?: User;
}

export type { WsMessage };
