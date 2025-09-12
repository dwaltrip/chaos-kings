# Sandbox UI Design Brainstorm

*Date: 2025-09-12*

## Background

Building a sandbox UI for testing game mechanics and UI/UX during development. Needs to be as close to real gameplay as possible (no frontend-only testing), with helpful dev features like undo/redo, fog of war toggle, and arbitrary game state setting. This avoids needing matchmaking and provides a reliable testing environment.

## Core Architecture Decision

- Game engine/core stays completely mode-agnostic
- Different WebSocket handlers route to same core engine methods
- Game mechanics/rules unchanged between modes

## Refined Flow Pattern

```
Normal: WS → GameWSHandler → GameActions → Core engine
Sandbox: WS → SandboxWSHandler → SandboxActions → Core engine + state management
```

## Layer Responsibilities

- **WS Handlers**: Thin, just message parsing/routing
- **Actions**: Main coordinators - orchestrate all side effects, state changes, notifications
- **Core**: Pure game logic/mechanics/rules

## Future Replay Mode Connection

This sandbox infrastructure naturally extends to replay functionality for reviewing completed games. Both features need turn history, state navigation, and similar UI controls. Building sandbox first creates the foundation for easy replay implementation later.

## Design Decisions Still To Explore

1. **Game Mode Architecture** ✓
2. **Turn History System** - Full snapshots vs incremental deltas
3. **Single Connection Control** - How one WebSocket controls two players
4. **Fog of War Toggle** - Client-side rendering vs server-side state
5. **Arbitrary State Setting** - How granular should state editing be
6. **Persistence & Sharing** - Ephemeral vs saved sandbox states
