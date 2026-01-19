import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import './index.css';
import { App } from '@/App.tsx';
import { initializeDebug } from '@/debug';
import { registerDebugStores } from '@/debug/register-stores';

// Initialize debug capture system (dev only, no-op in production)
initializeDebug();
registerDebugStores();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
