# jj cheatsheet (for a git user)

A lookup table for the git operations you actually use in this repo, with
their jj equivalents. Not a tutorial — see Chris Krycho's "jj init" or the
official jj docs for that. This doc assumes you've run `jj git init --colocate`
in the repo so jj and git operate side-by-side on the same `.git`.

Helpful links:

* [Steve Labnik's tutorial](https://steveklabnik.github.io/jujutsu-tutorial/introduction/introduction.html)
* [jj-init from Chris Kryncho](https://v5.chriskrycho.com/essays/jj-init/)
* [Official github repo](https://github.com/jj-vcs/jj)

## Mental model deltas

Four things that are different from git. Internalize these and the rest is
mostly syntax.

- **The working copy is a commit.** Your uncommitted edits live in the `@`
  commit, which is created/updated automatically on every `jj` command.
  There is no staging area. To "commit" work you just describe (`jj describe`)
  and then start a new empty commit on top (`jj new`).
- **Change IDs are stable across rewrites.** Every commit has both a commit
  ID (like git's SHA, changes when you amend) and a change ID (stable across
  amends/rebases). You almost always refer to commits by change ID, which
  means "this commit" keeps its identity as you reshape it.
- **Bookmarks, not branches.** jj's equivalent of a git branch is a
  "bookmark". Bookmarks don't auto-advance — you move them manually with
  `jj bookmark set`. Less magic, more explicit.
- **Every operation is undoable.** `jj op log` is a full history of every
  command you ran; `jj undo` reverts the last one; `jj op restore <id>`
  jumps to any point. This replaces git's reflog-and-hope workflow.

## Common revset shorthand

You'll use these constantly. A "revset" is jj's query language for commits.

| Revset | Meaning |
| --- | --- |
| `@` | the working-copy commit |
| `@-` | parent of working copy (what you'd call `HEAD~1`) |
| `@--` | grandparent |
| `abc` | change ID prefix (unambiguous prefix works) |
| `trunk()..@` | all commits from main up to working copy |
| `::@` | all ancestors of working copy |
| `mine()` | commits authored by you |

## Everyday operations

| What you want | git | jj |
| --- | --- | --- |
| See current state | `git status` | `jj st` |
| See history | `git log --oneline` | `jj log` (default shows your stack) |
| See full history | `git log --oneline --all` | `jj log -r 'all()'` |
| Start new work | `git checkout -b feat` | `jj new -m "feat: start"` |
| Save progress | `git add -A && git commit -m "..."` | `jj describe -m "..." && jj new` |
| Amend last commit | `git commit --amend` | just edit files — `@` updates automatically |
| Reword last commit | `git commit --amend -m "..."` | `jj describe -m "..."` |
| Reword older commit | `git rebase -i HEAD~3` → reword | `jj describe -r <change-id> -m "..."` |
| View a commit's diff | `git show abc` | `jj show abc` |
| Diff working copy | `git diff` | `jj diff` |

## History surgery (the stuff that motivated this doc)

This is where jj really pulls ahead. No interactive rebase todo-list, no
"detached HEAD" weirdness, no mid-rebase conflict panic.

| What you want | git | jj |
| --- | --- | --- |
| Squash HEAD into parent | `git reset --soft HEAD~1 && git commit --amend` | `jj squash` |
| Squash arbitrary commit into its parent | `git rebase -i` → fixup | `jj squash -r <change-id>` |
| Squash commit A into commit B | (awkward in git) | `jj squash --from A --into B` |
| Split a commit into two | `git rebase -i` → edit → reset → recommit | `jj split -r <change-id>` (opens a TUI) |
| Reorder commits | `git rebase -i` → move lines | `jj rebase -r X --before Y` |
| Move a commit onto a new parent | `git rebase --onto` | `jj rebase -r X -d Y` |
| Abandon a commit entirely | `git rebase -i` → drop | `jj abandon <change-id>` |
| Rebase stack onto main | `git rebase main` | `jj rebase -d main` |

### The specific workflow from our session

What we just did (squash 8 commits into 2, then reword both) in jj:

```sh
# Squash: pick ranges and fold them
jj squash --from <start>..<end> --into <target>
# or interactively pick hunks
jj squash -i

# Reword both
jj describe -r @- -m "$(cat /tmp/msg1.txt)"
jj describe    -m "$(cat /tmp/msg2.txt)"
```

No backup branch, no `commit-tree` plumbing, no preserving author dates
by hand. And if any step goes wrong: `jj undo`.

## Bookmarks and pushing

Bookmarks are the biggest daily friction coming from git. They do not
auto-advance when you commit — you have to move them yourself.

| What you want | git | jj |
| --- | --- | --- |
| List bookmarks/branches | `git branch` | `jj bookmark list` |
| Create bookmark here | `git branch foo` | `jj bookmark create foo` |
| Move bookmark to `@` | (implicit on commit) | `jj bookmark set foo -r @` |
| Delete bookmark | `git branch -d foo` | `jj bookmark delete foo` |
| Push bookmark | `git push -u origin foo` | `jj git push --bookmark foo` |
| Push all bookmarks | `git push` | `jj git push` |
| Force-push after rewrite | `git push --force-with-lease` | `jj git push` (jj handles rewrites) |

Typical flow: work on `@`, reshape history freely, then `jj bookmark set
explore-landscape -r @` and `jj git push` when ready.

## Undo and recovery

jj's killer feature. Anything you did, you can reverse.

| What you want | git | jj |
| --- | --- | --- |
| Undo last command | `git reflog` → `git reset --hard` | `jj undo` |
| See operation history | `git reflog` | `jj op log` |
| Jump to a prior state | `git reset --hard <ref>` | `jj op restore <op-id>` |
| Recover abandoned commit | `git reflog` → `git cherry-pick` | `jj op restore` or reference by change ID |

`jj undo` just works. Deleted a commit? Undo. Botched a rebase? Undo.
Force-pushed the wrong thing? Can't un-push, but the local state is
recoverable.

## First-week friction

- **You'll forget to move bookmarks.** You'll reshape history, push, and
  wonder why the remote didn't update. Check `jj bookmark list` — the
  bookmark is probably still pointing at the pre-rewrite commit.
- **`jj new` after every logical chunk.** Without it, your work keeps
  accumulating in `@`. Think of `jj new` as "close this commit, start
  a fresh one."
- **Revsets feel foreign for a day or two.** Worth skimming
  `jj help -k revsets` early on so you know what's available.
- **Conflicts are first-class.** jj doesn't stop mid-rebase on a conflict
  — it records the conflict in the commit and lets you resolve it later.
  Jarring at first, liberating once you trust it.

## When to reach back for git

Colocated mode means git still works. Use git directly for:

- Reading tools that expect git: `gh pr create`, IDE integrations, CI
  configs, pre-commit hooks.
- Operations jj doesn't have a good equivalent for yet (rare, but `git
  bisect` is more mature).
- When you're in a hurry and muscle memory wins.

The two tools share the same `.git`, so switching between them mid-task
is fine.
