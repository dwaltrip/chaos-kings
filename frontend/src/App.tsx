import { ChatDemoPage } from './chat-demo/chat-demo-page';
// import { MatchmakingPage } from './matchmaking/matchmaking-page';

function App() {
  return (
    <div className="app">
      <div style={{ display: 'flex', gap: '40px' }}>
        <div style={{ flex: 1 }}>
          {/* <MatchmakingPage /> */}
          <ChatDemoPage />
        </div>
      </div>
    </div>
  );
}

export { App };
