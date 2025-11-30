import type { ConnectionId } from '@/ws-lib/types';

// TODO: Review whether userId should be primitive (number) or branded (UserId)
// Current: primitive number (handlers convert to UserId at boundary)
// Alternative: branded UserId (conversion happens in createContext)
// Decision impacts: where boundary conversions happen, handler ergonomics
type ConnectionContext = {
  userId: number;
  connectionId: ConnectionId;
};

export type { ConnectionContext };
