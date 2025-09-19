I'm working on a script rewrites commit messages for a selection of commits on a specific branch.

Here's a depiction of what I mean:


##### Starting point

```bash
$ git log --oneline -10 --graph

* commit-1 (my-branch)
* commit-2
* commit-3
* commit-4
* commit-5
* commit-6 
* other-commit-1 (dev)
* other-commit-2
# ... and so on
```
 
###### Goal

```bash
$ git log --oneline -10 --graph

* commit-1-fixed (my-branch-v2)
* commit-2
* commit-3-fixed
* commit-4
* commit-5-fixed
* commit-6-fixed
* other-commit-1 (dev)
* other-commit-2
# ... and so on
```

`my-branch-v2` will have the exact same changes as `my-branch`, but with a subset of the commit messages rewritten.


I have a script for this at: scripts/rewrite-commit-messages.ts

It's pretty good, but I want to improve it a bit. Let's work on this together.

Issues / comments / questions

1. The JSON format for the rewrite info should be what I have in the file: scripts/2025-09-19-commit-msg-rewrites.json. You'll see that the message value can be an array of strings, those will be the lines of the commit msg. The first entry will be the *subject*, and the remainining (if any) will be the body.
2. In `loadNewMessagesFromFile`, let's validate the shape of everything before proceeding (all objs in the array should have "hash" and "new-message"). Let's also create a type for this at the top
3.
4. I some of the typings are overly flexible. Take `preserveAuthorship` for example. Is there a reasonable situation where we *wouldn't want that to be true? my guess is probably not. Also, I think `stopOnError` should always be true? So perhaps both of those shouldn't even be options...
5. Let's use commander.js instead of manually parsing from `argv`. There's a helper we can use for better typing: `scripts/helpers/typed-command.ts`
6. The params dryRun and verbose seem redudant. I think we can just have a dryRun option, yeah?
7. Let's move the "message rewrite for specific SHA" part of core loop in `rewriteCommitMessages` out into a separate function
8. Question: can you explain what the `fullMessage.replace(...)` is doing at the key part where we actuall "Amend with new message"

Don't write any code yet. Can you carefully read the script, think about the above items, and then present your analysis.

Also, do a general code review of the script to see if there are other issues that we should address. If there are ambiguities / key assumptions that we should discuss, also identify those.

Think harder :)
