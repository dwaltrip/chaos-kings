# WebSocket Message Architecture

## Overview
This document outlines the type-safe WebSocket message architecture implemented for the chat-demo proof of concept. The system provides full TypeScript type safety from frontend message creation through backend message handling.

## Core Components

### 1. Shared Types (`common/types/websockets.ts`)
Contains generic WebSocket message interface shared across all domains.

#### Base Message Structure
```typescript
interface WsMessage {
  domain: string;
  payload: {
    type: string;
    data: any;
  }
  user: string;
  timestamp: number;
}
```

### 2. Domain-Specific Types (`common/types/chat-demo.ts`)
Contains all types, constants, and factory functions specific to the chat-demo domain.

#### Domain Organization
- **Domain Constant**: `CHAT_DEMO_DOMAIN = 'chat-demo'` eliminates hardcoded strings
- **Namespace Pattern**: `ChatDemo` namespace groups related message types
- **Type Safety**: Each message type has specific `Data` and `Payload` interfaces

#### Current Message Types
```typescript
namespace ChatDemo {
  // Chat message types
  export interface ChatMessageData { content: string; room: string; }
  export interface ChatMessagePayload { type: 'chat-message'; data: ChatMessageData; user: string; timestamp: number; }
  
  // Room management types  
  export interface JoinRoomData { room: string; }
  export interface JoinRoomPayload { type: 'join-room'; data: JoinRoomData; user: string; timestamp: number; }
}
```

#### Factory Functions
Type-safe message constructors ensure consistent structure:
```typescript
function createChatMessage(content: string, room: string, user: string): WsMessage
function createJoinRoomMessage(room: string, user: string): WsMessage
```

### 3. Frontend Implementation (`frontend/src/chat-demo/chat-demo-actions.ts`)
- **Type-Safe Sending**: Uses factory functions instead of manual object construction
- **Clean API**: `wsService.send(createChatMessage(message, room, username))`
- **Consistent Structure**: All messages follow the same pattern

### 4. Backend Implementation (`backend/src/game-chat/game-chat-ws-api.ts`)
- **Typed Handlers**: Each handler receives strongly typed payload
- **Domain Registration**: Uses `DomainAPI` pattern for message routing
- **Type Safety**: `(payload: ChatDemo.ChatMessagePayload, wsActions) => {}`

## Architecture Benefits

### Type Safety
- Compile-time checking of message structure
- IntelliSense support for message properties
- Prevents runtime errors from malformed messages

### Maintainability
- Single source of truth for message types
- Domain constants eliminate hardcoded strings
- Factory functions ensure consistent message structure

### Scalability
- Namespace pattern supports multiple domains
- Easy to add new message types following established patterns
- Clear separation between frontend and backend concerns

## Adding New Message Types

### 1. Define Types
Add to `ChatDemo` namespace in `common/types/chat-demo.ts`:
```typescript
export interface NewMessageData { /* properties */ }
export interface NewMessagePayload { 
  type: 'new-message'; 
  data: NewMessageData; 
  user: string; 
  timestamp: number; 
}
```

### 2. Create Factory Function
Add factory function in `common/types/chat-demo.ts`:
```typescript
function createNewMessage(/* params */): WsMessage {
  return {
    user,
    domain: CHAT_DEMO_DOMAIN,
    payload: { type: 'new-message', data: { /* data */ } },
    timestamp: Date.now()
  };
}
```

### 3. Update Frontend
Use factory function in actions:
```typescript
wsService.send(createNewMessage(/* params */));
```

### 4. Update Backend
Add typed handler:
```typescript
'new-message': (payload: ChatDemo.NewMessagePayload, wsActions) => {
  // Handle message
}
```

## File Locations

### Core Files
- `common/types/websockets.ts` - Generic WebSocket message interface
- `common/types/chat-demo.ts` - Chat-demo domain types and factory functions
- `frontend/src/chat-demo/chat-demo-actions.ts` - Frontend message sending
- `backend/src/game-chat/game-chat-ws-api.ts` - Backend message handling

### Infrastructure
- `frontend/src/services/websocket-service.ts` - WebSocket client service
- `backend/src/websocket/api.ts` - Domain routing and message handling

## Migration Notes
- Legacy code may still use manual message construction (e.g., `setUsername` function)
- `leave-room` handler still uses `any` type - ready for future typing
- Factory pattern established for consistent future development
