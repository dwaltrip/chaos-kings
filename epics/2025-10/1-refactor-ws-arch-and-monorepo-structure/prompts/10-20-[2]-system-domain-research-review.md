# System Domain Research Review

**Date:** 2025-10-20
**Context:** We've completed initial research on how v1, demo v2, and current v2 handle room management and system domain concerns. Need to review the research doc for accuracy before moving to design phase.

---

## Session Goal

Carefully review `10-20-[2]-system-domain-research.md` to ensure accuracy and completeness.

---

## Instructions

### 1. Load Context

First, read the living docs for context:
- `[STRATEGY].md` - Epic goals, architecture principles, key decisions
- `[PROGRESS].md` - Current status, what's been completed
- `[TODOS].md` - Active and backlog items

Then read the research doc:
- `10-20-[2]-system-domain-research.md` - System domain research findings

### 2. Verify Against Actual Code

**IMPORTANT:** You MUST read the actual code to verify the research findings. Don't just review the doc in isolation - trace through the implementations.

Start by verifying each section against the code:

**Demo V2** (PRIMARY FOCUS - this is our reference):
- Read: `epics/.../demo-ws-infra/{backend,frontend,common}/src/domains/system/`
- Verify the message flows are accurate
- Check if we missed any important patterns
- Confirm the key characteristics match the implementation

**Current V2** (IMPORTANT - this is our actual codebase):
- Read: `apps/backend/src/domains/{gameplay,system}/`
- Read: `packages/protocol/domains/gameplay/client-messages.ts`
- Verify what's actually implemented vs stubbed
- Check if the characterization is accurate

**V1** (REFERENCE ONLY - brief verification):
- We mostly won't follow this approach, so don't spend too much energy here
- Just verify the high-level patterns are correct (generic `join-room` message, domain-specific handlers)
- Don't document every detail - keep it high-level
- Focus on understanding the key insight: domains can do domain-specific work when handling join

### 3. Review for Accuracy and Completeness

After reading the code, check:

**Accuracy:**
- Are the message flows correct?
- Do the code snippets match what's actually in the files?
- Are the "Key Characteristics" accurate?

**Completeness (Demo V2 and Current V2):**
- Did we miss any important patterns?
- Are there insights from the code that aren't captured?
- Are the open questions comprehensive?

**Clarity:**
- Is the "Critical Question" section highlighting the right issue?
- Are the three approaches clearly distinguished?

### 4. Suggest Improvements

If you find issues:
- Note them clearly with specific file references
- Suggest corrections or additions
- **For Demo V2 and Current V2:** be thorough and detailed
- **For V1:** keep it high-level unless it's a critical insight

---

## Deliverable

A review summary covering:
1. **Accuracy issues found** (if any)
2. **Missing insights or patterns** (if any)
3. **Clarity improvements needed** (if any)
4. **Overall assessment** - Is the doc ready for design phase?

If corrections are needed, propose specific edits.
