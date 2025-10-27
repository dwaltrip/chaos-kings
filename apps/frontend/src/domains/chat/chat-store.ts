import { create } from 'zustand';

import type { ChatMessage } from '@/domains/chat/types';

interface ChatState {
  messages: ChatMessage[];
  newMessage: string;
  actions: {
    setMessages: (messages: ChatMessage[]) => void;
    addMessage: (message: ChatMessage) => void;
    setNewMessage: (newMessage: string) => void;
  };
}

const chatStore = create<ChatState>((set) => ({
  messages: [],
  newMessage: '',
  actions: {
    setMessages: (messages) => set({ messages }),
    addMessage: (message) => {
      set((state) => ({ messages: [...state.messages, message] }));
    },
    setNewMessage: (newMessage) => set({ newMessage }),
  },
}));

export { chatStore };
