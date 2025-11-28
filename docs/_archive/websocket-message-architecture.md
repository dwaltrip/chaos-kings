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
  type: string;
  payload: any;
}
```

### 2. Domain-Specific Types (`common/types/chat-demo.ts`)
Contains all types, constants, and factory functions specific to the chat-demo domain.

#### Domain Organization
- **Domain Constant**: `CHAT_DEMO_DOMAIN = 'chat-demo'` eliminates hardcoded strings
- **Namespace Pattern**: `ChatDemo` namespace groups related message types
- **Direct Extension**: Message interfaces extend `WsMessage` with specific payload structures

#### Current Message Types
```typescript
namespace ChatDemo {
  export interface ChatMessage extends WsMessage {
    payload: {
      content: string;
      room: string;
      user: string;
      timestamp: number;
    }
  }

  export interface JoinRoomMessage extends WsMessage {
    payload: {
      room: string;
      user: string;
      timestamp: number;
    }
  }
}
```

#### Factory Functions
Type-safe message constructors ensure consistent structure:
```typescript
function createNewChatMessage(content: string, room: string, user: string): ChatDemo.ChatMessage
function createJoinRoomMessage(room: string, user: string): WsMessage
```

### 3. Frontend Implementation (`frontend/src/chat-demo/chat-demo-actions.ts`)
- **Type-Safe Sending**: Uses factory functions instead of manual object construction
- **Clean API**: `wsService.send(createNewChatMessage(message, room, username))`
- **Consistent Structure**: All messages follow the same pattern

### 4. Backend Implementation (`backend/src/game-chat/game-chat-ws-api.ts`)
- **Typed Handlers**: Each handler receives strongly typed message
- **Domain Registration**: Uses `DomainAPI` pattern for message routing
- **Type Safety**: Handlers work with specific message interfaces like `ChatDemo.ChatMessage`

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
export interface NewMessage extends WsMessage {
  payload: {
    /* your properties here */
    user: string;
    timestamp: number;
  }
}
```

### 2. Create Factory Function
Add factory function in `common/types/chat-demo.ts`:
```typescript
function createNewMessage(/* params */): ChatDemo.NewMessage {
  return {
    domain: CHAT_DEMO_DOMAIN,
    type: 'new-message',
    payload: {
      /* your data here */
      user,
      timestamp: Date.now(),
    },
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
'new-message': (message: ChatDemo.NewMessage, wsActions) => {
  // Handle message with message.payload.* properties
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
