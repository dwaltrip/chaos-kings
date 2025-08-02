import { useEffect, useRef } from 'react';

import type { Game } from '@common/types/games';
import { useWsStore } from '@/services/ws-store';
import { gameChatStore } from '@/pages/game/game-chat/game-chat-store';
import {
  websocketConnect,
  sendChatMessage,
  setCurrentMessage,
  joinRoom,
} from '@/pages/game/game-chat/game-chat-actions';
import { ChatDemoWsHandler } from '@/chat-demo/chat-demo-ws-handler';

type WebSocketService = ReturnType<typeof websocketConnect>;

function GameChat({ game }: { game: Game }) {
  const messages = gameChatStore(state => state.messages);
  // const currentRoom = gameChatStore(state => state.currentRoom);
  const currentMessage = gameChatStore(state => state.currentMessage);
  const { isConnected } = useWsStore();
  const wsServiceRef = useRef<WebSocketService | null>(null);

  useEffect(() => {
    console.log('==== Setting up WebSocket service');
    const wsService = websocketConnect();
    wsService.addMessageHandler('chat-demo', ChatDemoWsHandler);
    wsServiceRef.current = wsService;

    return () => {
      console.log('==== Cleaning up websocket service');
      wsServiceRef.current?.cleanup();
      wsService.removeMessageHandler('chat-demo', ChatDemoWsHandler);
    };
  }, []);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    sendChatMessage(currentMessage, username, currentRoom);
  };

  const handleRoomChange = (roomName: string) => {
    joinRoom(roomName, username);
  };

  return (
    <div>
      <span>{isConnected ? '🟢 Connected' : '🔴 Disconnected'}</span>
      <div>
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: '10px' }}>
            <strong>{msg.user}:</strong> {msg.content}
            <small style={{ color: '#666', marginLeft: '10px' }}>
              {new Date(msg.timestamp).toLocaleTimeString()}
            </small>
          </div>
        ))}
        {messages.length === 0 && (
          <div style={{ color: '#999', fontStyle: 'italic' }}>
            No messages yet.
          </div>
        )}
      </div>

      <form onSubmit={sendMessage}>
        <input
          type="text"
          value={currentMessage}
          onChange={(e) => setCurrentMessage(e.target.value)}
          placeholder="Type your message..."
          style={{ flex: 1, padding: '10px' }}
          disabled={!isConnected || !username.trim()}
        />
        <button 
          type="submit" 
          disabled={!isConnected || !username.trim() || !currentMessage.trim()}
          style={{ padding: '10px 20px' }}
        >
          Send
        </button>
      </form>
    </div>
  );
}

export { GameChat };
