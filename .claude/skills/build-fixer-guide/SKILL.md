---
name: build-fixer-guide
description: Use when build fails with TypeScript errors. Teaches how to invoke the build-fixer agent iteratively for token-efficient automated fixing.
---

# Using the build-fixer Agent

> **Note:** This skill is new and experimental (Dec 2025). The patterns and specifics below may need tweaking as we learn what works best in practice.

The `build-fixer` agent is a haiku-powered sub-agent that fixes TypeScript build errors. Use it for token-efficient, automated error fixing.

## When to Use

- After making changes that might break the build
- When the user asks you to fix build errors
- When you see TypeScript compilation errors in build output

## Basic Invocation

```
Task(subagent_type: "build-fixer", prompt: "Fix build errors")
```

## Iterative Fixing (Many Errors)

The agent fixes 5-10 errors per run. For large error sets, invoke multiple times:

```
Task(build-fixer, "Fix build errors")
→ "Fixed 7 errors, 15 remaining"

Task(build-fixer, "Continue fixing build errors")
→ "Fixed 8 errors, 7 remaining"

Task(build-fixer, "Continue fixing build errors")
→ "Build passes"
```

## Passing Context Between Runs

If the agent skips errors or notes patterns, pass hints to subsequent runs:

```
# First run returns: "Skipped auth.ts:45 - tentative: missing type from @kernel"

# Second run - include the hint:
Task(build-fixer, "Continue fixing errors. Note: auth.ts:45 may need type export from @kernel")
```

## Targeting Specific Apps

By default it runs both frontend and backend. To focus on one:

```
Task(build-fixer, "Fix build errors in frontend only")
Task(build-fixer, "Fix build errors in backend only")
```

## Handling Stuck Errors

If the agent reports skipped errors with tentative analysis:
1. Review the analysis - it may need architectural changes
2. Fix complex errors yourself, then re-run build-fixer for remaining simple ones
3. Pass hints if you have insights the agent missed

## Summary Interpretation

The agent returns:
- **Build status**: pass/fail
- **Errors fixed**: list with file:line
- **Errors skipped**: with tentative analysis (may need human attention)
- **Files modified**: for your awareness
