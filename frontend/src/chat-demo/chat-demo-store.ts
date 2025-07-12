import { create } from 'zustand';
import { type RoomMessage } from '../services/websocket-service';

interface ChatDemoState {
  messages: RoomMessage[];
  username: string;
  currentRoom: string;
  isConnected: boolean;
  currentMessage: string;
  newRoomName: string;
  
  setMessages: (messages: RoomMessage[]) => void;
  addMessage: (message: RoomMessage) => void;
  setUsername: (username: string) => void;
  setCurrentRoom: (room: string) => void;
  setIsConnected: (connected: boolean) => void;
  setCurrentMessage: (message: string) => void;
  setNewRoomName: (name: string) => void;
  clearMessages: () => void;
}

export const useChatDemoStore = create<ChatDemoState>((set) => ({
  messages: [],
  username: '',
  currentRoom: 'general',
  isConnected: false,
  currentMessage: '',
  newRoomName: '',
  
  setMessages: (messages) => {
    console.log(`[Chat-Store] Setting ${messages.length} messages`);
    set({ messages });
  },
  addMessage: (message) => {
    console.log(`[Chat-Store] Adding message to store:`, message);
    set((state) => {
      const newMessages = [...state.messages, message];
      console.log(`[Chat-Store] Store now has ${newMessages.length} messages`);
      return { messages: newMessages };
    });
  },
  setUsername: (username) => {
    console.log(`[Chat-Store] Setting username: ${username}`);
    set({ username });
  },
  setCurrentRoom: (currentRoom) => {
    console.log(`[Chat-Store] Setting current room: ${currentRoom}`);
    set({ currentRoom });
  },
  setIsConnected: (isConnected) => {
    console.log(`[Chat-Store] Setting connection state: ${isConnected}`);
    set({ isConnected });
  },
  setCurrentMessage: (currentMessage) => {
    console.log(`[Chat-Store] Setting current message: "${currentMessage}"`);
    set({ currentMessage });
  },
  setNewRoomName: (newRoomName) => {
    console.log(`[Chat-Store] Setting new room name: "${newRoomName}"`);
    set({ newRoomName });
  },
  clearMessages: () => {
    console.log(`[Chat-Store] Clearing all messages`);
    set({ messages: [] });
  },
}));