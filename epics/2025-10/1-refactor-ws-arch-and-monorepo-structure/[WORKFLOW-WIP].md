# Epic Workflow - WIP

## Purpose
This living workflow doc captures how we run epic-scale work. It explains how the epic folder is organized, how living docs and tactical notes interact, and what to do before, during, and after AI-assisted sessions. Expect frequent tweaks—record any process adjustments here so the rest of the bracketed files stay focused on product decisions.

## Document Types
- **Living docs (`[NAME].md`)** – Always-on references for the epic (strategy, tracker, workflow). Keep them current; summarize durable outcomes and link supporting notes.
- **Tactical notes (`MM-DD-[n]-slug.md`)** – Point-in-time planning or execution logs. Capture detailed thinking, then bubble conclusions back into the relevant living doc.
- **Legacy dev-notes** – Earlier docs may still be referenced. When a tactical note supersedes a dev-note, add a link back here and flag the old note as historical in its header.

## Session Flow
- **Before a session** – Skim `[STRATEGY-AND-TRACKER].md` for current status, scan latest tactical note for open threads, and confirm whether new tactical scope is needed.
- **During a session** – Log deep dives in a tactical note, reference prior work, and keep a running list of actions to reflect in living docs.
- **After a session** – Update living docs with durable decisions, add the new tactical note to the references list, and queue follow-up tasks in the tracker.

## Capturing Decisions
- Promote anything that affects roadmap, architecture, or long-lived conventions into the tracker or strategy doc the same day.
- Use bullet breadcrumbs when linking back to tactical notes (e.g., "See 10-14-[1]-matchmaking-scope.md for discovery details").
- When a tactical note resolves an open question, mark the question as answered (or retired) in `[STRATEGY-AND-TRACKER].md`.

## Folder Hygiene
- Keep bracketed files short and scannable; push verbose history into tactical notes.
- When a tactical note is superseded, add a `Status: superseded by ...` line at its top.
- Archive completed phases by adding a brief retrospective section here so future epics can reuse the pattern.

## Update Cadence
- Revisit this doc whenever we discover friction in the workflow; document the change and date it.
- Suggest improvements as TODO bullets under a temporary "Pending Adjustments" heading until resolved.
- Remove stale process notes once the tracker or other living docs absorb them.
