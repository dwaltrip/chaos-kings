# Background

We've been working on the perfect-start-solve problem. We have a variety of appraoches and experiments in packages/algos/perfect-start-solver.

There are a lot of notes in dev-notes on our work from the past week or so (starting around 3-12).

We got simulated annealing working pretty well. It was more successful than my initial attemps with beam search.

Some key dev-notes for this different bodies of work:

- beam search results (decent snapshot): dev-notes/2026-03/3-13-[8]-scorer-experiments-report.md
- simulated annealing (SA) resutlts: dev-notes/2026-03/3-17-[1]-simulated-annealing-session-summary.md
- general AI coding workflow notes for this problem: dev-notes/2026-03/3-13-[9]-scorer-experiments-report-appendix.md


---

# Workflow

This is a collaborative session. I'll be available to answer questions
about game mechanics, help think through design decisions, and suggest
ideas. Check in with me at reasonable intervals — don't go heads-down
for too long, especially on open design questions. Ask rather than guess
on anything ambiguous.

Write dev-notes as you work (append to an existing or new file in
dev-notes/). Capture what you did, what you observed, and any open
questions — same style as the SA session notes.

---

# New approach

I've started working on my own custom algorithm that I came up with. The code is in the `custom-algo-1` dir.

Please read this doc for some ad-hoc notes about the idea from a chat session I had with Claude (in the web chat, not in claude code):

dev-notes/2026-03/3-18-[1]-notes-for-custom-algo-burst-path-search.md

I want to keep working on this custom algo. I have made some decent progress on it so far.

---

# Getting up to speed

Before writing any new code:

1. Read the notes doc linked above for the custom algo
2. Check out and run each of the 3 tmp-scripts in custom-algo-1/tmp-scripts
3. Check in with me — share what you understand about the approach and
   where things stand, and we'll make a plan together

Question 6 at the end of that notes doc might be a great place to start
once we're aligned.
