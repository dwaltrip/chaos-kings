**Web Game Prototype: Project Overview & User Stories**

---

### Project Status

#### Backend

- Node backend with TypeScript
- Redis is set up (can be used for shared room state, e.g., player list)
- PostgreSQL DB is set up, using Kysely as the SQL library
- Generic WebSocket manager + "message-api" abstraction implemented and used in chat demo
- JSON API not implemented yet; we may skip this for now

#### Frontend

- React + TypeScript
- Tailwind CSS is set up
- React Router is set up with dummy pages
- Zustand is used for state management; chat demo has a working store structure we can reuse
- A `WebSocketService` abstraction is implemented and working in the chat demo

#### Realtime Multiplayer Features

- Users in the same game room should see each other live (e.g., in a player list)
- Player presence can be tracked in memory or in Redis on the backend

---

### Minimal User Stories

#### 1. User Enters Username

- As a visitor, I want to enter a username on the home page so that I can be identified in the game room.
- Save the username to local storage so that I don't have to enter it again next time.
- If a username already exists in local storage, show it pre-filled or skip the input.

#### 2. Join Game Room by URL

- As a user, I want to join a game room by navigating to a URL like `/games/1` so that I can participate in that game's session.
- The game room should check for a saved username; if none is found, redirect to home page or prompt for username.
- Display a simple message like "You are in game room 1 as [username]".

#### 3. Manual Game Creation

- As a developer, I want to manually define game rooms for now (e.g., via hardcoded list or URL pattern), so I don't need a full room management UI.

#### 4. Basic Chat in Game Room

- As a user in a game room, I want to send and receive messages in a chat panel so I can talk to others in the same room.
- Messages should show username and content.
- Keep chat messages in memory for now; no need to persist them across reloads.

#### 5. Show Connected Players

- As a user in a game room, I want to see a list of connected users so I know who else is in the room.
- When a new player joins, show a system message or visual update.

---

### Optional bonus (will probably do in a 2nd spike)

- Visual cue when a new user joins (e.g., system message)
- Save chat history for the game room
- More to come...
