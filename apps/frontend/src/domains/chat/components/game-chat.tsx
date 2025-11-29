import { useEffect } from 'react';
import { GameId } from '@kernel/ids';

import type { Game } from '@platform/domains/games/types';

import { useWsConnectionStore } from '@/ws-lib';
import { chatStore } from '@/domains/chat/chat-store';
import {
  sendChatMessage,
  setNewMessage,
  joinGameChatRoom,
  leaveGameChatRoom,
  loadChatHistory,
} from '@/domains/chat/actions';

import '@/domains/chat/components/game-chat.css';

function GameChat({ game }: { game: Game }) {
  const messages = chatStore((state) => state.messages);
  const newMessage = chatStore((state) => state.newMessage);
  const isConnected = useWsConnectionStore((state) => state.isConnected);

  const gameId = GameId(game.id);

  useEffect(() => {
    joinGameChatRoom(gameId);
    loadChatHistory(gameId);
    return () => leaveGameChatRoom(gameId);
  }, [game.id]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    sendChatMessage(gameId, newMessage);
  };

  return (
    <div className="game-chat">
      <span>{isConnected ? '🟢 Connected' : '🔴 Disconnected'}</span>
      <div>
        {messages.map((msg) => (
          <div key={msg.id}>
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
