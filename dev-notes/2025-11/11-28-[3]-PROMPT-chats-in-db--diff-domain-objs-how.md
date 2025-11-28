## Background

We are working on persisting game  chats to the db.

I have 2 rough draft notes / planning docs that AI wrote (with some input from me). They are:

- dev-notes/2025-11/11-28-[1]-chat-persistence-notes.md
- dev-notes/2025-11/11-28-[2]-chat-persistence-detailed-plan.md

These docs are NOT authorative, they are a first attempt by the AI to plan out how to work on this.

---

## Current issue

The main issue I want to address first is that we need to think more carefully about the various domain objects / models/ entities.

Right now we have things like:
- ChatMessageEntity (from: apps/backend/src/domains/chat/types.ts)
- GameChatMessagesTable (from: apps/backend/src/domains/chat/chat.db.ts)
- ChatMessage (from apps/frontend/src/domains/chat/types.ts)
- others...??

Please do the following:
- Find other relavant representations of chat messages
- Read architecture.md and open-questions.md in docs/

Help me think through what patterns would be good to solidify for working domain objects across frontend, backend, protocol

I want to keep things as simple ass possibly while not re-defining the same representations of (e.g.) chat message multiple times, but I recognize that the UI and the DB will have differences,  and
that's fine. I just don't want unnecessary extrra projections.

Please carefully explore and analyze this issue, and then lets discuss. Think very hard. 
