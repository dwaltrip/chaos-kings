import type { User } from "@common/types/user";

interface WsMessage {
  domain: string;
  type: string;
  payload: any;
  user?: User;
}

export type { WsMessage };

