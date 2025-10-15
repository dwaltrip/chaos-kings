### Session Goal

  Kick off implementation of the matchmaking domain within the v2 architecture, following the epic workflow and Phase 1 objectives.

  ### Prep

    1. Skim the epic workflow guide (epics/2025-10/1-refactor-ws-arch-and-monorepo-structure/[WORKFLOW-WIP].md) so the session stays aligned with the current process.
    2. Re-read the epic tracker’s Phase 1 section—especially the matchmaking bullets—in [STRATEGY-AND-TRACKER].md. Note open questions or TODOs that might affect matchmaking work.
  3. Consult the architecture references as needed:
      - dev-notes/2025-10/10-12-[1]-monorepo-folder-structure-v2.md for directory layout and dependency constraints.
      - dev-notes/2025-10/10-12-[2]-project-arch-massive-refactor.md for WebSocket patterns, handler/action conventions, and the system-domain integration notes we added.

  ### Implementation Focus

  - Create a fresh tactical note (dated file) for this session’s discoveries, decisions, and checkpoints.
  - Backend (apps/backend/domains/matchmaking/): scaffold handlers.ts, actions.ts, ws-effects.ts, and types.ts following the chat domain template; wire
    in protocol types, leave concrete logic stubbed with clear TODOs.
  - Frontend (apps/frontend/domains/matchmaking/): add handlers.ts and actions.ts (or equivalent) that mirror the new protocol shapes and align with the client bridge pattern.
  - Confirm packages/protocol/domains/matchmaking/ files already match intended message names; adjust if gaps surface.
  - Annotate any dependencies on the system domain (e.g., room registration, heartbeat needs) so we can revisit them during integration.

  ### Wrap-Up

  - Update [STRATEGY-AND-TRACKER].md with progress, decisions, or new open questions. Check with user before adding anything beyond concise progress udpates.
  - If any notable workflow tweaks were discovered, check with the user and then update accordingly in [WORKFLOW-WIP].md.
  - Capture follow-up tasks (e.g., branded ID revisit, infrastructure hooks) and ensure the tracker reflects next steps
  - .

  ### First

Sketch out a plan first.

Importantly, carefully look at the specced out matchmaking message types in the new protocol package, and then look at the v1 matchmaking code in the old backend / frontend dirs (in the project root). The old implementation should guide the new, we are going for feature parity.

Finally, please list any questions, issues, or ambiguities that come up, so we can resolve before implementing.
