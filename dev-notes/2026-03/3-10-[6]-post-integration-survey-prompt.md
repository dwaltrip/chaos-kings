# Session Prompt: Post-Integration Survey

## Goal

Now that all three domains are on board-store, do a broad read-through of the frontend codebase to understand the current state. The board-store integration touched a lot of files — this survey captures what the code actually looks like now, identifies patterns and inconsistencies, and feeds into the architecture discussion in `3-10-[5]-cross-domain-cleanup-session-prompt.md`.

This is a **read-only survey** — no code changes. Output is a dev-note summarizing findings.

## Background docs

- **`3-10-[4]-board-store-all-domains-integrated.md`** — Integration findings and confirmed patterns
- **`3-09-[9]-board-store-integration-survey.md`** — Pre-integration action mappings (useful as "before" comparison)
- **`docs/architecture.md`** — Overall architecture (last substantive update Nov/Dec 2025, partially outdated)
- **`apps/frontend/AGENTS.md`** — Frontend-specific patterns

## Survey scope

### 1. Three domains side-by-side

Read the current state of all three domains' key files and compare:

**Actions:** Read all action files in `puzzles/actions/`, `sandbox/actions/`, `gameplay/actions/`. For each domain, note:
- Which actions are thin wrappers around board-store calls?
- Which have real domain-specific logic?
- Which are nearly identical across domains?
- What's the current import pattern — how do they access board-store, domain stores, ws-effects?

**Tile components:** Read `PuzzleTile`, `SandboxTile`, `GameTile`. Are they truly identical now? Any subtle differences?

**Page components:** Read the main page for each domain. How do they access board state? What's the mix of board-store reads vs domain-store reads?

**WS effects:** Read `puzzles/ws-effects.ts`, `sandbox/ws-effects.ts`, `gameplay/ws-effects.ts`. Compare the move-related messages (`sendMoveRequest`, `sendUndoMove`, `sendCancelMoves`). Are the underlying protocol messages the same shape or different?

**Domain stores:** Read the current (post-migration) puzzle store, sandbox meta store, gameplay store. What does each still hold? Are there patterns in how they relate to board-store?

**Handlers:** Read `puzzles/handlers.ts`, `sandbox/handlers.ts`, `gameplay/handlers.ts`. How thin are they? Any logic that should move to actions?

### 2. The `games/` shared layer

Read everything in `domains/games/`:
- `board-store/` — what's in here now? State management, rendering, both?
- Any other shared files/types remaining after the old infra was deleted?
- Is there a clear boundary between what's shared and what's domain-specific?

### 3. Frontend structure overview

Step back and look at `domains/` as a whole:
- Which domains are "board domains" (use board-store) vs not?
- How do domains communicate? Direct imports? Shared stores? WS messages?
- Are there any circular or surprising dependencies?
- Does the current directory structure reflect how the code actually works?

### 4. Staleness check

Skim `docs/architecture.md` and `apps/frontend/AGENTS.md`. What's outdated now? What's missing? Don't rewrite — just note what needs updating.

## Output

Write findings to a dev-note. Organize by topic, not by file. Focus on:
- Concrete duplication (with file paths and line counts where helpful)
- Inconsistencies between domains
- Things that are in the wrong place
- Patterns that emerged but aren't yet formalized
- Questions or trade-offs to bring to the architecture discussion
