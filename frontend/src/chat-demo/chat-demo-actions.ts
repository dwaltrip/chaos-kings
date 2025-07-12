import { getWebSocketService, type RoomMessage } from '../services/websocket-service';
import { useChatDemoStore } from './chat-demo-store';

let removeConnectionListener: (() => void) | null = null;
let removeMessageListener: (() => void) | null = null;

export const chatDemoActions = {
  initialize() {
    console.log(`[Chat-Actions] Initializing chat demo`);
    const wsService = getWebSocketService();
    const store = useChatDemoStore.getState();
    console.log(`[Chat-Actions] Current room from store: ${store.currentRoom}`);

    // Clean up existing listeners
    if (removeConnectionListener) {
      console.log(`[Chat-Actions] Cleaning up existing connection listener`);
      removeConnectionListener();
    }
    if (removeMessageListener) {
      console.log(`[Chat-Actions] Cleaning up existing message listener`);
      removeMessageListener();
    }

    // Set up connection state listener
    console.log(`[Chat-Actions] Setting up connection state listener`);
    removeConnectionListener = wsService.addConnectionStateListener((isConnected) => {
      console.log(`[Chat-Actions] Connection state changed: ${isConnected}`);
      const currentStore = useChatDemoStore.getState();
      currentStore.setIsConnected(isConnected);
      
      // Auto-join current room when connected
      if (isConnected) {
        console.log(`[Chat-Actions] Auto-joining room: ${currentStore.currentRoom}`);
        this.joinRoom(currentStore.currentRoom);
      }
    });

    // Set up message listener
    console.log(`[Chat-Actions] Setting up message listener`);
    removeMessageListener = wsService.addRoomMessageListener((message: RoomMessage) => {
      console.log(`[Chat-Actions] Received room message:`, message);
      if (message.type === 'chat') {
        console.log(`[Chat-Actions] Adding chat message to store: "${message.message}" from ${message.user} in room ${message.room}`);
        useChatDemoStore.getState().addMessage(message);
      } else {
        console.log(`[Chat-Actions] Ignoring non-chat room message type: ${message.type}`);
      }
    });
    
    // If already connected, join the current room immediately
    if (wsService.getConnectionState()) {
      console.log(`[Chat-Actions] Already connected, immediately joining room: ${store.currentRoom}`);
      this.joinRoom(store.currentRoom);
    }
    
    console.log(`[Chat-Actions] Initialization complete`);
  },

  sendMessage(message: string, username: string, room: string) {
    console.log(`[Chat-Actions] Attempting to send message: "${message}" from ${username} in room ${room}`);
    const wsService = getWebSocketService();
    
    if (!wsService.getConnectionState()) {
      console.error(`[Chat-Actions] ❌ Cannot send message: Not connected`);
      return;
    }
    
    if (!message.trim()) {
      console.error(`[Chat-Actions] ❌ Cannot send message: Message is empty`);
      return;
    }
    
    if (!username.trim()) {
      console.error(`[Chat-Actions] ❌ Cannot send message: Username is empty`);
      return;
    }

    const roomMessage: RoomMessage = {
      user: username,
      message: message.trim(),
      timestamp: Date.now(),
      room,
      type: 'chat'
    };

    console.log(`[Chat-Actions] Sending room message:`, roomMessage);
    wsService.send(roomMessage);
    console.log(`[Chat-Actions] Clearing current message from store`);
    useChatDemoStore.getState().setCurrentMessage('');
  },

  joinRoom(roomId: string) {
    console.log(`[Chat-Actions] Attempting to join room: ${roomId}`);
    const wsService = getWebSocketService();
    
    if (!wsService.getConnectionState()) {
      console.error(`[Chat-Actions] ❌ Cannot join room: Not connected`);
      return;
    }

    const joinMessage: RoomMessage = {
      user: '',
      message: '',
      timestamp: Date.now(),
      room: roomId,
      type: 'join'
    };

    console.log(`[Chat-Actions] Sending join message:`, joinMessage);
    wsService.send(joinMessage);
    console.log(`[Chat-Actions] Setting current room in service: ${roomId}`);
    wsService.setCurrentRoom(roomId);
  },

  leaveRoom(roomId: string) {
    console.log(`[Chat-Actions] Attempting to leave room: ${roomId}`);
    const wsService = getWebSocketService();
    
    if (!wsService.getConnectionState()) {
      console.error(`[Chat-Actions] ❌ Cannot leave room: Not connected`);
      return;
    }

    const leaveMessage: RoomMessage = {
      user: '',
      message: '',
      timestamp: Date.now(),
      room: roomId,
      type: 'leave'
    };

    console.log(`[Chat-Actions] Sending leave message:`, leaveMessage);
    wsService.send(leaveMessage);
    console.log(`[Chat-Actions] Clearing current room in service`);
    wsService.setCurrentRoom(undefined);
  },

  changeRoom(newRoom: string) {
    console.log(`[Chat-Actions] Attempting to change room to: ${newRoom}`);
    const store = useChatDemoStore.getState();
    console.log(`[Chat-Actions] Current room in store: ${store.currentRoom}`);
    
    if (newRoom !== store.currentRoom) {
      // Leave current room if we're in one
      if (store.currentRoom) {
        console.log(`[Chat-Actions] Leaving current room: ${store.currentRoom}`);
        this.leaveRoom(store.currentRoom);
      }
      
      // Clear messages and update room
      console.log(`[Chat-Actions] Clearing messages and updating store room to: ${newRoom}`);
      store.clearMessages();
      store.setCurrentRoom(newRoom);
      
      // Join new room
      console.log(`[Chat-Actions] Joining new room: ${newRoom}`);
      this.joinRoom(newRoom);
    } else {
      console.log(`[Chat-Actions] Already in room ${newRoom}, no change needed`);
    }
  },

  createAndJoinRoom(roomName: string) {
    console.log(`[Chat-Actions] Attempting to create and join room: "${roomName}"`);
    if (!roomName.trim()) {
      console.error(`[Chat-Actions] ❌ Cannot create room: Name is empty`);
      return;
    }
    
    const trimmedName = roomName.trim();
    console.log(`[Chat-Actions] Creating room with trimmed name: "${trimmedName}"`);
    this.changeRoom(trimmedName);
    console.log(`[Chat-Actions] Clearing new room name from store`);
    useChatDemoStore.getState().setNewRoomName('');
  },

  cleanup() {
    console.log(`[Chat-Actions] Cleaning up chat demo actions`);
    if (removeConnectionListener) {
      console.log(`[Chat-Actions] Removing connection listener`);
      removeConnectionListener();
      removeConnectionListener = null;
    }
    if (removeMessageListener) {
      console.log(`[Chat-Actions] Removing message listener`);
      removeMessageListener();
      removeMessageListener = null;
    }
    console.log(`[Chat-Actions] Cleanup complete`);
  }
};