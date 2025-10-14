### Background

We are working on a large, complex refactor.

The following docs contain a ton of detailed context. Please read them very carefully.

- dev-notes/2020-10/10-12-[1]-monorepo-folder-structure-v2.md
- dev-notes/2020-10/10-12-[2]-project-arch-massive-refactor.md

I've started working on this. In particular see the following commits:

 - hash: 02b6082
    - Implement new WS arch for the "chat" domain in the v2 app dirs (backend / frontend)
    - Creating new "v2" ws-related files in these v2 dirs (a la the refactor doc)
 - hash: 3405147
    - First pass at new ws msg types + creators in "protocol"
    - Migrating all the ws contracts and message type defs from /common into /packages/protocol

------

### Where we are at

#### Strategy so far 

In short, start with the leaves of the application:

Create new files in the v2 app dirs for `frontend` and `backend`, covering the new architecture between "the wire" and "app actions"

See the commit for the "chat" domain work (02b6082) for my first stab at this.

#### Some thoughts / notes from that work

I implemented the first pass of all the new ws-related + adjacent files that cover the thin layers between the wire and the "actions" where actual biz logic and FE / BE specific concerns:
    - handlers
    - ws-effects
    - actions

I didn't fully implement the "actions".

There are 2 cases for how actions are used:
    - "incoming": action is called by handler, so the action then reached inward to the app
    - "outgoign" app code calls the action which sends a message out across the wire

For the incoming case, I mostly stubbed the action. For the outgoing case, I called the appropriate "ws-effect" method.

#### Next steps

Thinking of trying to repeat this for the other "non-system" domains: matchmaking and gameplay

------

### Prompt

Can you carefully review all of the above? Then lets discuss your initial synthesis. It's a lot of scattered info and complexity, so I want to make sure we are well aligned.

I'm trying to figure out how much prep work / context engineering to do with you before we try to implement the next little chunk.

Please ask me at 5-10 questions about everything so we can get more aligned.
