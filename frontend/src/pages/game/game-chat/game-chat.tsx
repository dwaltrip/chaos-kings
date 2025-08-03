import { useEffect, useRef } from 'react';

import type { Game } from '@common/types/games';
import { useWsStore } from '@/services/ws-store';
import { gameChatStore } from '@/pages/game/game-chat/game-chat-store';
// import { userStore } from '@/stores/user-store';
import {
  websocketConnect,
  sendChatMessage,
  setNewMessage,
  // joinRoom,
} from '@/pages/game/game-chat/game-chat-actions';
import { GameChatWsHandler } from '@/pages/game/game-chat/game-chat-ws-handler';

type WebSocketService = ReturnType<typeof websocketConnect>;

function GameChat({ game }: { game: Game }) {
  const messages = gameChatStore(state => state.messages);
  // const currentRoom = gameChatStore(state => state.currentRoom);
  const newMessage = gameChatStore(state => state.newMessage);
  const { isConnected } = useWsStore();
  const wsServiceRef = useRef<WebSocketService | null>(null);
  // const user = userStore(state => state.user);

  useEffect(() => {
    console.log('==== Setting up WebSocket service');
    const wsService = websocketConnect({ game });
    wsService.addMessageHandler('chat-demo', GameChatWsHandler);
    wsServiceRef.current = wsService;

    return () => {
      console.log('==== Cleaning up websocket service');
      wsServiceRef.current?.cleanup();
      wsService.removeMessageHandler('chat-demo', GameChatWsHandler);
    };
  }, []);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    sendChatMessage(newMessage, game);
  };

  // const handleRoomChange = (roomName: string) => {
  //   joinRoom(roomName, username);
  // };

  return (
    <div>
      <span>{isConnected ? '🟢 Connected' : '🔴 Disconnected'}</span>
      <div>
        {messages.map((msg, i) => (
          <div key={i}>
            <strong>{msg.user?.username || 'Unknown'}:</strong> {msg.content}
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
        <button 
          type="submit" 
          disabled={!isConnected || !newMessage.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}

export { GameChat };
