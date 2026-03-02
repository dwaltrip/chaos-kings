its time to fix how we manage game state in the frontend. zustand is a poor fit.

for context, Please see these notes from a recent claude code session: dev-notes/2026-03/3-01-[4]-game-state-refactor-notes.md

Eventually, we may also move away from using react for the game board. This game state refactor should be done in a way that would make that possibility easier. e.g. de-coupling of state management and rendering as cleanly as we can, etc. moving the state outside of react as much as possible.

---

we have a lotttt of notes about game state and other frontend related work. There's been brainstorming and some work towards a "unified" UI / store / etc for the game board that could be used in all the differnt pages that render boards:

- gameplay
- puzzles
- replay
- sandbox

See this store we've worked on: apps/frontend/src/domains/games/stores/board-session-store.ts

we should do a deep dive on looking at all dev-notes in the past few months to find any good notes / ideas / code design sketches / etc.

---

I believe there are also notes in dev-notes somewhere about what a non-zustand board state management design could look like. we could do some digging on that too.

---

this is a lot to tackle. lets talk through what process / steps we can take to work towards this.
