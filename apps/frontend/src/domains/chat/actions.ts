import { GameId } from '@kernel/ids';
import { idToNumber } from '@kernel/branded-type';

import { chatStore } from '@/domains/chat/chat-store';
import { chatWsEffects } from '@/domains/chat/ws-effects';
import {
  joinGameChatRoom,
  leaveGameChatRoom,
} from '@/domains/chat/actions/join-game-chat-room';
import { apiService } from '@/services/api-service';

import type { ChatMessage } from './types';

function sendChatMessage(gameId: GameId, message: string) {
  const { actions } = chatStore.getState();
  const trimmed = message.trim();

  if (!trimmed) {
    return;
  }

  chatWsEffects.sendMessage(gameId, trimmed);
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

async function loadChatHistory(gameId: GameId) {
  const response = await apiService.get(`/api/games/${idToNumber(gameId)}/chat`);
  const data = await response.json();
  const { actions } = chatStore.getState();
  actions.mergeMessages(data.messages);
}

export {
  sendChatMessage,
  addReceivedMessage,
  setNewMessage,
  joinGameChatRoom,
  leaveGameChatRoom,
  loadChatHistory,
};
