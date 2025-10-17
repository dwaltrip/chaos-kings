# Epic TODOs

## Purpose
Inbox for discovered and unplanned work items.

**This is NOT a comprehensive task list.** Most work happens through tactical docs with their own implementation plans. Use this file for:
- Tasks discovered mid-session that don't fit the current tactical scope
- Small items that don't warrant a full tactical doc
- Cross-cutting concerns that don't belong to a specific tactical
- Half-formed ideas to scope later
- Tasks waiting to be promoted to a tactical when they grow

**NOTE:** We are trying out this workflow pattern. Expect changes as we learn what works.

---

## Active

Tasks we know we need to do:

- [ ] Fix frontend ws-effects scaffolding gap
  - Frontend domains are calling wsService directly instead of using ws-effects layer
  - Need to create ws-effects.ts for: matchmaking, gameplay, chat
  - Need to rename system/actions.ts to system/ws-effects.ts for consistency
  - Update actions.ts files to call ws-effects instead of wsService
  - See exploration notes from 2025-10-17 branded types planning session
- [ ] Set up package.json and build configs for apps/backend and apps/frontend
- [ ] Run TypeScript checks to verify imports and types in new domain files
- [ ] Implement system domain (room membership, heartbeat, connection lifecycle)

---

## Backlog

Not yet prioritized (may be lower priority for now) or fully scoped:

- [ ] Experiment with branded IDs implementation
- [ ] Review and redesign room membership pattern (gameplay shouldn't own join/leave messages)
- [ ] Migrate v1 MatchmakingService logic into v2 backend actions
- [ ] Unstub frontend matchmaking actions (store integration, navigation)
- [ ] Define cross-domain error handling patterns
- [ ] Decide on long-term room naming strategy

---

## Done (Archive)

Completed tasks (clean out periodically):

- [x] Chat domain scaffolding (handlers, actions, ws-effects, BE + FE)
- [x] Matchmaking domain scaffolding (handlers, actions, ws-effects, BE + FE)
- [x] Gameplay domain scaffolding (handlers, actions, ws-effects, BE + FE)
