import { useEffect, useState } from 'react';

import { initializeWsClient } from '@/ws';
import { initializeUser } from '@/domains/users/actions/initialize-user';

/**
 * Orchestrates app initialization with proper sequencing:
 * 1. Initialize user (HTTP call to /api/users/me) → establishes session cookie
 * 2. Initialize WebSocket client → upgrade request includes session cookie
 *
 * This sequencing is critical for mapping WS connections to users:
 * - The auth plugin reads the session cookie on WS upgrade requests
 * - It sets req.currentUser, which the WS server relies on to identify connections
 */
function useUserSessionAndWsInit() {
  const [userReady, setUserReady] = useState(false);
  const [wsInitialized, setWsInitialized] = useState(false);

  // Step 1: Initialize user FIRST (establishes session cookie)
  useEffect(() => {
    initializeUser()
      .then(() => setUserReady(true))
      .catch(() => setUserReady(true)); // Still proceed even on error
  }, []);

  // Step 2: Initialize WS only AFTER user is ready
  useEffect(() => {
    if (!userReady) return;

    initializeWsClient();
    setWsInitialized(true);
  }, [userReady]);

  return {
    ready: userReady && wsInitialized,
    userReady,
    wsInitialized,
  };
}

export { useUserSessionAndWsInit };
