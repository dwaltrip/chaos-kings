import { ChatDemoStore as store  } from './chat-demo-store';

const ChatDemoWsHandler = {
  handleMessage: (payload: any) => {
    const { type, data } = payload;

    switch (type) {
      case 'new-chat-message':
        store.addMessage(data);
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
