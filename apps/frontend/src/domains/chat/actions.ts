import { RoomId } from '@kernel/domains/system';

import { chatWsEffects } from './ws-effects';

// ---------------------------------------------
// TODO:
//   - Import this from the v1 frontend app?
//   - Maybe using a "@frontend-v1" alias?
// -------------------------------------------------
// import { gameChatStore } from '@/pages/gameplay/game-chat/game-chat-store';

// const { actions } = gameChatStore.getState();
const chatStore: any = {};

// function sendChatMessage(message: string, game: Game) {
function sendChatMessage(roomId: RoomId, message: string) {
  // TODO: [CHAT-FE] Wire to store when available
  // const { setNewMessage } = chatStore.getState().actions;
  chatWsEffects.sendMessage(roomId, message);
  // setNewMessage('');
}

function addReceivedMessage(chatMessage: any) {
  // TODO: [CHAT-FE] Wire to store when available
  // const { addMessage } = chatStore.getState().actions;
  // addMessage(chatMessage);
}

function setNewMessage(message: string) {
  // TODO: [CHAT-FE] Wire to store when available
  // const { setNewMessage } = chatStore.getState().actions;
  // setNewMessage(message);
}

const chatActions = {
  sendChatMessage,
  setNewMessage,
  addReceivedMessage,
};

export { chatActions };
