import { create } from 'zustand';
import type { ChatMessage } from '@/pages/game/game-chat/types';

interface GameChatState {
  messages: ChatMessage[];
  username: string;
  newMessage: string;
  actions: {
    setMessages: (messages: ChatMessage[]) => void;
    addMessage: (message: ChatMessage) => void;
    setNewMessage: (newMessage: string) => void;
  };
}

const gameChatStore = create<GameChatState>((set) => ({
  messages: [],
  username: '',
  newMessage: '',
  actions: {
    setMessages: (messages) => set({ messages }),
    addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
    setNewMessage: (newMessage) => set({ newMessage }),
  }
}));

export { gameChatStore };
