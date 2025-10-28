Session Goal: Plan and investigate backend integration for game + gameplay domains

We are working on the large refactor: **WebSocket Architecture & Monorepo Refactor**.

Here is the epic folder with notes and planning docs for this work:
- epics/2025-10/1-refactor-ws-arch-and-monorepo-structure

Start by reading the living docs for the big picture and to understand where we are at now:
- [STRATEGY].md - Overall refactor vision, architecture, and phase plan
- [PROGRESS].md - Current status and completed work
- [TODOS].md - Known issues and next steps

---

Currently, we are migrating v1 backend app / domain logic into the v2 architecture with cleaner separation of concerns, stronger type safety, and better domain organization.

Context:
- We've completed backend integration for user, chat, and matchmaking domains
- Game + gameplay domains are the last major backend integrations needed
- Gameplay specifically will likely be on the more complex, like matchmaking.

We have some notes from the work so far, please read them:
epics/2025-10/1-refactor-ws-arch-and-monorepo-structure/10-28-[1]-backend-domain-integration-notes.md

---

Your tasks:

1. **Investigate v1 code** - Examine the existing v1 game/gameplay code in `apps/backend/src/domains/game*` and
`apps/backend/src/domains/gameplay/`
2. **Review v2 scaffolding** - Check what handlers/actions/ws-effects already exist
3. **Identify patterns** - Compare against the integration guide to see what's similar/different
4. **Spot complexities** - Call out anything that looks more complex than user/chat/matchmaking
5. **Present findigns** - Carefully present your findings to me for discussion. Don't be overly terse!

The information should be well organized and easy to read.

After we discuss, we will be drafting a tactical doc with:
   - Scope of work (what files/functions need integration)
   - Key differences from previous integrations
   - Suggested approach/order
   - Known risks or open questions

**No implementation or code** - focus on understanding and planning.
