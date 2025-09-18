Can you do a careful code review on the recent changes for move history / preparing for a "replay" functionality?
The code changes start at commit 5b54397 "core: add replay types..".
There are also 2 docs to look through carefully:
- Rough planning doc (written before code changes): dev-notes/2025-09-18-replay-mvp.mdA
- Follow-up notes (written after code changes): dev-notes/2025-09-18-replay-follow-ups.md

Both of these docs were written by my AI assistant, as well as the code changes. So there may be plenty of mistakes / or obvious improvements that could be made.

I have some initial comments after skimming the code:
- Import order:
    - 3rd-party libs, then common, then core, then code specific to that domain (FE code for FE, BE code for BE)
    - We should also update AGENTS.md to mention this
- The type TimingConfig is duplicated between core/replay/types and the `timing` field in core/game-config
- backend/game/actions/create-game should import some functions that creat the config objects, something like `defaultTimingConfig`, `defaultMapGenConfig` (from core), instead of constructing the objects manually field-by-field
- Does `moveHistory` need to be optional in `EndGameParams` in the backend?
- If we are switching to the terminology "step" instead of `tick` (which I think seems good), we shouldn't create any new code that uses the term `tick`. `processTick` could be `processStep`? and so on?
-  we could consider moving the logic for persisting move history to DB every ~1 sec out of the game server into its own thing?
- the new function `validateMove` in core should be in its own file, or at least not part of `step-processor`

Let me know your thoughts! Thanks :)
Don't make any changes, just present your analysis for discussion / future use.
