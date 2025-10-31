import { useEffect } from 'react';
import { GameId, RoomId } from '@kernel/ids';
import type { Game } from '@common/types/games';
import { buildChatRoomId } from '@platform/domains/chat/helpers';

import { useWsConnectionStore } from '@/ws-lib';
import { chatStore } from '@/domains/chat/chat-store';
import {
  sendChatMessage,
  setNewMessage,
  joinGameChatRoom,
  leaveGameChatRoom,
} from '@/domains/chat/actions';

import '@/pages/gameplay/game-chat/game-chat.css';

function GameChat({ game }: { game: Game }) {
  const messages = chatStore((state) => state.messages);
  const newMessage = chatStore((state) => state.newMessage);
  const isConnected = useWsConnectionStore((state) => state.isConnected);

  const roomId = RoomId(buildChatRoomId(game.id));

  useEffect(() => {
    const gameId = GameId(game.id);
    joinGameChatRoom(gameId);
    return () => leaveGameChatRoom(gameId);
  }, [game.id]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    sendChatMessage(roomId, newMessage);
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
