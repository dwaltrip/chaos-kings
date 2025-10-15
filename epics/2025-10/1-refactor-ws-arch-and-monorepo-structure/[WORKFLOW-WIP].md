# Epic Workflow - WIP

## Purpose
This living workflow doc captures how we run epic-scale work. It explains how the epic folder is organized, how living docs and tactical notes interact, and what to do before, during, and after AI-assisted sessions. Expect frequent tweaks—record any process adjustments here so the rest of the bracketed files stay focused on product decisions.

## Document Types
- **Living docs (`[NAME].md`)** – Always-on references for the epic (strategy, tracker, workflow, todos). Keep them current; summarize durable outcomes and link supporting notes.
- **Tactical notes (`MM-DD-[n]-slug.md`)** – Point-in-time planning or execution logs. Capture detailed thinking, implementation plans, and task lists for specific chunks of work. Bubble conclusions back into living docs.
- **`[TODOS].md`** – Inbox for discovered/unplanned work. Items found mid-session, small tasks not warranting a tactical, or ideas to scope later. NOT a comprehensive task list—most work lives in tactical docs.
- **Legacy dev-notes** – Earlier docs may still be referenced. When a tactical note supersedes a dev-note, add a link back here and flag the old note as historical in its header.

## Session Flow
- **Before a session** – Skim `[STRATEGY-AND-TRACKER].md` for current status, check `[TODOS].md` for discovered work, scan latest tactical note for open threads, and confirm whether new tactical scope is needed.
- **During a session** – For planned work: follow the tactical doc's implementation plan. For discovered items: add to `[TODOS].md`. Log deep dives and conclusions in tactical notes.
- **After a session** – Update living docs with durable decisions (BE CONCISE - 2-3 bullets max), add the new tactical note to references, and capture any discovered tasks in `[TODOS].md`.

## Capturing Decisions
- Promote anything that affects roadmap, architecture, or long-lived conventions into the tracker or strategy doc the same day.
- **Keep tracker updates CONCISE** (2-3 bullets max). Verbose details belong in tactical notes. Link back to tactical notes for full context (e.g., "See 10-14-[1]-matchmaking-scope.md").
- When a tactical note resolves an open question, mark the question as answered (or retired) in `[STRATEGY-AND-TRACKER].md`.

## Folder Hygiene
- **Keep bracketed files short and scannable** – Living docs should be quick to skim. Push verbose history, detailed reasoning, and implementation specifics into tactical notes.
- When a tactical note is superseded, add a `Status: superseded by ...` line at its top.
- Archive completed phases by adding a brief retrospective section here so future epics can reuse the pattern.

## Update Cadence
- Revisit this doc whenever we discover friction in the workflow; document the change and date it.
- Suggest improvements as TODO bullets under a temporary "Pending Adjustments" heading until resolved.
- Remove stale process notes once the tracker or other living docs absorb them.
