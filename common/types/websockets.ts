import type { User } from '@common/types/user';

// TODO: Differentaite between client and server messages???
// Client messsages never contain user info, we get it from connection info
// ON the backend the manager hydrates the user info into the message
interface WsMessage {
  domain: string;
  type: string;
  payload: any;
}

interface WsServerMessage extends WsMessage {
  user: User;
}
interface WsClientMessage extends WsMessage {}

interface WsDomainHandler {
  handleMessage: (data: WsMessage) => void;
}

export type { WsMessage, WsServerMessage, WsClientMessage, WsDomainHandler };
