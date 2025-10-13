Plz carefully read the following docs:

- dev-notes/2020-10/10-12-[1]-monorepo-folder-structure-v2.md
- dev-notes/2020-10/10-12-[2]-project-arch-massive-refactor.md

I'd like to clarify and refine the plan.

- The notes above contain tons of good insights and are mostly correct I think. But this is a massive refactor.
- Some of the ideas / proposals feel pretty rock-solid.
- Others are slightly more speculative.

...

...

We need to clarify and refine both the *GOALS* of the refactor as well as the strategy.

##### Rock solid aspects

- New WS architecture and patterns (which is 95% agnostic to the new monorepo structure)
    - Contracts / message + paylaod types in one place (e.g. protocol, common, etc)

...

...

##### (Somewhat) More speculative

`@protocol` **does not** import from anything except for kernel

With this policy:
- `@protocol` maintains its own domain types
    - Specific to the data shapes going across the wire
    - We call these **snapshots**, e.g. `ChatMessageSnapshot`.
- `@platform` has shared domain types / objects that are used by both frontend and backend.
    - Should be fairly neutral, not backend or frontend focused
    - backend and frontend can enhance / extend these for concerns that are specific to their context. e.g. persistence related, comprehensive data used by all apps, etc, blah blahh

This feels a little like overkill / a bit heavyweight. Not sure if the extra code and complexity will be worth it at this stage...

...

...

...
