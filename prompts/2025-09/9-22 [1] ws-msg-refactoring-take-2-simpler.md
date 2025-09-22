I have two analyses of a refactoring problem that I'm starting to work on. They are a bit over the top I think / too copmlex, but there is a lot of usesful context I think.

Here they are:
- dev-notes/2025-09/9-21-ws-message-refactor-initial-analysis-1.md
- dev-notes/2025-09/9-21-ws-message-refactor-initial-analysis-2.md

Please read those carefully.

I want to proceed with doing the simplest possible thing. After, we can iterate and improve on it if possible.

In my mind, this first phase looks something like:
- Splititng WsMessage into 2 types, 1 for client -> server and 1 for server -> client
- Each domain will have its specific message types split in the same way. e.g. For matchmaking:
  - GameMatchmakingMessageType becomes 2 types, one for each direction
  - GameMatchmaking namespace also gets broken into 2, one for each direction
  - The corresponding backend and frontend handler structures (game-matchmaking-(ws-handler|ws-api).ts) will only acknowledge the appropriate message type

I'd like to sketch out just those minimal changes, and not worry too much about all of the implications yet. We can think about that in the next step. My idea is that this will provide a nice foundation to work from despite any unexpected complexities that may pop up.

NOT IN SCOPE for this first set of changes:
- Fixing DomainAPI yet (we will fix later, if we like how the first set of changes looks). Right now we are fixing "user code" and then the "lib code" can made to support the new way if the interface and ergonomics seem right.
- Fixing inconsistencies w/ how rooms are joined / leaved. We will come back to that.
- Almost all of the additional concerns noted in the docs I mentioned. We can revisit later.

Carefully analyze my approach, see if there are any major flaws with it.

DO NOT be sycophantic! If you see problems, something I'm not getting, or another way that is significantly better, let me know and explain your reasoning.

If you have any key questions, let me know.

Otherwise, present a brief description of your understanding of the situation, and a then a detailed plan for this initial minimal set of changes.
