import { create } from 'zustand';
import { type ChatMessage } from '@/chat-demo/types';

interface GameChatState {
  messages: ChatMessage[];
  username: string;
  currentMessage: string;
  actions: {
    setMessages: (messages: ChatMessage[]) => void;
    addMessage: (message: ChatMessage) => void;
    setCurrentMessage: (currentMessage: string) => void;
  };
}

const gameChatStore = create<GameChatState>((set) => ({
  messages: [],
  username: '',
  currentMessage: '',
  actions: {
    setMessages: (messages) => set({ messages }),
    addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
    setCurrentMessage: (currentMessage) => set({ currentMessage }),
  }
}));

export { gameChatStore };
