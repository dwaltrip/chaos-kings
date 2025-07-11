import { WebSocketChatDemo } from './components/websocket-chat-demo';
import { MatchmakingDemo } from './components/matchmaking-demo';

function App() {
  return (
    <div className="app">
      <div style={{ display: 'flex', gap: '40px' }}>
        <div style={{ flex: 1 }}>
          <MatchmakingDemo />
        </div>
        {/*
        <div style={{ flex: 1 }}>
          <WebSocketChatDemo />
        </div>
        */}
      </div>
    </div>
  );
}

export { App };
