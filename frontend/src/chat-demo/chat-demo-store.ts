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
  
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ 
    messages: [...state.messages, message] 
  })),
  setUsername: (username) => set({ username }),
  setCurrentRoom: (currentRoom) => set({ currentRoom }),
  setIsConnected: (isConnected) => set({ isConnected }),
  setCurrentMessage: (currentMessage) => set({ currentMessage }),
  setNewRoomName: (newRoomName) => set({ newRoomName }),
  clearMessages: () => set({ messages: [] }),
}));