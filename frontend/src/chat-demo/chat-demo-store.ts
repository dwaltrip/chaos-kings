import { create } from 'zustand';
import { type ChatMessage } from '@/chat-demo/types';

interface ChatState {
  messages: ChatMessage[];
  username: string;
  currentRoom: string;
  currentMessage: string;
  newRoomName: string;
  actions: {
    setMessages: (messages: ChatMessage[]) => void;
    addMessage: (message: ChatMessage) => void;
    setUsername: (username: string) => void;
    setCurrentRoom: (currentRoom: string) => void;
    setCurrentMessage: (currentMessage: string) => void;
    setNewRoomName: (newRoomName: string) => void;
    clearMessages: () => void;
  };
}

const chatStore = create<ChatState>((set) => ({
  messages: [],
  username: '',
  currentRoom: 'general',
  currentMessage: '',
  newRoomName: '',
  actions: {
    setMessages: (messages) => set({ messages }),
    addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
    setUsername: (username) => set({ username }),
    setCurrentRoom: (currentRoom) => set({ currentRoom }),
    setCurrentMessage: (currentMessage) => set({ currentMessage }),
    setNewRoomName: (newRoomName) => set({ newRoomName }),
    clearMessages: () => set({ messages: [] }),
  }
}));

export { chatStore };
