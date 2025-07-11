import { getWebSocketService, type RoomMessage } from '../services/websocket-service';
import { useChatDemoStore } from './chat-demo-store';

let removeConnectionListener: (() => void) | null = null;
let removeMessageListener: (() => void) | null = null;

export const chatDemoActions = {
  initialize() {
    const wsService = getWebSocketService();
    const store = useChatDemoStore.getState();

    // Clean up existing listeners
    if (removeConnectionListener) {
      removeConnectionListener();
    }
    if (removeMessageListener) {
      removeMessageListener();
    }

    // Set up connection state listener
    removeConnectionListener = wsService.addConnectionStateListener((isConnected) => {
      useChatDemoStore.getState().setIsConnected(isConnected);
      
      // Auto-join current room when connected
      if (isConnected) {
        this.joinRoom(store.currentRoom);
      }
    });

    // Set up message listener
    removeMessageListener = wsService.addRoomMessageListener((message: RoomMessage) => {
      if (message.type === 'chat') {
        useChatDemoStore.getState().addMessage(message);
      }
    });
  },

  sendMessage(message: string, username: string, room: string) {
    const wsService = getWebSocketService();
    
    if (!wsService.getConnectionState() || !message.trim() || !username.trim()) {
      return;
    }

    const roomMessage: RoomMessage = {
      user: username,
      message: message.trim(),
      timestamp: Date.now(),
      room,
      type: 'chat'
    };

    wsService.send(roomMessage);
    useChatDemoStore.getState().setCurrentMessage('');
  },

  joinRoom(roomId: string) {
    const wsService = getWebSocketService();
    
    if (!wsService.getConnectionState()) {
      return;
    }

    const joinMessage: RoomMessage = {
      user: '',
      message: '',
      timestamp: Date.now(),
      room: roomId,
      type: 'join'
    };

    wsService.send(joinMessage);
    wsService.setCurrentRoom(roomId);
  },

  leaveRoom(roomId: string) {
    const wsService = getWebSocketService();
    
    if (!wsService.getConnectionState()) {
      return;
    }

    const leaveMessage: RoomMessage = {
      user: '',
      message: '',
      timestamp: Date.now(),
      room: roomId,
      type: 'leave'
    };

    wsService.send(leaveMessage);
    wsService.setCurrentRoom(undefined);
  },

  changeRoom(newRoom: string) {
    const store = useChatDemoStore.getState();
    
    if (newRoom !== store.currentRoom) {
      // Leave current room if we're in one
      if (store.currentRoom) {
        this.leaveRoom(store.currentRoom);
      }
      
      // Clear messages and update room
      store.clearMessages();
      store.setCurrentRoom(newRoom);
      
      // Join new room
      this.joinRoom(newRoom);
    }
  },

  createAndJoinRoom(roomName: string) {
    if (!roomName.trim()) {
      return;
    }
    
    this.changeRoom(roomName.trim());
    useChatDemoStore.getState().setNewRoomName('');
  },

  cleanup() {
    if (removeConnectionListener) {
      removeConnectionListener();
      removeConnectionListener = null;
    }
    if (removeMessageListener) {
      removeMessageListener();
      removeMessageListener = null;
    }
  }
};