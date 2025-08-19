import type { User } from '@common/types/user';

interface WsMessage {
  domain: string;
  type: string;
  payload: any;
  user?: User;
}
interface WsDomainHandler {
  handleMessage: (data: WsMessage) => void;
}

export type { WsMessage, WsDomainHandler };
