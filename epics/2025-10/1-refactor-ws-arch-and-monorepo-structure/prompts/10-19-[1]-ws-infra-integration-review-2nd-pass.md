
#### Key doc

* epics/2025-10/1-refactor-ws-arch-and-monorepo-structure/10-18-[1]-ws-infrastructure-integration-plan.md

#### Goal

* Do a thorough technical review of the doc
* Thoroughly address the questions / issues listed below
* Carefully think about the implementation phases, whether they are appropriately sized, and about the transitions between phases
* Consider if we should break the doc up into multiple docs, for the different phases. The doc is getting *quite* lengthy

#### Additional known questions / issues with current doc

Do the following points make sense? Evaluate, and then we can discuss and work on making any needed changes.

* v1 is not really live as a production system, so we don't need to worry at all about a "careful cutover" to v2. Right now, this project is still mostly a prototype.
    - Don't need need any of the env vars, e.g. `USE_WS_V2`
    - We are free to make any changes that feel right, and don't need to worry about backwards-compatibility.
    - We still want to have a smooth, thoughtful appraoch to our refactor, and to make changes in a manageable way to make sure we don't get in over our head.
* Overall, the doc is looking quite good. But I think some parts may still be a bit under-specified. We should check for parts that have hidden / undiscussed complexity. Not sure about this one, but we can double-check.
* Frontend plan mentions `ws/types` and `ws/boostrap` which seem to be pulling in app / domain knowledge, should / can we move those out of `ws` to keep that folder more of a generic lib?
* I updated part of the doc to call out `main.ts` as the entry point for v2 backend. Need to check if the rest of the doc has any places that need to be updated to reflect this.
    - Also, we may want to separate out the initialization / bootstrap code for the backend ws-server from the rest of `main.ts`, and import that into `main.ts`, especially if it's more than a handful of lines.
