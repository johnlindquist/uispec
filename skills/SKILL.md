---
name: uxspec
description: Walk through building a UXSpec (.uxspec.json) file — gathering requirements, making design decisions about layout/typography/color/motion/accessibility, designing the state machine, defining visuals, then compiling and verifying the output.
---

# UXSpec Builder

Interactive workflow for creating UXSpec files — the JSON format that unifies state machines and visual specifications for AI agents. Each phase has a dedicated skill with detailed guidance.

## Trigger

Use when the user wants to create, build, or scaffold a `.uxspec.json` file, or asks "help me write a uxspec".

## Workflow

Follow these phases in order. Each phase produces a concrete artifact before moving on. Read the linked skill for detailed decision guidance.

### Phase 1 — Gather Requirements
→ See `gather/SKILL.md`

Establish who, what, and why before writing JSON. Ask about structural requirements (states, events, context), design context (audience, brand personality, references), and UX intent (primary actions, copy tone, first-time experience). Summarize and confirm before proceeding.

### Phase 2 — Design the State Machine
→ See `states/SKILL.md`

Build `$machine` — compound and leaf states, transitions, guards, entry/exit actions, invocations. Map happy paths first, then unhappy paths. Cover empty, loading, error, and success states. Simplify aggressively. Present as a text diagram.

### Phase 3 — Define Tokens and Visuals
→ See `tokens/SKILL.md` and `visuals/SKILL.md`

Define `$tokens` (color, typography, spacing, timing, radius) and `$elements` (reusable templates). Add `$visual` to every leaf state with intentional layout, descriptive `$description` fields, `testId` on interactive elements, and `aria` labels.

Read `references/format-reference.md` for token syntax, element types, and visual structure.

### Phase 4 — Add Runtime Semantics
→ See `wire/SKILL.md` and `animate/SKILL.md`

Define `$context`, `$events`, `$actions`, `$effects`. Wire `binding`, `visibleWhen`, `enabledWhen`, `onPress`, `onChange`. Add `$animations` and `onEnter` choreography where state transitions need smoothing.

Read `references/runtime-semantics.md` for expression syntax and action/effect kinds.

**Also apply:**
- `clarify/SKILL.md` — review all copy and descriptions
- `harden/SKILL.md` — add edge case handling and resilience

### Phase 5 — Generate and Verify
→ See `review/SKILL.md`

1. Write the spec to `examples/<name>.uxspec.json`
2. Validate: `bun run src/compiler/cli.ts validate examples/<name>.uxspec.json`
3. If validation fails, fix reported issues (the compiler returns structured issue codes)
4. Compile: `bun run src/compiler/cli.ts compile examples/<name>.uxspec.json`
5. Inspect: `bun run src/compiler/cli.ts inspect examples/<name>.uxspec.json`
6. Run the full quality review from `review/SKILL.md`
7. Apply `extract/SKILL.md` to consolidate repeated patterns
8. Report: states, assertions, initial resolution, unresolved refs/tokens, compiled output path

### Issue Resolution

| Code | Fix |
|------|-----|
| `UNDECLARED_CONTEXT_VAR` | Add missing field to `$context` |
| `UNDECLARED_EVENT` | Add missing event to `$events` |
| `UNDECLARED_TARGET` | Fix transition target to match a valid state path |
| `UNSUPPORTED_EXPR_OP` | Replace with a supported operator (see spec) |
| `INVALID_ASSIGN_PATH` | Ensure path starts with `context.` |
| `UNKNOWN_TOKEN_REFERENCE` | Add missing token to `$tokens` or fix the path |
| `UNKNOWN_ELEMENT_REFERENCE` | Add missing element to `$elements` or fix the name |
| `INVALID_MACHINE_INITIAL` | Set `$machine.initial` to a valid top-level state |
| `INVALID_COMPOUND_INITIAL` | Set compound state `initial` to a valid child name |

## Skills

| Skill | Phase | Purpose |
|-------|-------|---------|
| `gather` | 1 | Design context, requirements, UX intent |
| `states` | 2 | State machine design and simplification |
| `tokens` | 3 | Color, typography, spacing, timing tokens |
| `visuals` | 3 | $visual blocks, layout, descriptions, elements |
| `wire` | 4 | Context, events, actions, effects, bindings |
| `animate` | 4 | $animations, onEnter, motion timing |
| `clarify` | 3–4 | Copy, descriptions, error/empty/loading text |
| `harden` | 4 | Edge cases, resilience, accessibility |
| `extract` | 5 | Consolidate reusable elements and tokens |
| `review` | 5 | Quality audit before shipping |

## Key Rules

- File extension: `.uxspec.json`
- Schema: `https://raw.githubusercontent.com/johnlindquist/uxspec/main/schema/uxspec.schema.json`
- Required top-level: `$schema`, `$description`, `$machine`
- `$machine` requires: `id`, `initial`, `states`
- Leaf elements (`text`, `button`, `input`, `icon`, `shape`, `badge`, `bar`) MUST NOT have `children`
- Container elements (`group`, `layer`, `grid`, `stack-h`, `stack-v`) MAY have `children`
- Token references: `"{path.to.token}"` — curly braces inside a string
- Element references: `{ "$ref": "name", ...params }`
- Expressions: S-expression arrays like `["==", ["var", "context.x"], true]`
- All `$`-prefixed properties are reserved

## Reference Files

- `references/format-reference.md` — Token syntax, element types, visual structure, layout primitives
- `references/runtime-semantics.md` — Context, events, actions, effects, expressions, transitions
- `references/minimal-example.md` — Complete minimal spec you can use as a starting template
