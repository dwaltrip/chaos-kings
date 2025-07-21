import { ChatDemoStore as store  } from './chat-demo-store';

const LOG_PREFIX = '[chat-demo-ws-handler]';
const logger = (...args: any[]) => console.log(LOG_PREFIX, ...args);
logger.warn = (...args: any[]) => console.warn(LOG_PREFIX, ...args);

const ChatDemoWsHandler = {
  handleMessage: (payload: any) => { 
    const { type, data, user, timestamp } = payload;
    console.log('-------------------------------------------------------')
    logger(`Received msg (type=${type})`, data);
    logger(`user: ${user}, timestamp: ${timestamp}`);

    switch (type) {
      case 'chat-message':
        logger(`New chat message:`, data);
        store.addMessage({ ...data, user, timestamp });
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
