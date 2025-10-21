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

- [ ] System domain follow-ups
  - Hook `system:room-status-update` into frontend state once WS client pub/sub lands
  - Decide whether to persist the membership tracker (Redis vs in-memory)
  - Define heartbeat / lifecycle flow and message surface

---

## Backlog

Not yet prioritized (may be lower priority for now) or fully scoped:

- [ ] Migrate v1 MatchmakingService logic into v2 backend actions
- [ ] Unstub frontend matchmaking actions (store integration, navigation)
- [ ] Define cross-domain error handling patterns
- [ ] Decide on long-term room naming strategy
- [ ] Implement system heartbeat & lifecycle handling (deferred until WS infra stabilizes)

---

## Done (Archive)

Completed tasks (clean out periodically):

##### 2025-10 (October)

- [x] Centralized room membership in system domain (join/leave transport + shared helper)
- [x] Fixed ws-effects gap in frontend domain scaffold
- [x] Chat domain scaffolding (handlers, actions, ws-effects, BE + FE)
- [x] Matchmaking domain scaffolding (handlers, actions, ws-effects, BE + FE)
- [x] Gameplay domain scaffolding (handlers, actions, ws-effects, BE + FE)
- [x] Set up package.json and build configs for v2 apps
- [x] TypeScript type checking setup and error resolution
- [x] Branded types implementation (all domains)
