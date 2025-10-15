# Session Prompt Template

## Purpose
Template for creating clear, actionable AI coding session prompts. Copy and customize sections as needed.

---

## Template Structure

### Objective

[One sentence describing the goal of this session]

### Primary Guide

Read and follow: [path/to/tactical-note.md]

[Brief description of what's in the tactical note and why it's the source of truth]

### Reference Files (For Pattern Matching)

**[Category 1 - e.g., Architecture patterns]:**
- `path/to/file.ts` - [What pattern to copy from this file]
- `path/to/other.ts` - [What this demonstrates]

**[Category 2 - e.g., Existing domain implementation]:**
- `path/to/domain/handlers.ts` - [Pattern to follow]
- `path/to/domain/actions.ts` - [Pattern to follow]

**[Category 3 - e.g., Protocol types]:**
- `path/to/protocol/messages.ts` - [What to import]

### Deliverables

1. **`path/to/file.ts`**
   - [Brief description of what goes in this file]
   - [Key requirements or patterns to follow]

2. **`path/to/other/file.ts`**
   - [Description]
   - [Requirements]

[Continue for each file/deliverable...]

### Critical Patterns

**[Pattern Name - e.g., Frontend handlers MUST be thin]:**
```ts
// ✅ CORRECT - [explanation]
[good example code]

// ❌ WRONG - [explanation]
[bad example code]
```

**[Another Pattern]:**
```ts
// ✅ CORRECT
[example]

// ❌ WRONG
[example]
```

### What NOT To Do

- ❌ [Thing to avoid with brief explanation]
- ❌ [Another thing to avoid]
- ❌ [etc.]

**Exception:** ✅ [Any exceptions to the above rules]

### Verification

After creating all files, check:
1. ✅ [Verification step 1]
2. ✅ [Verification step 2]
3. ✅ [etc.]

**Note:** [Any caveats about verification, like build setup not ready yet]

### After Implementation

**Check in with the user** to:
- Review what was created
- Discuss any issues or discoveries
- Decide on next steps

#### Documentation Tasks

Update [STRATEGY-AND-TRACKER].md:

* [ ] Document progress / what's completed (BE CONCISE - 2-3 bullets max!)
* [ ] Update open questions / decisions (if any)

#### Tasks for later sessions

- [ ] [Future task 1]
- [ ] [Future task 2]

### Session Workflow

1. [Step 1]
2. [Step 2]
3. [Step 3]
4. [etc.]

---

## Usage Notes

- **Be specific about patterns** - Show examples of correct/incorrect code
- **Link to reference files** - Let AI pattern-match from existing code
- **Define clear deliverables** - List exact files to create
- **Emphasize brevity** - Remind about concise doc updates
- **Include verification** - Give AI a checklist to validate work
- **End with check-in** - Always prompt for user review before moving on

## Example Session Prompts

See tactical notes for real examples:
- `10-15-[1]-matchmaking-implementation-planning.md` - Domain scaffolding session
