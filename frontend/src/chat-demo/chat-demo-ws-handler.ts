import { ChatDemoStore as store  } from './chat-demo-store';

const ChatDemoWsHandler = {
  handleMessage: (payload: any) => {
    const { type, data, user, timestamp } = payload;
    console.log('-------------------------------------------------------')
    console.log(`[chat-demo-ws-handler] Received msg (type=${type})`, data);
    console.log(`[chat-demo-ws-handler] user: ${user}, timestamp: ${timestamp}`);

    switch (type) {
      case 'chat-message':
        console.log(`[chat-demo-ws-handler] New chat message:`, data);
        store.addMessage({ ...data, user, timestamp });
        break;
      // case 'room-change':
      //   store.setCurrentRoom(data.room);
      //   break;
      // case 'user-joined':
      //   store.addUser(data.user);
      //   break;
      default:
        console.warn(`[ws-message-handler] Unknown message type: ${type}`);
    }
  }
}

export { ChatDemoWsHandler };
