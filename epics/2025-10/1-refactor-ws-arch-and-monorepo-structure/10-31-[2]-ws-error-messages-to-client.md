# WebSocket Error Messages to Client

**Date:** 2025-10-31
**Status:** Proposal - Not yet implemented
**Priority:** Low (polish/debuggability improvement)

**Related:**
- Investigation doc `10-31-[1]` Finding #5 (ws-lib infrastructure TODOs)

---

## Problem

When a WebSocket message handler errors on the backend, the client receives no feedback. The request silently fails.

**Current behavior** (`ws-lib/server.ts:102-105`):
```typescript
} catch (error) {
  console.error('[WS] Error handling message:', error);
  // TODO: Send error message back to client?
}
```

**Impact:** Hard to debug client-side issues. Frontend has no way to know what went wrong.

---

## Proposal

### 1. Define Error Protocol Message

```typescript
// packages/protocol/domains/system/server-messages.ts (or new)
type ErrorMessage = {
  type: 'error';
  payload: {
    message: string;
    code?: string;         // e.g., 'HANDLER_ERROR', 'VALIDATION_ERROR'
    requestType?: string;  // echo back what message type failed
  };
};
```

### 2. Backend: Send Error to Client

```typescript
// ws-lib/server.ts line 102-105
} catch (error) {
  console.error('[WS] Error handling message:', error);

  // Send error back to the client
  const errorMsg = {
    type: 'error',
    payload: {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'HANDLER_ERROR',
      requestType: message.type,
    },
  };

  const client = clients.get(connectionId);
  if (client && client.ws.readyState === 1) {
    client.ws.send(encodeMsg(errorMsg as TOutgoing));
  }
}
```

### 3. Frontend: Handle Errors

```typescript
// apps/frontend/src/ws-lib or root handler
const globalHandlers = {
  'error': (payload) => {
    console.error(`[WS Error] ${payload.requestType} failed:`, payload.message);
    // Future: show toast notification, update error store, etc.
  },
};
```

---

## Design Questions

1. **Error detail level:** Show full `error.message` to client, or sanitize sensitive info?
2. **Error codes:** Need standardized codes for programmatic handling?
3. **UI feedback:** Just log, or show user-visible notifications?
4. **Domain vs generic:** One generic error type, or per-domain error messages?

---

## Recommendation

**Start simple:**
- Generic error type with message + requestType
- Just log it client-side for now
- Can elaborate (error codes, UI notifications) later if needed

**Defer until:** After v2 system is proven working end-to-end.

---

## Implementation Checklist

- [ ] Add error message type to protocol
- [ ] Update backend ws-lib to send errors to client
- [ ] Add frontend error handler
- [ ] Test: trigger handler error, verify client receives message
