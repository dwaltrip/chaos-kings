import { useEffect } from 'react';
import { useChatDemoStore } from './chat-demo-store';
import { chatDemoActions } from './chat-demo-actions';

function ChatDemoPage() {
  const {
    messages,
    username,
    setUsername,
    currentRoom,
    isConnected,
    currentMessage,
    setCurrentMessage,
    newRoomName,
    setNewRoomName,
  } = useChatDemoStore();

  useEffect(() => {
    chatDemoActions.initialize();
    
    return () => {
      chatDemoActions.cleanup();
    };
  }, []);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    chatDemoActions.sendMessage(currentMessage, username, currentRoom);
  };

  const handleRoomChange = (roomName: string) => {
    chatDemoActions.changeRoom(roomName);
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    chatDemoActions.createAndJoinRoom(newRoomName);
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
            <strong>{msg.user}:</strong> {msg.message}
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
