### Intro

I'm getting ready to start diving further into this very large and complex refactor I'm working on.

In this chat session, I want to review the docs we have, how they are organized, and discuss the workflow for future AI coding sessions as I dive into the implementation more.

I'm hoping the output is refinements to the docs and improved clarity and understanding for the new workflow we are developing, and a good launching point for the next batch of work.

I thing we also need to create a WIP document that documents / describes the new workflow we are developing for "epics" (see below).

---

### General workflow notes / overview

Up until this point, my AI coding workflow has been a mostly one-off, ad-hoc process using dev-notes as a place to "store" results of planning / design sessions, which can then be iterated on, and finally referenced in implementation sessions.

This has worked pretty well, as it's a flexible, loose structure. I can use as many dev-note docs as I need, iterate on them in multiple agent sessions, or even execute the implementation in the same session as when they were written.

#### Experimental workflow: Epics

We are trying out a new project management flow and folder structure. We've created the top-level "epic" folder. Each epic will have its own folder. The epics will be grouped into month-level folders.

The epic folder name the following name format: [number]-[brief-descriptive-name]. The number is simply to keep the epics sorted / ordered within the month level folder, if we have multiple started in the same month. Also could be a shorthand reference (e.g. epic 1 from 2025-10).

##### Document types

Currently, I'm imagining 2 main document types in these epics:

1. Living documents that will be updated and referenced throughout the entire epic
2. Tactical, point-in-time docs that are targeted for a specific task and not expected to be kept up-to-date. E.g. plans for implementing a specific feature, exploration / notes for a particular design decision that needs to be made, etc. They will be prefixed with a date, very much like how `/dev-notes` works today.

##### Living documents

The filenames will be undated, caps-locked, and starting / ending with brackets. Examples:

- [TRACKER.MD]
- [INTRO.MD]
- [STRATEGY-AND-INSIGHTS.MD]

The caps-lock ensures that they are sorted at the top of the folder, before any date-prefixed tactical docs.

##### Tactical docs 

These will be the day-to-day working docs as we progreess through the refactor. I'm thinking they will function largely similar to how I've been using /dev-notes before. But since they are part of this epic, we can store them together in the epic folder instead of in /dev-notes.

The name format should be the same: `MM-DD-[number]-brief-descriptive-title.md`

---

### Back to the current refactor

The epic for this refactor is found at:

- epics/2025-10/1-refactor-ws-arch-and-monorepo-structure/

So far we just have one doc in there, an early draft of a living doc that has broad strategy notes and aspires to be a tracker. Here it is:

- epics/2025-10/1-refactor-ws-arch-and-monorepo-structure/[STRATEGY-AND-TRACKER.md]

There are 2 other key docs with detailed notes, architecture designs, and plans for the refactor. They were created before the new epics idea, so they are in dev-notes. Perhaps we will move them over.

Here they are:

- Brief overview of new monorepo folder stucture: dev-notes/2025-10/10-12-[1]-monorepo-folder-structure-v2.md
- Detailed notes, architecture skeches, designs, and plans: dev-notes/2025-10/10-12-[2]-project-arch-massive-refactor.md

---

### Known issues w/ the docs

I reviewed the docs myself earlier today, and found a few issues. There are probably more, but for now I'm aware of the following:

* Need something in the [STRATEGY-AND-TRACKER.md] doc that explains what the doc is, how it will be used, and so on.
* Missing a description of the new "system" domain in the main arch doc

##### Brief explainer for STRATEGY-AND-TRACKER

- I'm thinking we add a brief opening bit that concisely explains what the doc is attempting to be / how we may use it. This should be marked as WIP, as this is a new process, and it is going to evolve over the course of the refactor.
- Right now, the doc just dives immediately into a broad overview of the refactor. The explainer should probably be the first thing, I think?

##### System domain

###### Will own things like

- All ws messages for joining and leaving "rooms" (will be used by other domains for this)
- In the v1 code, this was done more haphazardly.
- Not sure what else, but maybe:
- ping stats (avg ms)
- heartbeat
- etc

###### Slightly special (compare to other domains)

- The generic ws-server and ws-client will likely integrate w/ it in a slightly custom way, in order to provide convenient methods for room related stuff.
- Where possible, the system domain code will be structured as similar as possible to other domains

---

### Prompt / goals for us right now

I want to do 2 things with you:

1. Let's discuss how to improve the docs. Bare minimum, I want to fix the 2 issues I described above.
2. I'd also like to have a meta-discussion about the new workflow and how these docs will be used. I want to hear your thoughts about how this workflow might go, what it might be like as we tackle the refactor over time. Perhaps general ideas that I might be insightful for me or help me think about and improve the workflow over time.

I'm not sure the best order for that, perhaps it will be a bit of both at the same time.

#### Getting started 

Please start by very carefully reading the 3 docs I've mentioned, keeping in my everything I've discussed above.

Initial architecture docs:
1. dev-notes/2025-10/10-12-[1]-monorepo-folder-structure-v2.md
2. dev-notes/2025-10/10-12-[2]-project-arch-massive-refactor.md

Strategy and tracker doc for the epic we are starting:
3. epics/2025-10/1-refactor-ws-arch-and-monorepo-structure/[STRATEGY-AND-TRACKER.md]

Review for coherency, completeness, flow, and accuracy.  Note unstated assupmptions, ambiguities, unclear wording, under / over emphasis.

##### Off to the races. Godspeed my good sir :p

Once you've read all the docs, do some deep analysis and synthesis, and jot down detailed notes of your findings and thoughts.

Then we can discuss!
