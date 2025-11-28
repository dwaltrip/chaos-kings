import { create } from 'zustand';

import type { ChatMessage } from '@/domains/chat/types';

interface ChatState {
  messages: ChatMessage[];
  newMessage: string;
  actions: {
    setMessages: (messages: ChatMessage[]) => void;
    addMessage: (message: ChatMessage) => void;
    mergeMessages: (messages: ChatMessage[]) => void;
    setNewMessage: (newMessage: string) => void;
  };
}

const chatStore = create<ChatState>((set) => ({
  messages: [],
  newMessage: '',
  actions: {
    setMessages: (messages) => set({ messages }),
    addMessage: (message) => {
      set((state) => {
        const existingIds = new Set(state.messages.map((m) => m.id));
        if (existingIds.has(message.id)) {
          return state;
        }
        return { messages: [...state.messages, message] };
      });
    },
    mergeMessages: (newMessages) => {
      set((state) => {
        const existingIds = new Set(state.messages.map((m) => m.id));
        const uniqueNew = newMessages.filter((m) => !existingIds.has(m.id));
        return {
          messages: [...state.messages, ...uniqueNew].sort(
            (a, b) => a.timestamp - b.timestamp,
          ),
        };
      });
    },
    setNewMessage: (newMessage) => set({ newMessage }),
  },
}));

export { chatStore };
