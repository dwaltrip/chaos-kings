import { RoomId } from '@kernel/domains/system';

import { chatStore } from '@/domains/chat/chat-store';
import { chatWsEffects } from '@/domains/chat/ws-effects';
import {
  joinGameChatRoom,
  leaveGameChatRoom,
} from '@/domains/chat/actions/join-game-chat-room';

import type { ChatMessage } from './types';

function sendChatMessage(roomId: RoomId, message: string) {
  const { actions } = chatStore.getState();
  const trimmed = message.trim();

  if (!trimmed) {
    return;
  }

  chatWsEffects.sendMessage(roomId, trimmed);
  actions.setNewMessage('');
}

function addReceivedMessage(chatMessage: ChatMessage) {
  const { actions } = chatStore.getState();
  actions.addMessage(chatMessage);
}

function setNewMessage(message: string) {
  const { actions } = chatStore.getState();
  actions.setNewMessage(message);
}

export {
  sendChatMessage,
  addReceivedMessage,
  setNewMessage,
  joinGameChatRoom,
  leaveGameChatRoom,
};
