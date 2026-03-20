---
name: review
description: Run a systematic quality audit on a completed UXSpec — design intent, consistency, accessibility, and state coverage
---

# Review: Spec Quality Audit

Systematic quality pass on a completed UXSpec before shipping. Checks design intent, consistency, accessibility, state coverage, and copy quality.

## When to Use

After all phases are complete and the spec compiles successfully. Before opening a PR or handing off for implementation.

## Checks

### 1. AI Slop Test
If you showed this spec to someone and said "AI generated this," would they believe you? Check for:
- Generic font tokens (Inter, Roboto, system-ui with no personality)
- Purple-to-blue gradient color tokens
- Cards inside cards in any `$visual`
- Everything centered in every state
- Glassmorphism effects (blur + transparency + border)
- Hero metrics with sparkline decorations
- Identical grid layouts repeated across states
- Gradient text in descriptions

If any are present, they need justification or replacement.

### 2. Hierarchy Check (Squint Test)
For each state's `$visual`, imagine blurring your vision:
- Can you identify the primary action?
- Can you distinguish primary content from secondary?
- Are groups visually distinct from each other?
- Is there one clear focal point, not three competing ones?

If everything looks the same weight, spacing and typography tokens need work.

### 3. State Coverage
- Does every leaf state have a `$visual`?
- Are empty, loading, error, and success states present where needed?
- Does each error state have a specific message and recovery action?
- Does each loading state explain what's happening?
- Does each empty state offer a next action?
- Are there dead-end states with no outbound transitions?

### 4. Token Consistency
- Are all visual values token references, not hard-coded?
- Are similar elements using the same tokens? (Two buttons with different padding tokens = bug)
- Are there defined tokens that nothing references? (Dead tokens)
- Do color tokens maintain WCAG contrast against their backgrounds?
- Is the spacing scale consistent (no arbitrary gaps)?

### 5. Copy Review
- Is every `$description` specific enough to produce a consistent implementation?
- Are button labels action-specific? ("Submit" → "Create account")
- Do error messages explain and suggest, not blame?
- Are empty states helpful, not apologetic?
- Is terminology consistent? (Don't mix "delete" / "remove" / "trash")

### 6. Accessibility
- Does every interactive element have a `testId`?
- Do icon buttons and abstract elements have `aria.label`?
- Do dynamic regions have `aria.live`?
- Is keyboard navigation defined for every state? (`keyboard` bindings, `onEnter.focus`)
- Is there a visible focus state for every interactive element?
- Do any states rely on color alone to convey information?

### 7. Runtime Correctness
- Does every event referenced in transitions exist in `$events`?
- Does every context field referenced in expressions exist in `$context`?
- Do all `assign` paths start with `context.`?
- Are there guards that could be permanently false (unreachable transitions)?
- Is focus managed on every state entry that changes the interactive surface?

## Output

Report findings as:
- **Critical** — blocks implementation or produces broken UI (missing states, unreachable paths, accessibility failures)
- **Important** — produces inconsistent or confusing UI (vague descriptions, token misuse, copy issues)
- **Nice to have** — refinements (animation polish, spacing tweaks, copy tone)

## Principle

A review catches what the phases miss. Each phase focuses on building one layer; the review checks that all layers work together. The goal isn't perfection — it's confidence that the spec communicates clearly and handles the real world.
