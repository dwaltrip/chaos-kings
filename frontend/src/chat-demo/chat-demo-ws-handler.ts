import { chatStore } from '@/chat-demo/chat-demo-store';
import type { WsMessage } from '@common/types/websockets';
import type { ChatMessage } from '@/chat-demo/types';

const { actions } = chatStore.getState();

const LOG_PREFIX = '[chat-demo-ws-handler]';
const logger = (...args: any[]) => console.log(LOG_PREFIX, ...args);
logger.warn = (...args: any[]) => console.warn(LOG_PREFIX, ...args);

const ChatDemoWsHandler = {
  handleMessage: (data: WsMessage) => { 
    const { type, payload } = data;
    const user = payload.user || '??';
    const date = payload.timestamp ? new Date(payload.timestamp) : '-'
    console.log('-------------------------------------------------------')
    logger(`Received msg (type=${type})`, data);
    logger(`user: ${user}, time: ${date}`);

    switch (type) {
      case 'new-message':
        logger(`New chat message:`, data);
        actions.addMessage(data.payload as ChatMessage);
        break;
      // case 'room-change':
      //   store.setCurrentRoom(data.room);
      //   break;
      // case 'user-joined':
      //   store.addUser(data.user);
      //   break;
      default:
        logger.warn(`Unknown message type: ${type}`);
    }
  }
}

export { ChatDemoWsHandler };
