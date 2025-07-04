import { useState, useEffect } from 'react';
import { useWebSocket } from './services/use-web-socket';

interface ChatMessage {
  user: string;
  message: string;
  timestamp: number;
}

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [username, setUsername] = useState('');
  const { send, isConnected, addMessageListener } = useWebSocket();

  useEffect(() => {
    addMessageListener((message: ChatMessage) => {
      setMessages(prev => [...prev, message]);
    });
  }, [addMessageListener]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMessage.trim() || !username.trim() || !isConnected) return;

    const message: ChatMessage = {
      user: username,
      message: currentMessage,
      timestamp: Date.now()
    };

    send(message);
    setCurrentMessage('');
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>WebSocket Chat</h1>
      
      <div style={{ marginBottom: '20px' }}>
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

export default App;
