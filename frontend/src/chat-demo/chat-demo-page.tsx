import { useEffect, useRef } from 'react';
import { useChatStore } from './chat-demo-store';
import { useWsStore } from '../services/ws-store';
import {
  websocketConnect,
  sendChatMessage,
  setCurrentMessage,
  setUsername,
  setNewRoomName,
  joinRoom,
  createAndJoinRoom,
} from './chat-demo-actions';
import { ChatDemoWsHandler } from './chat-demo-ws-handler';

type WebSocketService = ReturnType<typeof websocketConnect>;

function ChatDemoPage() {
  const {
    messages,
    username,
    currentRoom,
    currentMessage,
    newRoomName,
    // actions: {
    //   setUsername,
    //   setCurrentMessage,
    //   setNewRoomName,
    // },
  } = useChatStore();
  const { isConnected } = useWsStore();

  const wsServiceRef = useRef<WebSocketService | null>(null);

  useEffect(() => {
    console.log('==== Setting up WebSocket service');
    const wsService = websocketConnect();
    wsService.addMessageHandler('chat-demo', ChatDemoWsHandler);
    // wsService.addListener('open', (event) => {
    //   console.log('[ws-service] WebSocket connection opened:', event);
    // });
    wsServiceRef.current = wsService;

    return () => {
      console.log('==== Cleaning up WebSocket service');
      wsServiceRef.current?.cleanup();
    };
  }, []);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    sendChatMessage(currentMessage, username, currentRoom);
  };

  const handleRoomChange = (roomName: string) => {
    joinRoom(roomName, username);
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    createAndJoinRoom(newRoomName);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>WebSocket Chat</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label>
            Username: 
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              style={{ marginLeft: '10px', padding: '5px' }}
            />
          </label>
          <span style={{ marginLeft: '20px', color: isConnected ? 'green' : 'red' }}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <strong>Current Room: {currentRoom}</strong>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
          <button onClick={() => handleRoomChange('general')} style={{ padding: '5px 10px' }}>
            General
          </button>
          <button onClick={() => handleRoomChange('random')} style={{ padding: '5px 10px' }}>
            Random
          </button>
          <button onClick={() => handleRoomChange('tech')} style={{ padding: '5px 10px' }}>
            Tech
          </button>
        </div>
        
        <form onSubmit={handleCreateRoom} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="text"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder="Create new room..."
            style={{ padding: '5px' }}
          />
          <button type="submit" style={{ padding: '5px 10px' }}>
            Create Room
          </button>
        </form>
      </div>

      <div 
        style={{ 
          border: '1px solid #ccc', 
          height: '400px', 
          overflowY: 'auto', 
          padding: '10px',
          marginBottom: '20px',
          backgroundColor: '#f9f9f9'
        }}
      >
        {messages.map((msg, index) => (
          <div key={index} style={{ marginBottom: '10px' }}>
            <strong>{msg.sender}:</strong> {msg.content}
            <small style={{ color: '#666', marginLeft: '10px' }}>
              {new Date(msg.timestamp).toLocaleTimeString()}
            </small>
          </div>
        ))}
        {messages.length === 0 && (
          <div style={{ color: '#999', fontStyle: 'italic' }}>
            No messages in {currentRoom} room yet. Be the first to say hello!
          </div>
        )}
      </div>

      <form onSubmit={sendMessage} style={{ display: 'flex', gap: '10px' }}>
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

export { ChatDemoPage };
