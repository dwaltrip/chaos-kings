// ---------------------------------------------
// TODO:
//   - Import this from the v1 frontend app?
//   - Maybe using a "@frontend-v1" alias?
// -------------------------------------------------
// import { gameChatStore } from '@/pages/game/game-chat/game-chat-store';

// const { actions } = gameChatStore.getState();
const chatStore: any = {};

// function sendChatMessage(message: string, game: Game) {
function sendChatMessage(message: any, game: any) {
  const { setNewMessage } = chatStore.getState().actions;
  // chatWsEffects.sendMessage(message, game);
  setNewMessage('');
}

function addReceivedMessage(chatMessage: any) {
  const { addMessage } = chatStore.getState().actions;
  addMessage(chatMessage);
}

function setNewMessage(message: string) {
  const { setNewMessage } = chatStore.getState().actions;
  setNewMessage(message);
}

export { sendChatMessage, setNewMessage, addReceivedMessage };
