import type { Game } from '@common/types/games';
import { GAME_CHAT_DOMAIN } from '@common/types/game-chat';
import { gameChatStore } from '@/pages/game/game-chat/game-chat-store';
import {
  sendChatMessage,
  setNewMessage,
} from '@/pages/game/game-chat/game-chat-actions';
import { GameChatWsHandler } from '@/pages/game/game-chat/game-chat-ws-handler';

import '@/pages/game/game-chat/game-chat.css';
import { useWebsocket } from '@/hooks/use-websocket';

function GameChat({ game }: { game: Game }) {
  const messages = gameChatStore((state) => state.messages);
  const newMessage = gameChatStore((state) => state.newMessage);
  const wsService = useWebsocket(GAME_CHAT_DOMAIN, GameChatWsHandler);
  const isConnected = wsService.isConnected;

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    sendChatMessage(newMessage, game);
  };

  return (
    <div className="game-chat">
      <span>{isConnected ? '🟢 Connected' : '🔴 Disconnected'}</span>
      <div>
        {messages.map((msg, i) => (
          <div key={i}>
            <strong>{msg.username || 'Unknown'}:</strong> {msg.content}
            <small>{new Date(msg.timestamp).toLocaleTimeString()}</small>
          </div>
        ))}
        {messages.length === 0 && <div>No messages yet.</div>}
      </div>

      <form onSubmit={sendMessage}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          disabled={!isConnected}
        />
        <button type="submit" disabled={!isConnected || !newMessage.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

export { GameChat };
